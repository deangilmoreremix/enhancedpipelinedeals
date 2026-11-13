import { supabase, isSupabaseConfigured } from '../lib/core/supabaseClient';
import { isDemoMode } from '../config/demoMode';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: string | null | undefined): v is string => !!v && UUID_RE.test(v);

/**
 * Whether record data (notes/tasks/files/...) for this deal can hit Supabase.
 * Demo mode, missing config, and locally created (non-uuid) deals use in-memory fallbacks.
 */
export function canUseRemote(dealId: string): boolean {
  return isSupabaseConfigured && !isDemoMode() && isUuid(dealId);
}

/** Authenticated user id, or null (anonymous / demo / auth unavailable). */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export const localId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const errorMessage = (e: unknown, fallback = 'Something went wrong'): string =>
  e instanceof Error ? e.message : typeof (e as any)?.message === 'string' ? (e as any).message : fallback;
