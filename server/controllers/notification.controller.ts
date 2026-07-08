import { Response } from 'express';
import { AuthenticatedRequest } from '../security/auth.middleware.js';
import { NotificationService } from '../services/notification.service.js';
import { ResponseView } from '../views/response.view.js';

export const NotificationController = {
  /** The signed-in user's own notification feed (newest first). */
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const notifications = await NotificationService.getForUser(user.username);
      ResponseView.sendSuccess(res, notifications, 'Fetched notifications successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch notifications');
    }
  },

  async markRead(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const id = String(req.params.id || '');
      const success = await NotificationService.markRead(user.username, id);
      if (!success) {
        return ResponseView.sendError(res, 'Notification not found', 'Operation failed', 404);
      }
      ResponseView.sendSuccess(res, null, 'Notification marked as read');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to mark notification as read');
    }
  },

  async markAllRead(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      await NotificationService.markAllRead(user.username);
      ResponseView.sendSuccess(res, null, 'All notifications marked as read');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to mark notifications as read');
    }
  }
};
