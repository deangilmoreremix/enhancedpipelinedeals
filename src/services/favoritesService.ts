import { supabase, isSupabaseConfigured } from '../lib/core/supabaseClient';
import { isDemoMode } from '../config/demoMode';
import { getCurrentUserId, isUuid } from './dealRecordShared';

export type FavoriteEntityType = 'deal' | 'contact';

const LS_KEY = 'crm_favorites_v1';

const remoteOk = (entityId: string) => isSupabaseConfigured && !isDemoMode() && isUuid(entityId);

function readLocal(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}') as Record<string, string[]>;
  } catch {
    return {};
  }
}
function writeLocal(v: Record<string, string[]>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

/** Entity ids favorited by the current user (or the anonymous bucket when signed out). */
export async function listFavorites(type: FavoriteEntityType = 'deal'): Promise<string[]> {
  const local = readLocal()[type] ?? [];
  if (!isSupabaseConfigured || isDemoMode()) return local;
  const userId = await getCurrentUserId();
  let q = supabase.from('favorites').select('entity_id').eq('entity_type', type).order('position', { ascending: true });
  q = userId ? q.eq('user_id', userId) : q.is('user_id', null);
  const { data, error } = await q;
  if (error) throw error;
  return [...new Set([...(data ?? []).map((r: any) => r.entity_id as string), ...local.filter(id => !isUuid(id))])];
}

export async function isFavorite(type: FavoriteEntityType, entityId: string): Promise<boolean> {
  return (await listFavorites(type)).includes(entityId);
}

/** Toggles and returns the new state. */
export async function toggleFavorite(type: FavoriteEntityType, entityId: string): Promise<boolean> {
  if (!remoteOk(entityId)) {
    const all = readLocal();
    const cur = new Set(all[type] ?? []);
    const next = !cur.has(entityId);
    if (next) cur.add(entityId); else cur.delete(entityId);
    writeLocal({ ...all, [type]: [...cur] });
    return next;
  }
  const userId = await getCurrentUserId();
  let sel = supabase.from('favorites').select('id').eq('entity_type', type).eq('entity_id', entityId);
  sel = userId ? sel.eq('user_id', userId) : sel.is('user_id', null);
  const { data: existing, error: selErr } = await sel.maybeSingle();
  if (selErr) throw selErr;
  if (existing) {
    const { error } = await supabase.from('favorites').delete().eq('id', (existing as any).id);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, entity_type: type, entity_id: entityId, position: Date.now() });
  if (error) throw error;
  return true;
}

/** Idempotent set (used so the favorites table and deals.is_favorite never drift). */
export async function setFavorite(type: FavoriteEntityType, entityId: string, value: boolean): Promise<boolean> {
  const current = await isFavorite(type, entityId);
  if (current === value) return value;
  return toggleFavorite(type, entityId);
}

export const FavoritesService = { listFavorites, isFavorite, toggleFavorite, setFavorite };
