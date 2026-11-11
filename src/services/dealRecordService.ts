import { supabase } from '../lib/core/supabaseClient';
import type { Deal } from '../types';
import { dealFromRow } from './dealMapper';
import { canUseRemote } from './dealRecordShared';
import { assertRowsAffected } from '../utils/rlsError';

/** Fetch one deal (including soft-deleted) straight from Supabase. Null when not found / not remote. */
export async function fetchDealById(id: string): Promise<Deal | null> {
  if (!canUseRemote(id)) return null;
  const { data, error } = await supabase.from('deals').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? dealFromRow(data) : null;
}

/** Soft-deleted deals from Supabase (newest deletion first). */
export async function fetchDeletedDeals(): Promise<Deal[]> {
  try {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map(dealFromRow);
  } catch (e) {
    console.warn('Could not load deleted deals:', e);
    return [];
  }
}

/** Restore a soft-deleted deal directly in Supabase (used when it is not in the store's trash). */
export async function restoreDealRemote(id: string): Promise<void> {
  const { data, error } = await supabase.from('deals').update({ deleted_at: null }).eq('id', id).select('id');
  if (error) throw error;
  assertRowsAffected(data); // RLS filters UPDATEs silently
}
