import { useCallback } from 'react';
import { useDealStore } from '../store/dealStore';
import { usePermissions } from './usePermissions';
import type { EntityKind, PermissionRecord } from '../services/permissionService';

/**
 * Permissions for records that hang off a deal (notes, tasks, files). A user may modify a child
 * record when they created it OR own/are assigned to the parent deal (mirrors the RLS rule).
 */
export function useChildRecordPermissions(dealId: string, kind: Extract<EntityKind, 'note' | 'task' | 'file'>) {
  const perms = usePermissions();
  const deal = useDealStore(s => s.deals[dealId]);
  const canCreate = perms.allowed('create', kind, deal);
  const canModify = useCallback((action: 'edit' | 'delete', record?: PermissionRecord | null) =>
    perms.allowed(action, kind, record ?? undefined) || perms.allowed(action, kind, deal),
  [perms, kind, deal]);
  return { canCreate, canModify, reason: perms.can('edit', kind).reason };
}
