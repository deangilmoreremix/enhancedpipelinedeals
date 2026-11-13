/**
 * Pure permission model (no I/O). Roles, actions, entity kinds and the default matrix.
 * Enforcement of record: Supabase RLS. This layer only hides/disables UI and explains denials.
 */

export type RoleName = 'admin' | 'manager' | 'member' | 'viewer';
export const ROLE_NAMES: readonly RoleName[] = ['admin', 'manager', 'member', 'viewer'];

export type PermissionAction =
  | 'view' | 'create' | 'edit' | 'delete' | 'bulk'
  | 'manage_stages' | 'manage_workflows' | 'manage_views'
  | 'import' | 'export' | 'assign' | 'manage_roles';

export const PERMISSION_ACTIONS: readonly PermissionAction[] = [
  'view', 'create', 'edit', 'delete', 'bulk', 'manage_stages', 'manage_workflows',
  'manage_views', 'import', 'export', 'assign', 'manage_roles',
];

export type EntityKind = 'deal' | 'contact' | 'company' | 'note' | 'task' | 'file' | 'workflow' | 'stage' | 'view';

export type RlsMode = 'open' | 'workspace';

/** Record shape understood by the ownership checks (camelCase app models or snake_case rows). */
export interface PermissionRecord {
  ownerId?: string | null;
  assignedToId?: string | null;
  createdBy?: string | null;
  owner_id?: string | null;
  assigned_to_id?: string | null;
  created_by?: string | null;
  user_id?: string | null;
  workspaceId?: string | null;
  workspace_id?: string | null;
}

export interface PermissionUser {
  id: string | null;
  role: RoleName;
  workspaceId?: string | null;
}

export interface PermissionContext {
  /** null when nobody is signed in */
  user: PermissionUser | null;
  rlsMode: RlsMode;
  demo: boolean;
}

export interface PermissionResult {
  allowed: boolean;
  reason: string;
}

/** Whether `member` may manage pipeline stages / workflows. Flip to true to let members configure them. */
export const MEMBER_PERMISSIONS = {
  manage_stages: false,
  manage_workflows: false,
  manage_views: true,
} as const;

/** Actions that members may perform only on records they own / are assigned to / created. */
const MEMBER_OWN_ONLY: readonly PermissionAction[] = ['edit', 'delete', 'bulk'];

const ALLOW = (reason: string): PermissionResult => ({ allowed: true, reason });
const DENY = (reason: string): PermissionResult => ({ allowed: false, reason });

export function normalizeRole(role: unknown): RoleName {
  const r = String(role ?? '').toLowerCase().trim();
  if ((ROLE_NAMES as readonly string[]).includes(r)) return r as RoleName;
  // Legacy authService roles
  if (r === 'owner' || r === 'administrator') return 'admin';
  if (r === 'user') return 'member';
  if (r === 'agent' || r === 'readonly' || r === 'read_only' || r === 'read-only') return 'viewer';
  return 'member';
}

/** True when the record is owned by / assigned to / created by `userId`. */
export function isOwnRecord(
  userId: string | null | undefined,
  record?: PermissionRecord | null,
  userWorkspaceId?: string | null,
): boolean {
  if (!userId || !record) return false;
  // A record from another workspace is never "own", whatever its owner fields say (mirrors RLS)
  const recWs = record.workspaceId ?? record.workspace_id;
  if (userWorkspaceId && recWs && recWs !== userWorkspaceId) return false;
  const ids = [
    record.ownerId, record.owner_id, record.assignedToId, record.assigned_to_id,
    record.createdBy, record.created_by, record.user_id,
  ];
  return ids.some(v => v != null && v === userId);
}

/** Role-only matrix lookup (ignores ownership). `'own'` means ownership required. */
export function roleCapability(role: RoleName, action: PermissionAction): boolean | 'own' {
  switch (role) {
    case 'admin':
      return true;
    case 'manager':
      return action !== 'manage_roles';
    case 'member':
      if (action === 'view' || action === 'create' || action === 'import' || action === 'export' || action === 'assign') return true;
      if (MEMBER_OWN_ONLY.includes(action)) return 'own';
      if (action === 'manage_stages') return MEMBER_PERMISSIONS.manage_stages;
      if (action === 'manage_workflows') return MEMBER_PERMISSIONS.manage_workflows;
      if (action === 'manage_views') return MEMBER_PERMISSIONS.manage_views;
      return false;
    case 'viewer':
      return action === 'view' || action === 'export';
  }
}

/**
 * Core check. Everything is allowed in demo mode, with no signed-in user, or when RLS mode is 'open'
 * so the app behaves exactly as before until an admin opts in to workspace enforcement.
 */
export function can(
  ctx: PermissionContext,
  action: PermissionAction,
  kind: EntityKind,
  record?: PermissionRecord | null,
): PermissionResult {
  if (ctx.demo) return ALLOW('Demo mode');
  if (!ctx.user || !ctx.user.id) return ALLOW('Not signed in (open access)');
  if (ctx.rlsMode === 'open') return ALLOW('RLS mode is open');

  const { user } = ctx;
  const cap = roleCapability(user.role, action);
  if (cap === true) return ALLOW(`${user.role} role`);
  if (cap === false) return DENY(`Your ${user.role} role can't ${action.replace(/_/g, ' ')} ${kind}s`);

  // Ownership required
  if (!record) return ALLOW(`${user.role} can ${action} own ${kind}s`); // no record context: UI-level optimistic allow (RLS decides)
  if (isOwnRecord(user.id, record, user.workspaceId)) return ALLOW(`You own this ${kind}`);
  return DENY(`You can only ${action} ${kind}s you own or are assigned to`);
}

/** Convenience: all records must pass. Empty list passes the role-level check. */
export function canAll(
  ctx: PermissionContext,
  action: PermissionAction,
  kind: EntityKind,
  records: Array<PermissionRecord | null | undefined>,
): PermissionResult {
  if (records.length === 0) return can(ctx, action, kind);
  for (const r of records) {
    const res = can(ctx, action, kind, r ?? undefined);
    if (!res.allowed) return res;
  }
  return ALLOW('Allowed for all selected records');
}

/** Read-only matrix for the Settings UI. */
export function describeMatrix(): Array<{ role: RoleName; caps: Record<PermissionAction, boolean | 'own'> }> {
  return ROLE_NAMES.map(role => ({
    role,
    caps: Object.fromEntries(PERMISSION_ACTIONS.map(a => [a, roleCapability(role, a)])) as Record<PermissionAction, boolean | 'own'>,
  }));
}
