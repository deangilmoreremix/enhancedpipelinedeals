/**
 * Side-effect module: import it FIRST in functions that use the shared browser/server Supabase client from `src/`
 * (src/lib/core/supabaseClient.ts reads only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`). On Netlify the server-side
 * variables are usually named `SUPABASE_URL` / `SUPABASE_ANON_KEY`; without this mapping those functions would silently
 * talk to the `http://localhost:54321` placeholder client.
 */
const e = process.env;
if (!e.VITE_SUPABASE_URL && e.SUPABASE_URL) e.VITE_SUPABASE_URL = e.SUPABASE_URL;
if (!e.VITE_SUPABASE_ANON_KEY && (e.SUPABASE_ANON_KEY || e.SUPABASE_SERVICE_ROLE_KEY)) {
  e.VITE_SUPABASE_ANON_KEY = e.SUPABASE_ANON_KEY || e.SUPABASE_SERVICE_ROLE_KEY;
}
export {};
