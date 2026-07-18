import { Request, Response } from 'express';
import { DEFAULT_PREFERENCES, getPermissionsForRole, ROLE_CODES, ROLE_LABELS, ROLE_PERMISSIONS, UserPreferences } from '../security/roleAccess.js';
import { UserModel } from '../models/user.model.js';
import { ResponseView } from '../views/response.view.js';
import { AuthenticatedRequest } from '../security/auth.middleware.js';
import { AuditService } from '../security/audit.service.js';
import { verifyPassword } from '../security/password.service.js';
import { FileStorageService } from '../services/fileStorage.service.js';

// Seed default for accounts that have never set their own credential.
// Production auth is AD SSO (FR-031); this local credential is the pre-SSO login flow.
const DEFAULT_PASSWORD = 'password';

const checkCredential = async (username: string, password: string): Promise<boolean> => {
  const storedHash = await UserModel.getPasswordHash(username);
  if (storedHash) return verifyPassword(password, storedHash);
  return password === DEFAULT_PASSWORD;
};

export const AuthController = {
  async login(req: Request, res: Response) {
    const username = String(req.body?.username || '');
    const password = String(req.body?.password || '');
    const user = await UserModel.getByUsername(username);

    if (!user || !(await checkCredential(user.username, password))) {
      return ResponseView.sendError(res, 'Invalid username or password', 'Authentication failed', 401);
    }

    await UserModel.touchLastLogin(user.username);
    await AuditService.log({
      timestamp: new Date().toISOString(),
      userId: user.id,
      username: user.username,
      userRole: user.role,
      province: user.province,
      action: 'LOGIN',
      resource: 'Session',
      details: 'Signed in to the SIMS portal',
      clearanceLevel: user.clearanceLevel
    });

    const freshUser = (await UserModel.getByUsername(user.username)) || user;
    ResponseView.sendSuccess(res, {
      user: freshUser,
      permissions: getPermissionsForRole(freshUser.role),
      token: `mock-${freshUser.role}-token`
    }, 'Authenticated successfully');
  },

  async logout(_req: Request, res: Response) {
    ResponseView.sendSuccess(res, null, 'Logged out successfully');
  },

  async refreshToken(req: Request, res: Response) {
    const username = String(req.body?.username || '');
    const user = await UserModel.getByUsername(username);
    if (!user) {
      return ResponseView.sendError(res, 'User not found', 'Token refresh failed', 401);
    }

    ResponseView.sendSuccess(res, {
      user,
      permissions: getPermissionsForRole(user.role),
      token: `mock-${user.role}-token`
    }, 'Token refreshed successfully');
  },

  async profile(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return ResponseView.sendError(res, 'User identity not established', 'Unauthorized', 401);
    }

    ResponseView.sendSuccess(res, req.user, 'Fetched profile successfully');
  },

  async permissions(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return ResponseView.sendError(res, 'User identity not established', 'Unauthorized', 401);
    }

    ResponseView.sendSuccess(res, getPermissionsForRole(req.user.role), 'Fetched permissions successfully');
  },

  /**
   * Self-service profile update — contact number and designation only.
   * Identity fields (name, email, province, office, role, clearance) are
   * AD/HR-sourced (FR-005, FR-031) and cannot be changed here.
   */
  async updateProfile(req: AuthenticatedRequest, res: Response) {
    const user = req.user!;
    const fields: { phoneNumber?: string; jobTitle?: string } = {};

    if (req.body?.phoneNumber !== undefined) {
      const phone = String(req.body.phoneNumber).trim();
      if (phone && !/^[0-9+()\-\s/]{6,25}$/.test(phone)) {
        return ResponseView.sendError(res, 'Contact number may only contain digits, spaces and + ( ) - /', 'Validation failed', 400);
      }
      fields.phoneNumber = phone;
    }

    if (req.body?.jobTitle !== undefined) {
      const jobTitle = String(req.body.jobTitle).trim();
      if (jobTitle.length > 100) {
        return ResponseView.sendError(res, 'Designation must be 100 characters or fewer', 'Validation failed', 400);
      }
      fields.jobTitle = jobTitle;
    }

    if (Object.keys(fields).length === 0) {
      return ResponseView.sendError(res, 'No editable fields supplied (phoneNumber, jobTitle)', 'Validation failed', 400);
    }

    const success = await UserModel.updateProfile(user.username, fields);
    if (!success) {
      return ResponseView.sendError(res, 'Failed to update profile', 'Operation failed');
    }

    await AuditService.log({
      timestamp: new Date().toISOString(),
      userId: user.id,
      username: user.username,
      userRole: user.role,
      province: user.province,
      action: 'UPDATE',
      resource: 'User Profile',
      resourceId: user.id,
      details: `Updated own profile fields: ${Object.keys(fields).join(', ')}`,
      clearanceLevel: user.clearanceLevel
    });

    const updated = await UserModel.getByUsername(user.username);
    ResponseView.sendSuccess(res, updated, 'Profile updated successfully');
  },

  /**
   * Self-service profile photo upload. Accepts a base64 image, stores it in the
   * document store (Azure Blob in production, local disk in dev) and records the
   * storage path on the user's row. Replaces any existing photo.
   */
  async updateAvatar(req: AuthenticatedRequest, res: Response) {
    const user = req.user!;
    const { fileName, mimeType, dataBase64 } = req.body || {};

    if (!fileName || !dataBase64) {
      return ResponseView.sendError(res, 'fileName and dataBase64 are required', 'Validation failed', 400);
    }
    if (!FileStorageService.isAllowedImageName(fileName)) {
      return ResponseView.sendError(res, 'Profile photo must be an image (PNG, JPG, GIF, WEBP, BMP or HEIC)', 'Validation failed', 400);
    }

    let stored;
    try {
      stored = await FileStorageService.saveAvatar(user.username, fileName, dataBase64, mimeType);
    } catch (err: any) {
      return ResponseView.sendError(res, err.message || 'Failed to store profile photo', 'Validation failed', 400);
    }

    const success = await UserModel.updateAvatar(user.username, stored.storagePath);
    if (!success) {
      return ResponseView.sendError(res, 'Failed to update profile photo', 'Operation failed');
    }

    await AuditService.log({
      timestamp: new Date().toISOString(),
      userId: user.id,
      username: user.username,
      userRole: user.role,
      province: user.province,
      action: 'UPDATE',
      resource: 'User Profile',
      resourceId: user.id,
      details: `Updated own profile photo (${Math.max(1, Math.round(stored.fileSize / 1024))} KB)`,
      clearanceLevel: user.clearanceLevel
    });

    const updated = await UserModel.getByUsername(user.username);
    ResponseView.sendSuccess(res, updated, 'Profile photo updated successfully');
  },

  /** Stream the authenticated user's own profile photo back for <img> rendering. */
  async getAvatar(req: AuthenticatedRequest, res: Response) {
    const user = req.user!;
    const storagePath = user.avatarUrl;
    if (!storagePath) {
      return ResponseView.sendError(res, 'No profile photo set', 'Not found', 404);
    }
    if (!(await FileStorageService.exists(storagePath))) {
      return ResponseView.sendError(res, 'Stored profile photo is missing', 'Not found', 404);
    }

    res.setHeader('Content-Type', FileStorageService.contentTypeFor(storagePath));
    res.setHeader('Cache-Control', 'private, no-cache');
    try {
      const stream = await FileStorageService.openReadStream(storagePath);
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.end();
      });
      stream.pipe(res);
    } catch {
      return ResponseView.sendError(res, 'Failed to read profile photo', 'Operation failed');
    }
  },

  /**
   * Admin: stream a specific account's profile photo for <img> rendering on the
   * user management profile page. Gated on admin:manage_roles in the routes.
   */
  async getUserAvatar(req: AuthenticatedRequest, res: Response) {
    const target = await UserModel.getByUsername(String(req.params.username || ''));
    if (!target) {
      return ResponseView.sendError(res, 'User not found', 'Not found', 404);
    }
    const storagePath = target.avatarUrl;
    if (!storagePath) {
      return ResponseView.sendError(res, 'No profile photo set', 'Not found', 404);
    }
    if (!(await FileStorageService.exists(storagePath))) {
      return ResponseView.sendError(res, 'Stored profile photo is missing', 'Not found', 404);
    }

    res.setHeader('Content-Type', FileStorageService.contentTypeFor(storagePath));
    res.setHeader('Cache-Control', 'private, no-cache');
    try {
      const stream = await FileStorageService.openReadStream(storagePath);
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.end();
      });
      stream.pipe(res);
    } catch {
      return ResponseView.sendError(res, 'Failed to read profile photo', 'Operation failed');
    }
  },

  /**
   * Admin: upload/replace a specific account's profile photo. Same storage and
   * validation as the self-service path, but records the acting administrator as
   * the audit actor against the target user's record.
   */
  async updateUserAvatar(req: AuthenticatedRequest, res: Response) {
    const actor = req.user!;
    const { fileName, mimeType, dataBase64 } = req.body || {};

    const target = await UserModel.getByUsername(String(req.params.username || ''));
    if (!target) {
      return ResponseView.sendError(res, 'User not found', 'Not found', 404);
    }
    if (!fileName || !dataBase64) {
      return ResponseView.sendError(res, 'fileName and dataBase64 are required', 'Validation failed', 400);
    }
    if (!FileStorageService.isAllowedImageName(fileName)) {
      return ResponseView.sendError(res, 'Profile photo must be an image (PNG, JPG, GIF, WEBP, BMP or HEIC)', 'Validation failed', 400);
    }

    let stored;
    try {
      stored = await FileStorageService.saveAvatar(target.username, fileName, dataBase64, mimeType);
    } catch (err: any) {
      return ResponseView.sendError(res, err.message || 'Failed to store profile photo', 'Validation failed', 400);
    }

    const success = await UserModel.setAvatar(target.username, stored.storagePath);
    if (!success) {
      return ResponseView.sendError(res, 'Failed to update profile photo', 'Operation failed');
    }

    await AuditService.log({
      timestamp: new Date().toISOString(),
      userId: actor.id,
      username: actor.username,
      userRole: actor.role,
      province: actor.province,
      action: 'UPDATE',
      resource: 'User Profile',
      resourceId: target.id,
      details: `Updated profile photo for '${target.username}' (${Math.max(1, Math.round(stored.fileSize / 1024))} KB)`,
      clearanceLevel: actor.clearanceLevel
    });

    const updated = await UserModel.getByUsername(target.username);
    ResponseView.sendSuccess(res, updated, 'Profile photo updated successfully');
  },

  /** Notification preferences (FR-008 email + in-system alerts; FR-017 SLA reminders). */
  async updatePreferences(req: AuthenticatedRequest, res: Response) {
    const user = req.user!;
    const body = req.body || {};

    const preferences: UserPreferences = { ...DEFAULT_PREFERENCES, ...(user.preferences || {}) };
    for (const key of Object.keys(DEFAULT_PREFERENCES) as (keyof UserPreferences)[]) {
      if (body[key] !== undefined) preferences[key] = Boolean(body[key]);
    }

    const success = await UserModel.updatePreferences(user.username, preferences);
    if (!success) {
      return ResponseView.sendError(res, 'Failed to update preferences', 'Operation failed');
    }

    await AuditService.log({
      timestamp: new Date().toISOString(),
      userId: user.id,
      username: user.username,
      userRole: user.role,
      province: user.province,
      action: 'UPDATE',
      resource: 'User Preferences',
      resourceId: user.id,
      details: `Updated notification preferences: ${JSON.stringify(preferences)}`,
      clearanceLevel: user.clearanceLevel
    });

    const updated = await UserModel.getByUsername(user.username);
    ResponseView.sendSuccess(res, updated, 'Preferences updated successfully');
  },

  /** Passwords are AD-managed (FR-031) — self-service change is not offered in SIMS. */
  async changePassword(req: AuthenticatedRequest, res: Response) {
    const user = req.user!;
    await AuditService.log({
      timestamp: new Date().toISOString(),
      userId: user.id,
      username: user.username,
      userRole: user.role,
      province: user.province,
      action: 'ACCESS_DENIED',
      resource: 'User Password',
      resourceId: user.id,
      details: 'Password change rejected: credentials are managed by Azure Active Directory (FR-031)',
      clearanceLevel: user.clearanceLevel
    });
    return ResponseView.sendError(
      res,
      'Passwords are managed by Azure Active Directory. Use the departmental AD process or contact the ICT/MTS service desk to change your password.',
      'Not permitted',
      403
    );
  },

  /** The user's own recent audit-trail entries — shown on the profile Security tab (FR-035). */
  async myActivity(req: AuthenticatedRequest, res: Response) {
    const user = req.user!;
    const logs = await AuditService.getLogsForUser(user.username, 25);
    ResponseView.sendSuccess(res, logs, 'Fetched own activity successfully');
  },

  /**
   * Employee directory lookup for the incident form's "Report For: Others"
   * picker — any authenticated reporter may search by name or ID, but only
   * minimal identification fields are returned (POPIA need-to-know).
   */
  async lookupUsers(req: AuthenticatedRequest, res: Response) {
    const q = String(req.query?.q ?? '').trim();
    if (q.length < 2) {
      return ResponseView.sendSuccess(res, [], 'Enter at least 2 characters to search');
    }
    const matches = await UserModel.searchDirectory(q);
    ResponseView.sendSuccess(res, matches, 'Fetched employee directory matches');
  },

  async users(req: Request, res: Response) {
    // ?includeInactive=1 — admin user management also lists deactivated accounts
    const users = req.query?.includeInactive === '1'
      ? await UserModel.getAllForAdmin()
      : await UserModel.getAll();
    ResponseView.sendSuccess(res, users, 'Fetched users successfully');
  },

  async roles(_req: Request, res: Response) {
    const roles = Object.entries(ROLE_LABELS).map(([role, label]) => ({
      role,
      roleCode: ROLE_CODES[role as keyof typeof ROLE_CODES],
      label,
      permissions: getPermissionsForRole(role as keyof typeof ROLE_PERMISSIONS)
    }));
    ResponseView.sendSuccess(res, roles, 'Fetched roles successfully');
  },

  async allPermissions(_req: Request, res: Response) {
    const permissions = Array.from(new Set(Object.values(ROLE_PERMISSIONS).flat())).sort();
    ResponseView.sendSuccess(res, permissions, 'Fetched permissions successfully');
  },

  /**
   * Chief Security Director appoints an employee as temporary Security Coordinator
   * (leave cover). The acting coordinator gets the full rights of a permanent one.
   */
  async assignTempCoordinator(req: AuthenticatedRequest, res: Response) {
    const director = req.user!;
    const username = String(req.params.username || '').trim().toLowerCase();

    const target = await UserModel.getByUsername(username);
    if (!target) {
      return ResponseView.sendError(res, 'User not found', 'Operation failed', 404);
    }
    if (target.role !== 'employee' || target.baseRole) {
      return ResponseView.sendError(
        res,
        'Only an employee without an existing acting assignment can be made a temporary Security Coordinator',
        'Validation failed',
        400
      );
    }

    const success = await UserModel.assignTempCoordinator(username, director.username);
    if (!success) {
      return ResponseView.sendError(res, 'Failed to assign temporary coordinator', 'Operation failed');
    }

    await AuditService.log({
      timestamp: new Date().toISOString(),
      userId: director.id,
      username: director.username,
      userRole: director.role,
      province: director.province,
      action: 'UPDATE',
      resource: 'User Role',
      resourceId: target.id,
      details: `Appointed ${target.displayName} (${username}) as Temporary Security Coordinator for ${target.province}`,
      clearanceLevel: director.clearanceLevel
    });

    const updated = await UserModel.getByUsername(username);
    ResponseView.sendSuccess(res, updated, 'Temporary Security Coordinator assigned');
  },

  /** Revoke a temporary coordinator assignment — the user returns to their permanent role. */
  async revokeTempCoordinator(req: AuthenticatedRequest, res: Response) {
    const director = req.user!;
    const username = String(req.params.username || '').trim().toLowerCase();

    const target = await UserModel.getByUsername(username);
    if (!target) {
      return ResponseView.sendError(res, 'User not found', 'Operation failed', 404);
    }
    if (!target.baseRole) {
      return ResponseView.sendError(res, 'User has no temporary assignment to revoke', 'Validation failed', 400);
    }

    const success = await UserModel.revokeTempCoordinator(username);
    if (!success) {
      return ResponseView.sendError(res, 'Failed to revoke temporary assignment', 'Operation failed');
    }

    await AuditService.log({
      timestamp: new Date().toISOString(),
      userId: director.id,
      username: director.username,
      userRole: director.role,
      province: director.province,
      action: 'UPDATE',
      resource: 'User Role',
      resourceId: target.id,
      details: `Revoked Temporary Security Coordinator assignment for ${target.displayName} (${username}); restored role: ${target.baseRole}`,
      clearanceLevel: director.clearanceLevel
    });

    const updated = await UserModel.getByUsername(username);
    ResponseView.sendSuccess(res, updated, 'Temporary assignment revoked');
  }
};
