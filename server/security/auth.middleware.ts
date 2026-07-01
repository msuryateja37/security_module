import { Request, Response, NextFunction } from 'express';
import { getPermissionsForRole, getUserByUsername, Permission, SecurityRole, UserProfile } from './roleAccess.js';
import { ResponseView } from '../views/response.view.js';
import { AuditService } from './audit.service.js';

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

export const authenticateUser = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const usernameHeader = req.headers['x-username'] as string;
  const roleHeader = req.headers['x-user-role'] as SecurityRole;

  if (usernameHeader) {
    const user = getUserByUsername(usernameHeader);

    if (!user) {
      return ResponseView.sendError(res, 'Unknown user identity', 'Unauthorized', 401);
    }

    if (roleHeader && roleHeader !== user.role) {
      return ResponseView.sendError(res, 'User role does not match authenticated identity', 'Forbidden', 403);
    }

    req.user = user;
  }

  next();
};

export const requirePermission = (...requiredPermissions: Permission[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return ResponseView.sendError(res, 'User identity not established', 'Unauthorized', 401);
    }

    const userPermissions = getPermissionsForRole(req.user.role);
    const hasPermission = requiredPermissions.every(p => userPermissions.includes(p));

    if (!hasPermission) {
      // Log access denial to Audit Trail
      await AuditService.log({
        timestamp: new Date().toISOString(),
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        province: req.user.province,
        action: 'ACCESS_DENIED',
        resource: req.originalUrl,
        details: `Attempted to access ${req.originalUrl} without permissions: ${requiredPermissions.join(', ')}`,
        clearanceLevel: req.user.clearanceLevel
      });

      return ResponseView.sendError(
        res,
        `Access denied. Required permissions: ${requiredPermissions.join(', ')}`,
        'Forbidden',
        403
      );
    }

    next();
  };
};
