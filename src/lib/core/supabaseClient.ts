import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./processShim";

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

/**
 * Shared Supabase client (never null).
 *
 * When env vars are missing a client pointed at an unreachable placeholder is
 * created so call sites keep working and simply receive `{ error }` results
 * instead of crashing on a null client. Check `isSupabaseConfigured` to
 * branch on configuration.
 */
export const supabase: SupabaseClient = createClient(
  url || "http://localhost:54321",
  key || "supabase-not-configured",
);
