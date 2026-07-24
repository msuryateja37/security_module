import { execute, query, isMssql } from '../config/db.js';

export interface AuditLogEntry {
  id?: string;
  timestamp: string;
  userId: string;
  username: string;
  userRole: string;
  province: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'ESCALATE' | 'LOGIN' | 'LOGOUT' | 'ACCESS_DENIED' | 'ASSISTANT_QUERY';
  resource: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  clearanceLevel?: string;
}

export const AuditService = {
  async log(entry: AuditLogEntry): Promise<boolean> {
    const timestamp = entry.timestamp || new Date().toISOString();
    const id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    try {
      // Table is created at boot by db.ts (ensureAuditLogs* for each dialect)
      const result = await execute(
        `INSERT INTO audit_logs (
          id, timestamp, userId, username, userRole, province, action, resource, resourceId, details, ipAddress, clearanceLevel
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          timestamp,
          entry.userId || 'system',
          entry.username || 'system',
          entry.userRole || 'system',
          entry.province || 'National',
          entry.action,
          entry.resource,
          entry.resourceId || '',
          entry.details || '',
          entry.ipAddress || '127.0.0.1',
          entry.clearanceLevel || 'Restricted'
        ]
      );

      return result.changes !== undefined && result.changes > 0;
    } catch (err) {
      console.error('[AuditService Error]', err);
      return false;
    }
  },

  async getRecentLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    try {
      return await query<AuditLogEntry>(
        isMssql
          ? 'SELECT TOP (?) * FROM audit_logs ORDER BY timestamp DESC'
          : 'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?',
        [limit]
      );
    } catch (err) {
      console.error('[AuditService Query Error]', err);
      return [];
    }
  },

  /**
   * Server-side paginated + searchable log query (System Administrator > System Logs).
   * Replaces the old hard TOP 100 cap so the full immutable trail is browsable.
   */
  async getPaginated(opts: { page: number; pageSize: number; search?: string }): Promise<{ data: AuditLogEntry[]; total: number }> {
    const page = Math.max(1, opts.page);
    const pageSize = Math.max(1, opts.pageSize);
    const search = (opts.search || '').trim().toLowerCase();
    const where = search
      ? `WHERE (LOWER(username) LIKE ? OR LOWER(action) LIKE ? OR LOWER(resource) LIKE ? OR LOWER(details) LIKE ?)`
      : '';
    const like = `%${search}%`;
    const searchParams = search ? [like, like, like, like] : [];
    const offset = (page - 1) * pageSize;

    try {
      const countRows = await query<{ total: number }>(
        `SELECT COUNT(*) AS total FROM audit_logs ${where}`,
        searchParams
      );
      const total = countRows[0]?.total ?? 0;

      const rows = await query<AuditLogEntry>(
        isMssql
          ? `SELECT * FROM audit_logs ${where} ORDER BY timestamp DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`
          : `SELECT * FROM audit_logs ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
        isMssql ? [...searchParams, offset, pageSize] : [...searchParams, pageSize, offset]
      );
      return { data: rows, total };
    } catch (err) {
      console.error('[AuditService Paginated Query Error]', err);
      return { data: [], total: 0 };
    }
  },

  /** A user's own activity trail — powers the "Recent activity" section of the profile page. */
  async getLogsForUser(username: string, limit: number = 25): Promise<AuditLogEntry[]> {
    try {
      // No SQL LIMIT — keeps the query portable between SQLite and Azure SQL (TOP vs LIMIT)
      const rows = await query<AuditLogEntry>(
        'SELECT * FROM audit_logs WHERE username = ? ORDER BY timestamp DESC',
        [username]
      );
      return rows.slice(0, limit);
    } catch (err) {
      console.error('[AuditService Query Error]', err);
      return [];
    }
  }
};
