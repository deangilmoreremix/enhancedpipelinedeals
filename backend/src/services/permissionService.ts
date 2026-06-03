import { supabase } from './database';
import { Permission, Role, UserRole, PermissionLevel, PermissionScope } from '../types';
import { featureFlags } from '../features/flags';

export class PermissionService {
  /**
   * Check if a user has permission for a specific action on a resource
   */
  async hasPermission(
    userId: string,
    workspaceId: string,
    resource: string,
    action: string,
    scope?: PermissionScope,
    resourceId?: string
  ): Promise<boolean> {
    if (!featureFlags.isEnabled('advanced_permissions', { user: { id: userId } })) {
      // Fallback to basic role check
      return this.hasBasicPermission(userId, workspaceId, action);
    }

    const userRoles = await this.getUserRoles(userId, workspaceId);
    if (userRoles.length === 0) return false;

    // Check if any role grants the required permission
    for (const userRole of userRoles) {
      const role = await this.getRoleById(userRole.roleId);
      if (!role) continue;

      const hasPermission = this.checkRolePermission(role, resource, action, scope, resourceId);
      if (hasPermission) return true;
    }

    return false;
  }

  /**
   * Get all permissions for a user in a workspace
   */
  async getUserPermissions(userId: string, workspaceId: string): Promise<Permission[]> {
    const userRoles = await this.getUserRoles(userId, workspaceId);
    const permissions: Permission[] = [];

    for (const userRole of userRoles) {
      const role = await this.getRoleById(userRole.roleId);
      if (role) {
        permissions.push(...role.permissions);
      }
    }

    // Remove duplicates
    return permissions.filter((permission, index, self) =>
      index === self.findIndex(p => p.id === permission.id)
    );
  }

  /**
   * Create a new role
   */
  async createRole(
    name: string,
    description: string,
    permissions: Permission[],
    workspaceId?: string,
    createdBy: string
  ): Promise<Role> {
    const role: Role = {
      id: crypto.randomUUID(),
      name,
      description,
      permissions,
      isSystemRole: false,
      workspaceId,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { error } = await supabase
      .from('roles')
      .insert([{
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        is_system_role: role.isSystemRole,
        workspace_id: role.workspaceId,
        created_by: role.createdBy,
        created_at: role.createdAt.toISOString(),
        updated_at: role.updatedAt.toISOString(),
      }]);

    if (error) throw error;
    return role;
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(
    userId: string,
    roleId: string,
    workspaceId: string,
    assignedBy: string,
    expiresAt?: Date
  ): Promise<UserRole> {
    const userRole: UserRole = {
      userId,
      roleId,
      workspaceId,
      assignedBy,
      assignedAt: new Date(),
      expiresAt,
    };

    const { error } = await supabase
      .from('user_roles')
      .upsert([{
        user_id: userRole.userId,
        role_id: userRole.roleId,
        workspace_id: userRole.workspaceId,
        assigned_by: userRole.assignedBy,
        assigned_at: userRole.assignedAt.toISOString(),
        expires_at: userRole.expiresAt?.toISOString(),
      }]);

    if (error) throw error;
    return userRole;
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(userId: string, roleId: string, workspaceId: string): Promise<void> {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .eq('workspace_id', workspaceId);

    if (error) throw error;
  }

  /**
   * Get roles for a user in a workspace
   */
  async getUserRoles(userId: string, workspaceId: string): Promise<UserRole[]> {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .is('expires_at', null) // Only active roles
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (error) throw error;

    return data.map(row => ({
      userId: row.user_id,
      roleId: row.role_id,
      workspaceId: row.workspace_id,
      assignedBy: row.assigned_by,
      assignedAt: new Date(row.assigned_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    }));
  }

  /**
   * Get role by ID
   */
  async getRoleById(roleId: string): Promise<Role | null> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .single();

    if (error) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      permissions: data.permissions || [],
      isSystemRole: data.is_system_role,
      workspaceId: data.workspace_id,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Get all roles for a workspace
   */
  async getWorkspaceRoles(workspaceId: string): Promise<Role[]> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`);

    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      permissions: row.permissions || [],
      isSystemRole: row.is_system_role,
      workspaceId: row.workspace_id,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Check if a role has permission for an action
   */
  private checkRolePermission(
    role: Role,
    resource: string,
    action: string,
    scope: PermissionScope,
    resourceId?: string
  ): boolean {
    return role.permissions.some(permission => {
      if (permission.resource !== resource && permission.resource !== '*') return false;
      if (permission.scope !== scope && permission.scope !== 'global') return false;

      // Check permission level
      const actionLevel = this.getActionLevel(action);
      const permissionLevel = this.getPermissionLevelValue(permission.level);

      return permissionLevel >= actionLevel;
    });
  }

  /**
   * Map action to permission level
   */
  private getActionLevel(action: string): number {
    switch (action) {
      case 'read': return 1;
      case 'write': return 2;
      case 'delete': return 3;
      case 'admin': return 4;
      default: return 1;
    }
  }

  /**
   * Get numeric value for permission level
   */
  private getPermissionLevelValue(level: PermissionLevel): number {
    switch (level) {
      case 'read': return 1;
      case 'write': return 2;
      case 'delete': return 3;
      case 'admin': return 4;
      default: return 0;
    }
  }

  /**
   * Basic permission check (fallback when advanced permissions are disabled)
   */
  private async hasBasicPermission(userId: string, workspaceId: string, action: string): Promise<boolean> {
    // Simple admin check - in real implementation, this would check user roles
    // This is a fallback for when advanced permissions are not enabled
    return true; // Allow all actions for now
  }

  /**
   * Initialize default roles
   */
  async initializeDefaultRoles(workspaceId: string): Promise<void> {
    const defaultRoles = [
      {
        name: 'Admin',
        description: 'Full access to all resources',
        permissions: [
          {
            id: crypto.randomUUID(),
            resource: '*',
            scope: 'global' as PermissionScope,
            level: 'admin' as PermissionLevel,
          },
        ],
      },
      {
        name: 'Sales Manager',
        description: 'Manage deals and team performance',
        permissions: [
          {
            id: crypto.randomUUID(),
            resource: 'deals',
            scope: 'workspace' as PermissionScope,
            level: 'write' as PermissionLevel,
          },
          {
            id: crypto.randomUUID(),
            resource: 'contacts',
            scope: 'workspace' as PermissionScope,
            level: 'write' as PermissionLevel,
          },
          {
            id: crypto.randomUUID(),
            resource: 'reports',
            scope: 'workspace' as PermissionScope,
            level: 'read' as PermissionLevel,
          },
        ],
      },
      {
        name: 'Sales Rep',
        description: 'Manage own deals and contacts',
        permissions: [
          {
            id: crypto.randomUUID(),
            resource: 'deals',
            scope: 'record' as PermissionScope,
            level: 'write' as PermissionLevel,
            conditions: [{ field: 'assigned_to_id', operator: 'equals' as const, value: '${user.id}' }],
          },
          {
            id: crypto.randomUUID(),
            resource: 'contacts',
            scope: 'workspace' as PermissionScope,
            level: 'write' as PermissionLevel,
          },
        ],
      },
      {
        name: 'Read Only',
        description: 'View-only access to deals and contacts',
        permissions: [
          {
            id: crypto.randomUUID(),
            resource: 'deals',
            scope: 'workspace' as PermissionScope,
            level: 'read' as PermissionLevel,
          },
          {
            id: crypto.randomUUID(),
            resource: 'contacts',
            scope: 'workspace' as PermissionScope,
            level: 'read' as PermissionLevel,
          },
        ],
      },
    ];

    for (const roleData of defaultRoles) {
      await this.createRole(
        roleData.name,
        roleData.description,
        roleData.permissions,
        workspaceId,
        'system'
      );
    }
  }
}

export const permissionService = new PermissionService();