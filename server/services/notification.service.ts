import { execute, query } from '../config/db.js';
import { UserModel } from '../models/user.model.js';
import { DEFAULT_PREFERENCES } from '../security/roleAccess.js';
import { EmailService } from './email.service.js';

// Persisted in-app notifications + email fan-out (FR-008, NFR-006 ≤2 min delivery).
// Notifications are written synchronously on the triggering request; email delivery
// honours the recipient's emailNotifications preference.

export interface NotificationRow {
  id: string;
  username: string;
  title: string;
  message: string;
  link: string | null;
  isRead: number | boolean;
  dateCreated: string;
}

export const NotificationService = {
  /**
   * Notify a user in-app and by email. Never throws — a notification failure
   * must not fail the business action that triggered it.
   */
  async notify(username: string, title: string, message: string, link?: string): Promise<void> {
    try {
      const user = await UserModel.getByUsername(username);
      if (!user) {
        console.warn(`[NotificationService] Unknown recipient '${username}' for "${title}"`);
        return;
      }
      const prefs = { ...DEFAULT_PREFERENCES, ...user.preferences };

      if (prefs.inAppNotifications) {
        const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await execute(
          `INSERT INTO notifications (id, username, title, message, link, isRead, dateCreated)
           VALUES (?, ?, ?, ?, ?, 0, ?)`,
          [id, user.username, title, message, link || null, new Date().toISOString()]
        );
      }

      if (user.email) {
        // Fire-and-forget — SMTP latency must not block the API response
        void EmailService.send(user.email, title, `Dear ${user.displayName},\n\n${message}\n\nSIMS — Security Incident Management System\nThis is an automated message; do not reply.`);
      }
    } catch (err) {
      console.error('[NotificationService] notify failed:', err);
    }
  },

  async notifyMany(usernames: string[], title: string, message: string, link?: string): Promise<void> {
    for (const username of new Set(usernames)) {
      await this.notify(username, title, message, link);
    }
  },

  async getForUser(username: string, limit = 30): Promise<NotificationRow[]> {
    try {
      // No SQL LIMIT — keeps the query portable between SQLite and Azure SQL (TOP vs LIMIT)
      const rows = await query<NotificationRow>(
        'SELECT * FROM notifications WHERE username = ? ORDER BY dateCreated DESC',
        [username]
      );
      return rows.slice(0, limit);
    } catch (err) {
      console.error('[NotificationService] getForUser failed:', err);
      return [];
    }
  },

  async markRead(username: string, id: string): Promise<boolean> {
    const result = await execute(
      'UPDATE notifications SET isRead = 1 WHERE id = ? AND username = ?',
      [id, username]
    );
    return result.changes > 0;
  },

  async markAllRead(username: string): Promise<void> {
    await execute('UPDATE notifications SET isRead = 1 WHERE username = ?', [username]);
  }
};
