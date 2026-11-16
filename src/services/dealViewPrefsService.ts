import { supabase, isSupabaseConfigured } from '../lib/core/supabaseClient';
import { isDemoMode } from '../config/demoMode';
import { getCurrentUserId, isUuid } from './dealRecordShared';

/** Per-user deal record layout preferences (table `deal_view_prefs`, one row per user). */
export interface DealViewPrefs {
  tabOrder: string[];
  hiddenTabs: string[];
  hiddenFieldGroups: string[];
  pinnedDealIds: string[];
}

export const EMPTY_PREFS: DealViewPrefs = { tabOrder: [], hiddenTabs: [], hiddenFieldGroups: [], pinnedDealIds: [] };
export const LS_PREFS_KEY = 'crm_deal_view_prefs_v1';
export const MAX_PINNED = 20;
const MAX_ITEMS = 100;
const MAX_KEY_LEN = 80;

const cleanStrings = (v: unknown, max = MAX_ITEMS): string[] => {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const s = x.trim();
    if (!s || s.length > MAX_KEY_LEN || out.includes(s)) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
};

/** Validates unknown input (DB row, localStorage, caller args) into a well-formed prefs object. */
export function normalizePrefs(raw: unknown): DealViewPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    tabOrder: cleanStrings(r.tabOrder ?? r.tab_order),
    hiddenTabs: cleanStrings(r.hiddenTabs ?? r.hidden_tabs),
    hiddenFieldGroups: cleanStrings(r.hiddenFieldGroups ?? r.hidden_field_groups),
    pinnedDealIds: cleanStrings(r.pinnedDealIds ?? r.pinned_deal_ids, MAX_PINNED)
  };
}

/** Throws a readable error for invalid caller input. */
export function assertKeyList(name: string, v: unknown): string[] {
  if (!Array.isArray(v) || v.some(x => typeof x !== 'string' || !x.trim() || x.length > MAX_KEY_LEN)) {
    throw new Error(`${name} must be an array of non-empty strings`);
  }
  return cleanStrings(v);
}

const remoteOk = () => isSupabaseConfigured && !isDemoMode();

function readLocal(): DealViewPrefs {
  try {
    return normalizePrefs(JSON.parse(localStorage.getItem(LS_PREFS_KEY) || '{}'));
  } catch {
    return { ...EMPTY_PREFS };
  }
}
function writeLocal(p: DealViewPrefs) {
  try {
    localStorage.setItem(LS_PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

/** Loads the signed-in user's prefs (localStorage in demo / unconfigured / signed-out). */
export async function loadPrefs(): Promise<DealViewPrefs> {
  const local = readLocal();
  if (!remoteOk()) return local;
  const userId = await getCurrentUserId();
  if (!userId) return local;
  const { data, error } = await supabase.from('deal_view_prefs').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return local;
  const remote = normalizePrefs(data);
  // Locally created (non-uuid) deals cannot live in uuid[]: keep their pins from the local mirror
  const localOnly = local.pinnedDealIds.filter(id => !isUuid(id));
  return { ...remote, pinnedDealIds: [...remote.pinnedDealIds, ...localOnly].slice(0, MAX_PINNED) };
}

/** Persists the full prefs object (always mirrored to localStorage). Throws on database failure. */
export async function savePrefs(prefs: DealViewPrefs): Promise<void> {
  const clean = normalizePrefs(prefs);
  writeLocal(clean);
  if (!remoteOk()) return;
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase.from('deal_view_prefs').upsert({
    user_id: userId,
    tab_order: clean.tabOrder,
    hidden_tabs: clean.hiddenTabs,
    hidden_field_groups: clean.hiddenFieldGroups,
    pinned_deal_ids: clean.pinnedDealIds.filter(isUuid),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export const DealViewPrefsService = { loadPrefs, savePrefs, normalizePrefs };
