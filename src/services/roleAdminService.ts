import { supabase, isSupabaseConfigured } from './supabaseService';
import { isDemoMode } from '../config/demoMode';
import { PERMISSION_ACTIONS, ROLE_NAMES, roleCapability, type PermissionAction, type RoleName } from './permissionService';

/**
 * Role administration (admin only; the RPCs enforce that server side, the UI only hides what would be refused).
 * `roles.permissions` is a jsonb ARRAY of PermissionAction strings. Objects ({action: true}) are read too.
 */
export interface RoleRow { id: string; name: string; description: string | null; permissions: PermissionAction[]; is_system_role: boolean; workspace_id: string | null }
export interface MemberRow { user_id: string; name: string; role_ids: string[] }

export const ACTION_LABEL: Record<PermissionAction, string> = {
  view: 'View records', create: 'Create records', edit: 'Edit records', delete: 'Delete records', bulk: 'Bulk actions',
  manage_stages: 'Manage stages', manage_workflows: 'Manage workflows', manage_views: 'Manage views',
  import: 'Import', export: 'Export', assign: 'Assign owners', manage_roles: 'Manage roles',
};

const isAction = (v: unknown): v is PermissionAction => (PERMISSION_ACTIONS as readonly string[]).includes(String(v));

/** Reads the stored jsonb (array of strings, or an object of booleans) into a canonical ordered list. */
export function parsePermissions(raw: unknown): PermissionAction[] {
  let found: string[] = [];
  if (Array.isArray(raw)) found = raw.map(String);
  else if (raw && typeof raw === 'object') found = Object.entries(raw as Record<string, unknown>).filter(([, v]) => v === true).map(([k]) => k);
  return PERMISSION_ACTIONS.filter(a => found.includes(a));
}

/** Canonical (ordered, de-duplicated, known-only) list to send to set_role_permissions. */
export const serializePermissions = (set: Iterable<PermissionAction>): PermissionAction[] => {
  const s = new Set(set);
  return PERMISSION_ACTIONS.filter(a => s.has(a));
};

/** Built-in capability list for a role name ("own only" counts as granted). */
export function defaultPermissions(role: RoleName): PermissionAction[] {
  return PERMISSION_ACTIONS.filter(a => roleCapability(role, a) !== false);
}

export const toggled = (perms: PermissionAction[], action: PermissionAction, on: boolean): PermissionAction[] =>
  serializePermissions(on ? [...perms, action] : perms.filter(a => a !== action));

export interface PermissionChange { action: PermissionAction; granted: boolean }
export function diffPermissions(before: PermissionAction[], after: PermissionAction[]): PermissionChange[] {
  const b = new Set(before); const a = new Set(after);
  return PERMISSION_ACTIONS.flatMap(act => (b.has(act) === a.has(act) ? [] : [{ action: act, granted: a.has(act) }]));
}

/** The admin role is fixed (the SQL refuses to edit it). */
export const isLockedRole = (r: Pick<RoleRow, 'name'>): boolean => r.name.trim().toLowerCase() === 'admin';

/** Whether removing `userId` from `roleId` would leave the admin role without anyone. */
export function wouldRemoveLastAdmin(roles: RoleRow[], members: MemberRow[], roleId: string): boolean {
  const role = roles.find(r => r.id === roleId);
  if (!role || role.name.toLowerCase() !== 'admin') return false;
  return members.filter(m => m.role_ids.includes(roleId)).length <= 1;
}

// ---- demo / local store ------------------------------------------------------------------------------------
const demoRoles = (): RoleRow[] => ROLE_NAMES.map(n => ({ id: `demo-role-${n}`, name: n, description: null, permissions: defaultPermissions(n), is_system_role: true, workspace_id: null }));
let localRoles: RoleRow[] | null = null;
let localMembers: MemberRow[] | null = null;
export const __resetLocalRoles = (): void => { localRoles = null; localMembers = null; };
const remote = (): boolean => isSupabaseConfigured && !isDemoMode();

export async function listRoles(): Promise<RoleRow[]> {
  if (!remote()) return (localRoles ??= demoRoles()).map(r => ({ ...r }));
  const { data, error } = await supabase.from('roles').select('id,name,description,permissions,is_system_role,workspace_id').order('name');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, permissions: parsePermissions(r.permissions) }));
}

export async function listMembers(): Promise<MemberRow[]> {
  if (!remote()) {
    if (!localMembers) {
      const { usersFromDeals } = await import('./userDirectoryService');
      localMembers = usersFromDeals().map(u => ({ user_id: u.id, name: u.name, role_ids: [`demo-role-member`] }));
      localMembers.unshift({ user_id: 'demo-user-me', name: 'You (demo admin)', role_ids: ['demo-role-admin'] });
    }
    return localMembers.map(m => ({ ...m, role_ids: [...m.role_ids] }));
  }
  const [ur, pr] = await Promise.all([
    supabase.from('user_roles').select('user_id,role_id'),
    supabase.from('profiles').select('id,name'),
  ]);
  if (ur.error) throw ur.error;
  const names = new Map<string, string>(((pr.data ?? []) as any[]).map((p: any): [string, string] => [p.id, p.name || '']));
  const byUser = new Map<string, MemberRow>();
  for (const r of (ur.data ?? []) as any[]) {
    const m: MemberRow = byUser.get(r.user_id) ?? { user_id: r.user_id, name: names.get(r.user_id) || `User ${String(r.user_id).slice(0, 8)}`, role_ids: [] as string[] };
    m.role_ids.push(r.role_id);
    byUser.set(r.user_id, m);
  }
  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveRolePermissions(roleId: string, permissions: PermissionAction[]): Promise<void> {
  if (!remote()) {
    localRoles = (localRoles ??= demoRoles()).map(r => (r.id === roleId ? { ...r, permissions: serializePermissions(permissions) } : r));
    return;
  }
  const { error } = await supabase.rpc('set_role_permissions', { p_role_id: roleId, p_permissions: serializePermissions(permissions) });
  if (error) throw error;
}

export async function assignRole(userId: string, roleId: string): Promise<void> {
  if (!remote()) {
    localMembers = (localMembers ?? []).map(m => (m.user_id === userId && !m.role_ids.includes(roleId) ? { ...m, role_ids: [...m.role_ids, roleId] } : m));
    return;
  }
  const { error } = await supabase.rpc('assign_user_role', { p_user_id: userId, p_role_id: roleId });
  if (error) throw error;
}

export async function removeRole(userId: string, roleId: string): Promise<void> {
  if (!remote()) {
    localMembers = (localMembers ?? []).map(m => (m.user_id === userId ? { ...m, role_ids: m.role_ids.filter(r => r !== roleId) } : m));
    return;
  }
  const { error } = await supabase.rpc('remove_user_role', { p_user_id: userId, p_role_id: roleId });
  if (error) throw error;
}
