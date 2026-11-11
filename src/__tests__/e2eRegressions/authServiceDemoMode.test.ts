/**
 * Regressions found by e2e scenario A (demo mode, no Supabase env):
 *  - AuthProvider crashed the whole app by calling onAuthStateChange on a null client.
 *  - initializeAllFeatures threw "Cannot read properties of undefined (reading 'rpc')".
 */
jest.mock('../../lib/core/supabaseClient', () => ({ supabase: null, isSupabaseConfigured: false }));
jest.mock('../../services/supabaseService', () => ({
  isSupabaseConfigured: false,
  getSupabaseService: jest.fn(() => ({})), // no `.supabase` -> would throw if touched
}));

describe('demo mode (no Supabase)', () => {
  const saved = { u: process.env.VITE_SUPABASE_URL, k: process.env.VITE_SUPABASE_ANON_KEY };
  beforeAll(() => { delete process.env.VITE_SUPABASE_URL; delete process.env.VITE_SUPABASE_ANON_KEY; });
  afterAll(() => { process.env.VITE_SUPABASE_URL = saved.u; process.env.VITE_SUPABASE_ANON_KEY = saved.k; });

  it('AuthService.onAuthStateChange returns a no-op subscription instead of throwing', () => {
    const { AuthService } = require('../../services/authService');
    const res = new AuthService().onAuthStateChange(() => {});
    expect(() => res.data.subscription.unsubscribe()).not.toThrow();
  });

  it('AuthService.getCurrentSession resolves to a null session', async () => {
    const { AuthService } = require('../../services/authService');
    await expect(new AuthService().getCurrentSession()).resolves.toEqual({ data: { session: null }, error: null });
  });

  it('initializeAllFeatures is a no-op', async () => {
    const { initializeAllFeatures } = require('../../scripts/initializeFeatures');
    await expect(initializeAllFeatures()).resolves.toBeUndefined();
  });
});
