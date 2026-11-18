import { supabase } from '../lib/core/supabaseClient';
import { assertRowsAffected } from '../utils/rlsError';

export const PURGE_CONFIRM_WORD = 'DELETE';
/** Typed confirmation for permanent deletion: the exact word (case-insensitive, trimmed). */
export const isPurgeConfirmed = (input: string): boolean => input.trim().toUpperCase() === PURGE_CONFIRM_WORD;

const asCount = (data: unknown): number => {
  const n = Array.isArray(data) ? Number(data[0]) : Number(data);
  return Number.isFinite(n) ? n : 0;
};

/** `purge_deals(p_ids)`: permanently deletes soft-deleted deals; returns how many went. 0 rows = blocked (RLS / not in trash). */
export async function purgeDealsRemote(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await supabase.rpc('purge_deals', { p_ids: ids });
  if (error) throw error;
  const n = asCount(data);
  assertRowsAffected(n > 0 ? [n] : []);
  return n;
}

/** `restore_deals(p_ids)`: restores soft-deleted deals; returns how many came back. */
export async function restoreDealsRemote(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await supabase.rpc('restore_deals', { p_ids: ids });
  if (error) throw error;
  const n = asCount(data);
  assertRowsAffected(n > 0 ? [n] : []);
  return n;
}

export const DealTrashService = { purgeDealsRemote, restoreDealsRemote, isPurgeConfirmed };
