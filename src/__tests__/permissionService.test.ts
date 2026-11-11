import { describe, it, expect } from '@jest/globals';
import {
  can, canAll, describeMatrix, isOwnRecord, normalizeRole, PERMISSION_ACTIONS, ROLE_NAMES,
  type PermissionAction, type PermissionContext, type RoleName,
} from '../services/permissionService';

const ME = 'user-me';
const OTHER = 'user-other';
const ctx = (role: RoleName, over: Partial<PermissionContext> = {}): PermissionContext => ({
  demo: false, rlsMode: 'workspace', user: { id: ME, role }, ...over,
});
const own = { ownerId: ME };
const assigned = { assignedToId: ME };
const created = { created_by: ME };
const others = { ownerId: OTHER, assignedToId: OTHER, createdBy: OTHER };

describe('permissionService matrix', () => {
  it('admin can do everything, on any record', () => {
    for (const a of PERMISSION_ACTIONS) {
      expect(can(ctx('admin'), a, 'deal', others).allowed).toBe(true);
    }
  });

  it('manager can do everything except manage_roles', () => {
    for (const a of PERMISSION_ACTIONS) {
      expect(can(ctx('manager'), a, 'deal', others).allowed).toBe(a !== 'manage_roles');
    }
  });

  describe('member', () => {
    const m = ctx('member');
    it.each(['view', 'create', 'import', 'export', 'assign'] as PermissionAction[])('%s is allowed on any record', a => {
      expect(can(m, a, 'deal', others).allowed).toBe(true);
    });
    it.each(['edit', 'delete', 'bulk'] as PermissionAction[])('%s only on own / assigned / created records', a => {
      expect(can(m, a, 'deal', own).allowed).toBe(true);
      expect(can(m, a, 'deal', assigned).allowed).toBe(true);
      expect(can(m, a, 'deal', created).allowed).toBe(true);
      const denied = can(m, a, 'deal', others);
      expect(denied.allowed).toBe(false);
      expect(denied.reason).toMatch(/own or are assigned/);
    });
    it('cannot manage stages, workflows or roles', () => {
      expect(can(m, 'manage_stages', 'stage').allowed).toBe(false);
      expect(can(m, 'manage_workflows', 'workflow').allowed).toBe(false);
      expect(can(m, 'manage_roles', 'deal').allowed).toBe(false);
    });
    it('may manage saved views', () => {
      expect(can(m, 'manage_views', 'view').allowed).toBe(true);
    });
    it('without a record context the role-level answer is allow (RLS decides)', () => {
      expect(can(m, 'edit', 'deal').allowed).toBe(true);
    });
  });

  describe('viewer', () => {
    const v = ctx('viewer');
    it('is read-only plus export', () => {
      for (const a of PERMISSION_ACTIONS) {
        expect(can(v, a, 'deal', own).allowed).toBe(a === 'view' || a === 'export');
      }
    });
    it('gives a reason', () => {
      expect(can(v, 'edit', 'deal', own).reason).toMatch(/viewer role/);
    });
  });

  describe('everything allowed (demo keeps working)', () => {
    it('demo mode', () => {
      expect(can(ctx('viewer', { demo: true }), 'delete', 'deal', others)).toEqual({ allowed: true, reason: 'Demo mode' });
    });
    it('no signed-in user', () => {
      expect(can({ demo: false, rlsMode: 'workspace', user: null }, 'edit', 'deal', others).allowed).toBe(true);
    });
    it("rls mode 'open'", () => {
      expect(can(ctx('viewer', { rlsMode: 'open' }), 'edit', 'deal', others).allowed).toBe(true);
    });
  });

  it('canAll requires every record to pass', () => {
    const m = ctx('member');
    expect(canAll(m, 'bulk', 'deal', [own, assigned]).allowed).toBe(true);
    expect(canAll(m, 'bulk', 'deal', [own, others]).allowed).toBe(false);
    expect(canAll(ctx('viewer'), 'edit', 'deal', []).allowed).toBe(false);
  });

  it('every role x action x own/other combination is defined', () => {
    for (const role of ROLE_NAMES) for (const a of PERMISSION_ACTIONS) for (const rec of [own, others]) {
      const r = can(ctx(role), a, 'deal', rec);
      expect(typeof r.allowed).toBe('boolean');
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it('isOwnRecord / normalizeRole / describeMatrix', () => {
    expect(isOwnRecord(ME, { owner_id: ME })).toBe(true);
    expect(isOwnRecord(null, own)).toBe(false);
    expect(isOwnRecord(ME, undefined)).toBe(false);
    expect(normalizeRole('Administrator')).toBe('admin');
    expect(normalizeRole('user')).toBe('member');
    expect(normalizeRole('agent')).toBe('viewer');
    expect(normalizeRole('???')).toBe('member');
    const matrix = describeMatrix();
    expect(matrix.map(r => r.role)).toEqual(['admin', 'manager', 'member', 'viewer']);
    expect(matrix.find(r => r.role === 'member')!.caps.edit).toBe('own');
  });
});
