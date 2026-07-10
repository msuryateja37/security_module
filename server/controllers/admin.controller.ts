import { Response } from 'express';
import { AuthenticatedRequest } from '../security/auth.middleware.js';
import { ResponseView } from '../views/response.view.js';
import { AuditService } from '../security/audit.service.js';
import { ConfigService, CONFIG_DEFAULTS } from '../services/config.service.js';
import { UserModel } from '../models/user.model.js';
import { isValidRole, ROLE_LABELS, UserProfile } from '../security/roleAccess.js';
import { queryOne } from '../config/db.js';

// System administration endpoints (FR-036–FR-040) — user management is gated by
// admin:manage_roles; configuration and monitoring by admin:system_config.

const PROVINCES = [
  'Gauteng', 'North West', 'Free State', 'Limpopo', 'Mpumalanga',
  'KwaZulu Natal', 'Western Cape', 'Eastern Cape', 'Northern Cape', 'National'
];

const CLEARANCE_LEVELS: UserProfile['clearanceLevel'][] = [
  'Public', 'Restricted', 'Confidential', 'Secret', 'Top Secret'
];

const auditEntry = (user: UserProfile) => ({
  timestamp: new Date().toISOString(),
  userId: user.id,
  username: user.username,
  userRole: user.role,
  province: user.province,
  clearanceLevel: user.clearanceLevel
});

/** Per-key sanity checks so a bad payload can't break SLA calculation or the incident form. */
function validateConfigValue(key: string, value: any): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'Configuration value must be an object';
  }
  if (key === 'sla_rules') {
    const targets = value.classificationTargets;
    if (!targets || typeof targets !== 'object' || Object.values(targets).some(v => typeof v !== 'number' || v <= 0)) {
      return 'classificationTargets must map classifications to positive hour values';
    }
    for (const field of ['defaultTargetHours', 'atRiskThresholdPercent', 'fullReportDays', 'breachToSsaHours', 'investigationWorkingDays']) {
      if (typeof value[field] !== 'number' || value[field] <= 0) {
        return `${field} must be a positive number`;
      }
    }
    if (value.atRiskThresholdPercent >= 100) return 'atRiskThresholdPercent must be below 100';
  }
  if (key === 'escalation_rules') {
    if (!Array.isArray(value.levels) || value.levels.length === 0 || value.levels.some((l: any) => typeof l !== 'string' || !l.trim())) {
      return 'levels must be a non-empty list of names';
    }
    if (!isValidRole(String(value.notifyRole || ''))) {
      return 'notifyRole must be a valid system role';
    }
  }
  if (key === 'incident_categories') {
    if (!Array.isArray(value.incidentTypes) || value.incidentTypes.length === 0 || value.incidentTypes.some((t: any) => typeof t !== 'string' || !t.trim())) {
      return 'incidentTypes must be a non-empty list of names';
    }
  }
  if (key === 'notification_templates') {
    for (const [name, tpl] of Object.entries(value)) {
      const t = tpl as any;
      if (!t || typeof t.title !== 'string' || !t.title.trim() || typeof t.message !== 'string' || !t.message.trim()) {
        return `Template '${name}' must have a non-empty title and message`;
      }
    }
  }
  return null;
}

export const AdminController = {
  /** Configurable form options for regular screens (incident form, escalation dialog). */
  async formOptions(_req: AuthenticatedRequest, res: Response) {
    try {
      const config = await ConfigService.getAll();
      ResponseView.sendSuccess(res, {
        incidentTypes: config.incident_categories.incidentTypes,
        escalationLevels: config.escalation_rules.levels
      }, 'Fetched form options successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch form options');
    }
  },

  async getConfig(_req: AuthenticatedRequest, res: Response) {
    try {
      const config = await ConfigService.getAll();
      ResponseView.sendSuccess(res, {
        config,
        meta: ConfigService.getMeta(),
        defaults: CONFIG_DEFAULTS
      }, 'Fetched system configuration successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch system configuration');
    }
  },

  async updateConfig(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const key = String(req.params.key || '');
      if (!ConfigService.isValidKey(key)) {
        return ResponseView.sendError(res, `Unknown configuration key '${key}'`, 'Validation failed', 400);
      }

      const value = req.body?.value;
      const validationError = validateConfigValue(key, value);
      if (validationError) {
        return ResponseView.sendError(res, validationError, 'Validation failed', 400);
      }

      await ConfigService.update(key, value, user.username);

      await AuditService.log({
        ...auditEntry(user),
        action: 'UPDATE',
        resource: 'System Configuration',
        resourceId: key,
        details: `Updated system configuration '${key}'`
      });

      const config = await ConfigService.getAll();
      ResponseView.sendSuccess(res, config[key], 'System configuration updated successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to update system configuration');
    }
  },

  /** Runtime health snapshot — availability/performance monitoring (NFR-001, FR-040). */
  async systemHealth(_req: AuthenticatedRequest, res: Response) {
    try {
      const dbStart = Date.now();
      let dbStatus: 'Online' | 'Unavailable' = 'Online';
      let counts: Record<string, number> = {};
      try {
        for (const table of ['users', 'incidents', 'notifications', 'audit_logs']) {
          const row = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
          counts[table] = row?.count ?? 0;
        }
      } catch {
        dbStatus = 'Unavailable';
      }
      const dbLatencyMs = Date.now() - dbStart;

      const useMssql = process.env.USE_SQLITE === 'true'
        ? false
        : !!(process.env.DB_SERVER || process.env.AZURE_SQL_CONNECTIONSTRING);
      const memory = process.memoryUsage();

      ResponseView.sendSuccess(res, {
        database: {
          engine: useMssql ? 'Azure SQL (South Africa)' : 'SQLite (local development)',
          status: dbStatus,
          latencyMs: dbLatencyMs,
          counts
        },
        server: {
          uptimeSeconds: Math.round(process.uptime()),
          nodeVersion: process.version,
          memoryRssMb: Math.round(memory.rss / (1024 * 1024)),
          heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024))
        },
        compliance: {
          availabilityTarget: '99.5% during business hours 07:00–18:00 SAST, Mon–Fri (NFR-001)',
          backups: 'Daily automated Azure backups — RPO 24h, RTO 4h (NFR-008/9); managed at platform level',
          authentication: 'Active Directory SSO (FR-031) — accounts provisioned from AD; portal credentials are a pre-SSO stopgap',
          hosting: 'Microsoft Azure, South Africa data centres only (NFR-011)'
        }
      }, 'Fetched system health successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch system health');
    }
  },

  /** System Administrator creates a departmental account (FR-036). */
  async createUser(req: AuthenticatedRequest, res: Response) {
    try {
      const admin = req.user!;
      const body = req.body || {};
      const username = String(body.username || '').trim().toLowerCase();
      const displayName = String(body.displayName || '').trim();
      const email = String(body.email || '').trim();
      const role = String(body.role || '');
      const province = String(body.province || '');
      const office = String(body.office || '').trim();
      const clearanceLevel = String(body.clearanceLevel || '') as UserProfile['clearanceLevel'];

      if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
        return ResponseView.sendError(res, 'Username must be 3–50 characters (letters, digits, dot, dash, underscore)', 'Validation failed', 400);
      }
      if (!displayName || !email || !office) {
        return ResponseView.sendError(res, 'displayName, email and office are required', 'Validation failed', 400);
      }
      if (!isValidRole(role)) {
        return ResponseView.sendError(res, `Unknown role '${role}'. Valid roles: ${Object.keys(ROLE_LABELS).join(', ')}`, 'Validation failed', 400);
      }
      if (!PROVINCES.includes(province)) {
        return ResponseView.sendError(res, `Unknown province '${province}'`, 'Validation failed', 400);
      }
      if (!CLEARANCE_LEVELS.includes(clearanceLevel)) {
        return ResponseView.sendError(res, `Unknown clearance level '${clearanceLevel}'`, 'Validation failed', 400);
      }
      if (await UserModel.usernameExists(username)) {
        return ResponseView.sendError(res, 'A user with this username already exists (it may be deactivated)', 'Validation failed', 409);
      }

      const id = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const created = await UserModel.createUser({
        id,
        username,
        displayName,
        email,
        role,
        province,
        office,
        clearanceLevel,
        persalNumber: body.persalNumber ? String(body.persalNumber) : undefined,
        jobTitle: body.jobTitle ? String(body.jobTitle) : undefined,
        phoneNumber: body.phoneNumber ? String(body.phoneNumber) : undefined
      });

      if (!created) {
        return ResponseView.sendError(res, 'Failed to create user record', 'Operation failed');
      }

      await AuditService.log({
        ...auditEntry(admin),
        action: 'CREATE',
        resource: 'User Account',
        resourceId: username,
        details: `Created account '${username}' (${ROLE_LABELS[role]}, ${province})`
      });

      const user = await UserModel.getByUsername(username);
      ResponseView.sendSuccess(res, user, 'User created successfully', 201);
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to create user');
    }
  },

  /** System Administrator modifies an account (FR-036). Own role changes are blocked (lockout guard). */
  async updateUser(req: AuthenticatedRequest, res: Response) {
    try {
      const admin = req.user!;
      const username = String(req.params.username || '').trim().toLowerCase();

      const target = (await UserModel.getAllForAdmin()).find(u => u.username === username);
      if (!target) {
        return ResponseView.sendError(res, 'User not found', 'Operation failed', 404);
      }

      const body = req.body || {};
      const fields: Record<string, string> = {};
      for (const key of ['displayName', 'email', 'province', 'office', 'clearanceLevel', 'persalNumber', 'jobTitle', 'phoneNumber'] as const) {
        if (body[key] !== undefined) fields[key] = String(body[key]).trim();
      }
      if (fields.province !== undefined && !PROVINCES.includes(fields.province)) {
        return ResponseView.sendError(res, `Unknown province '${fields.province}'`, 'Validation failed', 400);
      }
      if (fields.clearanceLevel !== undefined && !CLEARANCE_LEVELS.includes(fields.clearanceLevel as UserProfile['clearanceLevel'])) {
        return ResponseView.sendError(res, `Unknown clearance level '${fields.clearanceLevel}'`, 'Validation failed', 400);
      }

      let role: string | undefined;
      if (body.role !== undefined && body.role !== target.role) {
        role = String(body.role);
        if (!isValidRole(role)) {
          return ResponseView.sendError(res, `Unknown role '${role}'`, 'Validation failed', 400);
        }
        if (username === admin.username) {
          return ResponseView.sendError(res, 'You cannot change your own role', 'Validation failed', 400);
        }
        if (target.baseRole) {
          return ResponseView.sendError(res, 'Revoke the acting assignment before changing this user\'s role', 'Validation failed', 400);
        }
      }

      if (Object.keys(fields).length === 0 && !role) {
        return ResponseView.sendError(res, 'No changes supplied', 'Validation failed', 400);
      }

      const updated = await UserModel.adminUpdate(username, { ...fields, ...(role ? { role: role as UserProfile['role'] } : {}) } as any);
      if (!updated) {
        return ResponseView.sendError(res, 'No changes made', 'Operation failed', 400);
      }

      await AuditService.log({
        ...auditEntry(admin),
        action: 'UPDATE',
        resource: 'User Account',
        resourceId: username,
        details: `Updated account '${username}': ${[...Object.keys(fields), ...(role ? ['role'] : [])].join(', ')}`
      });

      const user = (await UserModel.getAllForAdmin()).find(u => u.username === username);
      ResponseView.sendSuccess(res, user, 'User updated successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to update user');
    }
  },

  /** Deactivate / reactivate an account (FR-036). Rows are kept for the audit trail. */
  async setUserActive(req: AuthenticatedRequest, res: Response) {
    try {
      const admin = req.user!;
      const username = String(req.params.username || '').trim().toLowerCase();
      const isActive = req.body?.isActive === true;

      if (!isActive && username === admin.username) {
        return ResponseView.sendError(res, 'You cannot deactivate your own account', 'Validation failed', 400);
      }

      const all = await UserModel.getAllForAdmin();
      const target = all.find(u => u.username === username);
      if (!target) {
        return ResponseView.sendError(res, 'User not found', 'Operation failed', 404);
      }
      if (!isActive && target.role === 'security_director' && target.isActive) {
        const activeDirectors = all.filter(u => u.role === 'security_director' && u.isActive);
        if (activeDirectors.length <= 1) {
          return ResponseView.sendError(res, 'Cannot deactivate the last active Chief Security Director — escalations and approvals would have no target', 'Validation failed', 400);
        }
      }

      const changed = await UserModel.setActive(username, isActive);
      if (!changed) {
        return ResponseView.sendError(res, 'No changes made', 'Operation failed', 400);
      }

      await AuditService.log({
        ...auditEntry(admin),
        action: 'UPDATE',
        resource: 'User Account',
        resourceId: username,
        details: `${isActive ? 'Reactivated' : 'Deactivated'} account '${username}'`
      });

      ResponseView.sendSuccess(res, { username, isActive }, `User ${isActive ? 'reactivated' : 'deactivated'} successfully`);
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to update user status');
    }
  }
};
