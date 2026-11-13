import { isSupabaseConfigured } from '../services/supabaseService';

/**
 * Demo mode serves bundled mock data (src/data/mockDeals.ts).
 * It is on when Supabase is not configured, or when localStorage 'demo_mode' === '1'.
 */
export function isDemoMode(): boolean {
  if (!isSupabaseConfigured) return true;
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('demo_mode') === '1';
  } catch {
    return false;
  }
}
