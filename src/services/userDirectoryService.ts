import { supabase, isSupabaseConfigured } from './supabaseService';
import { isDemoMode } from '../config/demoMode';
import type { DirectoryUser } from '../types';
import { useDealStore } from '../store/dealStore';

/**
 * Assignable users. Remote: `profiles` (id, name, avatar) + the signed-in auth user.
 * Local/demo (or when profiles is unreadable): current user + names already present on deals.
 */

export const LOCAL_USER_PREFIX = 'local-user-';
const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'user';

export const isRemoteDirectory = (): boolean => isSupabaseConfigured && !isDemoMode();

/** The signed-in Supabase user as a DirectoryUser, or null. */
export async function getCurrentDirectoryUser(): Promise<DirectoryUser | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const u = data?.session?.user;
    if (!u) return null;
    const meta = (u.user_metadata ?? {}) as Record<string, any>;
    return {
      id: u.id,
      name: meta.name ?? meta.full_name ?? (u.email ? u.email.split('@')[0] : 'Me'),
      avatar: meta.avatar_url ?? meta.avatar ?? undefined,
    };
  } catch {
    return null;
  }
}

/** Names found on deals (assignedTo) so demo data stays assignable. Unknown owner ids map to the deal's assignedTo label. */
export function usersFromDeals(): DirectoryUser[] {
  const out = new Map<string, DirectoryUser>();
  try {
    for (const d of Object.values(useDealStore.getState().deals)) {
      const name = d.assignedTo?.trim();
      if (d.ownerId && name) out.set(d.ownerId, { id: d.ownerId, name });
      else if (name) {
        const id = `${LOCAL_USER_PREFIX}${slug(name)}`;
        if (!out.has(id)) out.set(id, { id, name });
      }
    }
  } catch { /* store unavailable */ }
  return [...out.values()];
}

/** Merge lists by id, then by case-insensitive name; earlier lists win. */
export function mergeUsers(...lists: DirectoryUser[][]): DirectoryUser[] {
  const byId = new Map<string, DirectoryUser>();
  const names = new Set<string>();
  for (const list of lists) {
    for (const u of list) {
      const key = u.name.trim().toLowerCase();
      if (byId.has(u.id) || (key && names.has(key))) continue;
      byId.set(u.id, u);
      if (key) names.add(key);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listUsers(): Promise<DirectoryUser[]> {
  const me = await getCurrentDirectoryUser();
  let remote: DirectoryUser[] = [];
  if (isRemoteDirectory()) {
    try {
      const { data, error } = await supabase.from('profiles').select('id, name, avatar').order('name', { ascending: true }).limit(500);
      if (error) throw error;
      remote = (data ?? [])
        .filter((p: any) => p.id)
        .map((p: any) => ({ id: p.id as string, name: (p.name as string) || 'Unnamed user', avatar: (p.avatar as string) || undefined }));
    } catch (e) {
      console.warn('Could not load profiles, using fallback directory:', e);
    }
  }
  // Fake local ids must never be written to a uuid column: only use deal-derived users when not remote.
  const derived = isRemoteDirectory() ? [] : usersFromDeals();
  return mergeUsers(remote, me ? [me] : [], derived);
}

export function filterUsers(users: DirectoryUser[], q: string): DirectoryUser[] {
  const needle = q.trim().toLowerCase();
  return needle ? users.filter(u => u.name.toLowerCase().includes(needle)) : users;
}
