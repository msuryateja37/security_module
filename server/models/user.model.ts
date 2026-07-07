import { execute, query, queryOne } from '../config/db.js';
import {
  DEFAULT_DIRECTORATE,
  DEFAULT_PREFERENCES,
  LOGIN_ALIASES,
  ROLE_CODES,
  ROLE_LABELS,
  ROLE_USERS,
  SecurityRole,
  UserPreferences,
  UserProfile
} from '../security/roleAccess.js';

interface UserRow {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: SecurityRole;
  roleCode: string;
  roleLabel: string;
  province: string;
  office: string;
  clearanceLevel: UserProfile['clearanceLevel'];
  isActive: number | boolean;
  baseRole?: SecurityRole | null;
  tempAssignedBy?: string | null;
  persalNumber?: string | null;
  jobTitle?: string | null;
  phoneNumber?: string | null;
  directorate?: string | null;
  preferences?: string | null;
  passwordHash?: string | null;
  passwordChangedAt?: string | null;
  lastLoginAt?: string | null;
}

const parsePreferences = (raw: string | null | undefined): UserPreferences => {
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
};

// The password hash never leaves the model layer — profiles sent to the client exclude it.
const rowToProfile = (row: UserRow): UserProfile => ({
  id: row.id,
  username: row.username,
  displayName: row.displayName,
  email: row.email,
  role: row.role,
  roleCode: row.roleCode,
  roleLabel: row.roleLabel,
  province: row.province,
  office: row.office,
  clearanceLevel: row.clearanceLevel,
  baseRole: row.baseRole ?? null,
  tempAssignedBy: row.tempAssignedBy ?? null,
  persalNumber: row.persalNumber ?? '',
  jobTitle: row.jobTitle ?? row.roleLabel,
  phoneNumber: row.phoneNumber ?? '',
  directorate: row.directorate ?? DEFAULT_DIRECTORATE,
  lastLoginAt: row.lastLoginAt ?? null,
  passwordChangedAt: row.passwordChangedAt ?? null,
  preferences: parsePreferences(row.preferences)
});

export const UserModel = {
  // The users table is the system of record; the hardcoded ROLE_USERS list is
  // only the seed source and the fallback if the table is unreachable.
  async getAll(): Promise<UserProfile[]> {
    try {
      const rows = await query<UserRow>('SELECT * FROM users WHERE isActive = 1 ORDER BY displayName');
      if (rows.length > 0) return rows.map(rowToProfile);
    } catch (err) {
      console.error('[UserModel] Falling back to seed users:', err);
    }
    return ROLE_USERS;
  },

  async getByUsername(username: string): Promise<UserProfile | null> {
    const normalized = username.trim().toLowerCase();
    const canonical = LOGIN_ALIASES[normalized] || normalized;
    try {
      const rows = await query<UserRow>('SELECT * FROM users WHERE username = ? AND isActive = 1', [canonical]);
      if (rows.length > 0) return rowToProfile(rows[0]);
    } catch (err) {
      console.error('[UserModel] Falling back to seed users:', err);
    }
    return ROLE_USERS.find(u => u.username === canonical) || null;
  },

  /**
   * Chief Director appoints an employee as temporary Security Coordinator
   * (e.g. leave cover). The permanent role is preserved in baseRole; the acting
   * coordinator receives the full rights of a permanent Security Coordinator.
   */
  async assignTempCoordinator(username: string, assignedBy: string): Promise<boolean> {
    const result = await execute(
      `UPDATE users
       SET baseRole = role,
           role = 'security_coordinator',
           roleCode = ?,
           roleLabel = ?,
           tempAssignedBy = ?
       WHERE username = ? AND isActive = 1 AND baseRole IS NULL AND role = 'employee'`,
      [ROLE_CODES.security_coordinator, 'Temporary Security Coordinator', assignedBy, username]
    );
    return result.changes > 0;
  },

  /**
   * Self-service profile update. Only contact/designation fields are editable —
   * identity fields (name, email, province, office, role, clearance) are
   * AD/HR-sourced (FR-005) and administrator-managed.
   */
  async updateProfile(username: string, fields: { phoneNumber?: string; jobTitle?: string }): Promise<boolean> {
    const sets: string[] = [];
    const params: any[] = [];
    if (fields.phoneNumber !== undefined) {
      sets.push('phoneNumber = ?');
      params.push(fields.phoneNumber);
    }
    if (fields.jobTitle !== undefined) {
      sets.push('jobTitle = ?');
      params.push(fields.jobTitle);
    }
    if (sets.length === 0) return false;

    params.push(username);
    const result = await execute(
      `UPDATE users SET ${sets.join(', ')} WHERE username = ? AND isActive = 1`,
      params
    );
    return result.changes > 0;
  },

  async updatePreferences(username: string, preferences: UserPreferences): Promise<boolean> {
    const result = await execute(
      'UPDATE users SET preferences = ? WHERE username = ? AND isActive = 1',
      [JSON.stringify(preferences), username]
    );
    return result.changes > 0;
  },

  /** Stored credential hash for the pre-SSO portal login; null when the account still uses the seed default. */
  async getPasswordHash(username: string): Promise<string | null> {
    const normalized = username.trim().toLowerCase();
    const canonical = LOGIN_ALIASES[normalized] || normalized;
    try {
      const row = await queryOne<{ passwordHash: string | null }>(
        'SELECT passwordHash FROM users WHERE username = ? AND isActive = 1',
        [canonical]
      );
      return row?.passwordHash ?? null;
    } catch (err) {
      console.error('[UserModel] Failed to read credential:', err);
      return null;
    }
  },

  async setPassword(username: string, passwordHash: string): Promise<boolean> {
    const result = await execute(
      'UPDATE users SET passwordHash = ?, passwordChangedAt = ? WHERE username = ? AND isActive = 1',
      [passwordHash, new Date().toISOString(), username]
    );
    return result.changes > 0;
  },

  async touchLastLogin(username: string): Promise<void> {
    try {
      await execute('UPDATE users SET lastLoginAt = ? WHERE username = ?', [new Date().toISOString(), username]);
    } catch (err) {
      console.error('[UserModel] Failed to record last login:', err);
    }
  },

  /** Revoke a temporary coordinator assignment — the user returns to their permanent role. */
  async revokeTempCoordinator(username: string): Promise<boolean> {
    const user = await this.getByUsername(username);
    if (!user || !user.baseRole) return false;

    const result = await execute(
      `UPDATE users
       SET role = baseRole,
           roleCode = ?,
           roleLabel = ?,
           baseRole = NULL,
           tempAssignedBy = NULL
       WHERE username = ? AND baseRole IS NOT NULL`,
      [ROLE_CODES[user.baseRole], ROLE_LABELS[user.baseRole], username]
    );
    return result.changes > 0;
  }
};
