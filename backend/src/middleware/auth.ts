import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { RequestContext, AuthenticatedUser } from '../types';
import { permissionService } from '../services/permissionService';
import { auditService } from '../services/auditService';
import { featureFlags } from '../features/flags';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface AuthenticatedRequest extends Request {
  context?: RequestContext;
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Load user permissions if advanced permissions are enabled
    let permissions = undefined;
    if (featureFlags.isEnabled('advanced_permissions', { user: { id: user.id } })) {
      try {
        permissions = await permissionService.getUserPermissions(user.id, user.workspaceId);
      } catch (error) {
        console.error('Failed to load user permissions:', error);
      }
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      workspaceId: user.workspaceId,
      permissions,
    };

    req.context = {
      user: authenticatedUser,
      workspaceId: user.workspaceId,
    };

    // Log successful authentication
    if (featureFlags.isEnabled('audit_trails')) {
      await auditService.logLogin(
        user.id,
        user.workspaceId,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown'
      );
    }

    next();
  });
};

export const optionalAuthenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
      if (!err) {
        // Load user permissions if advanced permissions are enabled
        let permissions = undefined;
        if (featureFlags.isEnabled('advanced_permissions', { user: { id: user.id } })) {
          try {
            permissions = await permissionService.getUserPermissions(user.id, user.workspaceId);
          } catch (error) {
            console.error('Failed to load user permissions:', error);
          }
        }

        const authenticatedUser: AuthenticatedUser = {
          id: user.id,
          email: user.email,
          role: user.role || 'user',
          workspaceId: user.workspaceId,
          permissions,
        };

        req.context = {
          user: authenticatedUser,
          workspaceId: user.workspaceId,
        };
      }
    });
  }

  next();
};

export const requirePermission = (resource: string, action: string = 'read') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.context?.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { user, workspaceId } = req.context;

    // Check permissions using the permission service
    const hasPermission = await permissionService.hasPermission(
      user.id,
      workspaceId!,
      resource,
      action
    );

    if (!hasPermission) {
      // Log permission denial
      if (featureFlags.isEnabled('audit_trails')) {
        await auditService.logDataAccess(
          user.id,
          workspaceId!,
          resource,
          req.params.id || 'unknown',
          `${action}_denied`
        );
      }

      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Log successful permission check
    if (featureFlags.isEnabled('audit_trails')) {
      await auditService.logDataAccess(
        user.id,
        workspaceId!,
        resource,
        req.params.id || 'unknown',
        action
      );
    }

    next();
  };
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.context?.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const requireWorkspaceAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.context?.workspaceId) {
    return res.status(403).json({ error: 'Workspace access required' });
  }
  next();
};