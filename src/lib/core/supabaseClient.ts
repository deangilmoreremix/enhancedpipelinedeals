import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./processShim";

let supabase: SupabaseClient | null = null;

try {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    supabase = createClient(url, key);
  }
} catch {}

/**
 * Safe Supabase client wrapper.
 *
 * When Supabase is not configured, returns a no-op client that accepts
 * every chained call but resolves with empty results. This prevents
 * `Cannot read property 'from' of null` crashes across the app while
 * keeping call sites unchanged.
 */
const noop = () => ({
  from: () => ({
    select: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    insert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    update: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    delete: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    upsert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    eq: () => noop(),
    neq: () => noop(),
    gt: () => noop(),
    gte: () => noop(),
    lt: () => noop(),
    lte: () => noop(),
    like: () => noop(),
    ilike: () => noop(),
    is: () => noop(),
    in: () => noop(),
    contains: () => noop(),
    containedBy: () => noop(),
    rangeGt: () => noop(),
    rangeGte: () => noop(),
    rangeLt: () => noop(),
    rangeLte: () => noop(),
    rangeAdjacent: () => noop(),
    overlap: () => noop(),
    textSearch: () => noop(),
    match: () => noop(),
    not: () => noop(),
    or: () => noop(),
    filter: () => noop(),
    order: () => noop(),
    limit: () => noop(),
    range: () => noop(),
    single: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    csv: () => '',
    rollback: () => Promise.resolve(),
    rpc: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    on: () => noop(),
    subscribe: () => Promise.resolve({ unsubscribe: () => {} }),
    channel: () => ({
      on: () => ({
        subscribe: () => Promise.resolve({ unsubscribe: () => {} })
      }),
      subscribe: () => Promise.resolve({ unsubscribe: () => {} })
    }),
    getAuth: () => ({ 
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null })
    }),
    removeChannel: () => {},
  }),
  auth: {
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
    signUp: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
    signOut: () => Promise.resolve({ error: null }),
    resetPasswordForEmail: () => Promise.resolve({ data: {}, error: { message: 'Supabase not configured' } }),
    updateUser: () => Promise.resolve({ data: { user: null }, error: { message: 'Supabase not configured' } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      download: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      list: () => Promise.resolve({ data: [], error: { message: 'Supabase not configured' } }),
      remove: () => Promise.resolve({ data: [], error: { message: 'Supabase not configured' } }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
      createSignedUrl: () => Promise.resolve({ data: { signedUrl: '' }, error: { message: 'Supabase not configured' } }),
    })
  }
});

export { supabase };
