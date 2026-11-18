import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
jest.mock('../services/supabaseService', () => ({ supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/userDirectoryService', () => ({ usersFromDeals: () => [{ id: 'u1', name: 'Ann' }] }));

import {
  __resetLocalRoles, assignRole, defaultPermissions, diffPermissions, isLockedRole, listMembers, listRoles, parsePermissions, removeRole,
  saveRolePermissions, serializePermissions, toggled, wouldRemoveLastAdmin, type MemberRow, type RoleRow,
} from '../services/roleAdminService';
import { effectivePermissions } from '../components/settings/RolesSettings';

const role = (id: string, name: string, permissions: any[] = []): RoleRow => ({ id, name, description: null, permissions, is_system_role: true, workspace_id: null });

describe('role admin logic', () => {
  beforeEach(() => __resetLocalRoles());

  it('parses arrays and objects, dropping unknown actions, in canonical order', () => {
    expect(parsePermissions(['edit', 'view', 'nope'])).toEqual(['view', 'edit']);
    expect(parsePermissions({ delete: true, view: true, edit: false })).toEqual(['view', 'delete']);
    expect(parsePermissions(null)).toEqual([]);
  });

  it('serializes unique, ordered, known actions only', () => {
    expect(serializePermissions(['edit', 'view', 'edit', 'zzz' as any])).toEqual(['view', 'edit']);
  });

  it('toggles and diffs permissions', () => {
    const next = toggled(['view'], 'edit', true);
    expect(next).toEqual(['view', 'edit']);
    expect(diffPermissions(['view'], next)).toEqual([{ action: 'edit', granted: true }]);
    expect(diffPermissions(next, ['view'])).toEqual([{ action: 'edit', granted: false }]);
    expect(diffPermissions(['view'], ['view'])).toEqual([]);
  });

  it('built-in defaults follow the permission model', () => {
    expect(defaultPermissions('viewer')).toEqual(['view', 'export']);
    expect(defaultPermissions('manager')).not.toContain('manage_roles');
    expect(defaultPermissions('admin')).toContain('manage_roles');
  });

  it('unconfigured built-in roles show their defaults; configured ones show what is stored', () => {
    expect(effectivePermissions(role('1', 'viewer'))).toEqual(['view', 'export']);
    expect(effectivePermissions(role('2', 'viewer', ['view']))).toEqual(['view']);
    expect(effectivePermissions(role('3', 'custom'))).toEqual([]);
  });

  it('locks the admin role and protects the last admin', () => {
    expect(isLockedRole(role('a', 'Admin'))).toBe(true);
    expect(isLockedRole(role('m', 'manager'))).toBe(false);
    const roles = [role('a', 'admin'), role('m', 'member')];
    const members: MemberRow[] = [{ user_id: 'u1', name: 'A', role_ids: ['a'] }, { user_id: 'u2', name: 'B', role_ids: ['m'] }];
    expect(wouldRemoveLastAdmin(roles, members, 'a')).toBe(true);
    expect(wouldRemoveLastAdmin(roles, members, 'm')).toBe(false);
    expect(wouldRemoveLastAdmin(roles, [...members, { user_id: 'u3', name: 'C', role_ids: ['a'] }], 'a')).toBe(false);
  });

  it('demo store: save permissions, assign and remove a role', async () => {
    const roles = await listRoles();
    const member = roles.find(r => r.name === 'member')!;
    await saveRolePermissions(member.id, ['view', 'edit', 'delete']);
    expect((await listRoles()).find(r => r.id === member.id)!.permissions).toEqual(['view', 'edit', 'delete']);
    const members = await listMembers();
    const ann = members.find(m => m.name === 'Ann')!;
    const viewer = roles.find(r => r.name === 'viewer')!;
    await assignRole(ann.user_id, viewer.id);
    expect((await listMembers()).find(m => m.name === 'Ann')!.role_ids).toContain(viewer.id);
    await removeRole(ann.user_id, viewer.id);
    expect((await listMembers()).find(m => m.name === 'Ann')!.role_ids).not.toContain(viewer.id);
  });
});
