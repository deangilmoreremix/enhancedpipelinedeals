import { describe, it, expect } from '@jest/globals';
import { isPermissionDenied, permissionMessage, assertRowsAffected, PermissionDeniedError } from '../utils/rlsError';

describe('rlsError', () => {
  it.each([
    [{ code: '42501', message: 'x' }],
    [{ code: 'PGRST301', message: 'JWT' }],
    [{ code: 'PGRST116', message: '0 rows' }],
    [{ message: 'new row violates row-level security policy for table "deals"' }],
    [{ status: 401 }],
    [{ status: 403, message: 'Forbidden' }],
    [new PermissionDeniedError()],
  ])('detects a denial: %j', err => {
    expect(isPermissionDenied(err)).toBe(true);
  });

  it.each([[null], [undefined], [new Error('network down')], [{ code: '23505', message: 'duplicate key' }], [{ status: 500 }]])(
    'ignores other errors: %j', err => {
      expect(isPermissionDenied(err)).toBe(false);
    });

  it('builds friendly messages', () => {
    expect(permissionMessage('edit', 'deal')).toBe("You don't have permission to edit this deal");
    expect(permissionMessage('delete', 'note')).toBe("You don't have permission to delete this note");
    expect(permissionMessage('move', 'deal')).toBe("You don't have permission to move this deal");
    expect(permissionMessage('manage_stages', 'stage')).toBe("You don't have permission to manage stages");
    expect(permissionMessage('bulk', 'deal')).toBe("You don't have permission to bulk update these deals");
  });

  it('assertRowsAffected treats zero rows as a permission denial', () => {
    expect(() => assertRowsAffected([])).toThrow(PermissionDeniedError);
    expect(() => assertRowsAffected(null)).toThrow(PermissionDeniedError);
    expect(() => assertRowsAffected([{ id: 1 }])).not.toThrow();
    try { assertRowsAffected([]); } catch (e) { expect(isPermissionDenied(e)).toBe(true); }
  });
});
