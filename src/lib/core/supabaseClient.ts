import { createClient } from "@supabase/supabase-js";
import { env } from "./processShim";

let supabase: ReturnType<typeof createClient> | null = null;

try {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    supabase = createClient(url, key);
  }
} catch {}

export { supabase };