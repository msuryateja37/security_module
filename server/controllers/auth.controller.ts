import { Request, Response } from 'express';
import { getPermissionsForRole, getUserByUsername, ROLE_LABELS, ROLE_PERMISSIONS, ROLE_USERS } from '../security/roleAccess.js';
import { ResponseView } from '../views/response.view.js';
import { AuthenticatedRequest } from '../security/auth.middleware.js';

const PASSWORD = 'password';

export const AuthController = {
  async login(req: Request, res: Response) {
    const username = String(req.body?.username || '');
    const password = String(req.body?.password || '');
    const user = getUserByUsername(username);

    if (!user || password !== PASSWORD) {
      return ResponseView.sendError(res, 'Invalid username or password', 'Authentication failed', 401);
    }

    ResponseView.sendSuccess(res, {
      user,
      permissions: getPermissionsForRole(user.role),
      token: `mock-${user.role}-token`
    }, 'Authenticated successfully');
  },

  async logout(_req: Request, res: Response) {
    ResponseView.sendSuccess(res, null, 'Logged out successfully');
  },

  async refreshToken(req: Request, res: Response) {
    const username = String(req.body?.username || '');
    const user = getUserByUsername(username);
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

  async users(_req: Request, res: Response) {
    ResponseView.sendSuccess(res, ROLE_USERS, 'Fetched users successfully');
  },

  async roles(_req: Request, res: Response) {
    const roles = Object.entries(ROLE_LABELS).map(([role, label]) => ({
      role,
      label,
      permissions: getPermissionsForRole(role as keyof typeof ROLE_PERMISSIONS)
    }));
    ResponseView.sendSuccess(res, roles, 'Fetched roles successfully');
  },

  async allPermissions(_req: Request, res: Response) {
    const permissions = Array.from(new Set(Object.values(ROLE_PERMISSIONS).flat())).sort();
    ResponseView.sendSuccess(res, permissions, 'Fetched permissions successfully');
  }
};
