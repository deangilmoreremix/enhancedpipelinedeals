import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../services/supabaseService';
import { RoleName, RlsMode, ROLE_NAMES, normalizeRole } from '../services/permissionService';

/** Role/workspace/RLS-mode lookups are cached for 5 minutes. */
export const PERMISSION_CACHE_MS = 5 * 60 * 1000;

interface PermissionState {
  userId: string | null;
  /** null until a role row (or fallback) has been resolved */
  role: RoleName | null;
  workspaceId: string | null;
  workspaceName: string | null;
  rlsMode: RlsMode;
  isLoading: boolean;
  loadedAt: number;
  /** Subscribe once to the Supabase session so `userId` follows sign-in / sign-out (no-op when not configured). */
  initAuth: () => void;
  /** Load (or reuse cached) role + workspace + rls mode for `userId`. */
  load: (userId: string | null, opts?: { force?: boolean }) => Promise<void>;
  setRlsMode: (mode: RlsMode) => void;
  reset: () => void;
}

const initial = {
  userId: null as string | null,
  role: null as RoleName | null,
  workspaceId: null as string | null,
  workspaceName: null as string | null,
  rlsMode: 'open' as RlsMode,
  isLoading: false,
  loadedAt: 0,
};

let authStarted = false;

const rank = (r: RoleName) => ROLE_NAMES.indexOf(r); // admin = 0 (highest)

export const usePermissionStore = create<PermissionState>((set, get) => ({
  ...initial,

  initAuth: () => {
    if (authStarted || !isSupabaseConfigured) return;
    authStarted = true;
    try {
      void supabase.auth.getSession().then(({ data }: { data: { session: { user?: { id: string } } | null } }) => {
        const id = data.session?.user?.id ?? null;
        if (id !== get().userId) { if (!id) get().reset(); else set({ userId: id, loadedAt: 0 }); }
      }).catch(() => undefined);
      supabase.auth.onAuthStateChange((_event: string, session: { user?: { id: string } } | null) => {
        const id = session?.user?.id ?? null;
        if (id === get().userId) return;
        if (!id) get().reset(); else set({ userId: id, role: null, loadedAt: 0 });
      });
    } catch { /* auth unavailable: stay open/anonymous */ }
  },

  load: async (userId, opts) => {
    const s = get();
    if (!userId) {
      set({ ...initial, loadedAt: Date.now() });
      return;
    }
    const fresh = s.userId === userId && Date.now() - s.loadedAt < PERMISSION_CACHE_MS;
    if (fresh && !opts?.force) return;
    if (!isSupabaseConfigured) {
      set({ userId, role: 'admin', rlsMode: 'open', loadedAt: Date.now(), isLoading: false });
      return;
    }
    set({ userId, isLoading: true });

    let rlsMode: RlsMode = 'open';
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'rls_mode')
        .is('user_id', null)
        .maybeSingle();
      const v = data?.setting_value;
      if (v === 'workspace' || v === '"workspace"') rlsMode = 'workspace';
    } catch { /* default open */ }

    let role: RoleName = 'member'; // authenticated user without a role row
    let workspaceId: string | null = null;
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('workspace_id, expires_at, roles(name)')
        .eq('user_id', userId);
      const now = Date.now();
      const rows = ((data ?? []) as unknown as Array<{ workspace_id: string; expires_at?: string | null; roles?: { name?: string } | { name?: string }[] | null }>)
        .filter(r => !r.expires_at || new Date(r.expires_at).getTime() > now);
      let best: { role: RoleName; ws: string } | null = null;
      for (const r of rows) {
        const rel = Array.isArray(r.roles) ? r.roles[0] : r.roles;
        if (!rel?.name) continue;
        const rn = normalizeRole(rel.name);
        if (!best || rank(rn) < rank(best.role)) best = { role: rn, ws: r.workspace_id };
      }
      if (best) { role = best.role; workspaceId = best.ws; }
      else if (rows[0]) workspaceId = rows[0].workspace_id;
    } catch { /* keep member fallback */ }

    let workspaceName: string | null = null;
    if (workspaceId) {
      try {
        const { data } = await supabase.from('workspaces').select('name').eq('id', workspaceId).maybeSingle();
        workspaceName = (data as { name?: string } | null)?.name ?? null;
      } catch { /* ignore */ }
    }

    // Only apply if the user didn't change while we were loading
    if (get().userId === userId) {
      set({ role, workspaceId, workspaceName, rlsMode, isLoading: false, loadedAt: Date.now() });
    }
  },

  setRlsMode: (mode) => set({ rlsMode: mode }),
  reset: () => set({ ...initial }),
}));
