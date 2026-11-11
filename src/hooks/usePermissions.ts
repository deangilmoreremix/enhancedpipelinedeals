import { useCallback, useEffect, useMemo } from 'react';
import { isDemoMode } from '../config/demoMode';
import { usePermissionStore } from '../store/permissionStore';
import {
  can as canCore, canAll as canAllCore, PermissionAction, EntityKind, PermissionRecord,
  PermissionResult, PermissionContext, RoleName, RlsMode,
} from '../services/permissionService';

export interface UsePermissions {
  can: (action: PermissionAction, kind: EntityKind, record?: PermissionRecord | null) => PermissionResult;
  /** Convenience boolean form of `can(...).allowed`. */
  allowed: (action: PermissionAction, kind: EntityKind, record?: PermissionRecord | null) => boolean;
  /** Every record must pass (bulk actions). */
  canAll: (action: PermissionAction, kind: EntityKind, records: Array<PermissionRecord | null | undefined>) => PermissionResult;
  role: RoleName;
  rlsMode: RlsMode;
  workspaceId: string | null;
  workspaceName: string | null;
  userId: string | null;
  isDemo: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Current user's permissions. Demo mode, signed-out users and RLS mode 'open' are all-allowed
 * so the app behaves as before until workspace RLS is switched on.
 */
export function usePermissions(): UsePermissions {
  const demo = isDemoMode();
  const store = usePermissionStore();
  // The signed-in user follows the shared Supabase session (same source AuthProvider uses)
  const authUserId = demo ? null : store.userId;

  useEffect(() => {
    if (demo) return;
    store.initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  useEffect(() => {
    if (demo || !authUserId) return;
    void store.load(authUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId, demo]);

  const role: RoleName = demo || !authUserId ? 'admin' : (store.role ?? 'member');
  const ctx: PermissionContext = useMemo(() => ({
    demo,
    rlsMode: store.rlsMode,
    user: authUserId ? { id: authUserId, role, workspaceId: store.workspaceId } : null,
  }), [demo, store.rlsMode, authUserId, role, store.workspaceId]);

  const can = useCallback<UsePermissions['can']>((a, k, r) => canCore(ctx, a, k, r), [ctx]);
  const allowed = useCallback<UsePermissions['allowed']>((a, k, r) => canCore(ctx, a, k, r).allowed, [ctx]);
  const canAll = useCallback<UsePermissions['canAll']>((a, k, rs) => canAllCore(ctx, a, k, rs), [ctx]);
  const refresh = useCallback(() => store.load(authUserId, { force: true }), [store, authUserId]);

  return {
    can, allowed, canAll, role, rlsMode: store.rlsMode, workspaceId: store.workspaceId,
    workspaceName: store.workspaceName, userId: authUserId, isDemo: demo,
    isAdmin: role === 'admin', isLoading: !demo && !!authUserId && store.isLoading, refresh,
  };
}
