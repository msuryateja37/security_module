import { execute, query } from '../config/db.js';

export interface AuditLogEntry {
  id?: string;
  timestamp: string;
  userId: string;
  username: string;
  userRole: string;
  province: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'ESCALATE' | 'LOGIN' | 'LOGOUT' | 'ACCESS_DENIED';
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
      // Create audit logs table if not exists
      await execute(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          userId TEXT NOT NULL,
          username TEXT NOT NULL,
          userRole TEXT NOT NULL,
          province TEXT,
          action TEXT NOT NULL,
          resource TEXT NOT NULL,
          resourceId TEXT,
          details TEXT,
          ipAddress TEXT,
          clearanceLevel TEXT
        )
      `);

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
        'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?',
        [limit]
      );
    } catch (err) {
      console.error('[AuditService Query Error]', err);
      return [];
    }
  }
};
