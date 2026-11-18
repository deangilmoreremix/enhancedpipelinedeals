const mockAuth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  updateUser: jest.fn(),
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(),
};
const mockProfiles = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  upsert: jest.fn(),
};
const mockClient = { auth: mockAuth, from: jest.fn(() => mockProfiles) };

jest.mock('../lib/core/supabaseClient', () => ({
  get supabase() { return mockClient; },
  isSupabaseConfigured: true,
}));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => mockClient) }));

import { AuthService, getAuthService } from '../services/authService';

const supaUser = { id: 'u1', email: 'a@b.com', created_at: '2024-01-01', user_metadata: { name: 'Meta Name' } };
const flush = () => new Promise(r => setTimeout(r, 0));

describe('AuthService', () => {
  const origUrl = process.env.VITE_SUPABASE_URL;
  const origKey = process.env.VITE_SUPABASE_ANON_KEY;
  let warn: jest.SpyInstance;
  let service: AuthService;

  const make = async () => {
    const s = new AuthService();
    await flush();
    return s;
  };

  beforeEach(async () => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.clearAllMocks();
    mockProfiles.select.mockReturnThis();
    mockProfiles.eq.mockReturnThis();
    mockProfiles.single.mockResolvedValue({ data: null, error: null });
    mockProfiles.upsert.mockResolvedValue({ error: null });
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    service = await make();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (origUrl === undefined) delete process.env.VITE_SUPABASE_URL; else process.env.VITE_SUPABASE_URL = origUrl;
    if (origKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY; else process.env.VITE_SUPABASE_ANON_KEY = origKey;
  });

  it('getAuthService returns a singleton', () => {
    expect(getAuthService()).toBe(getAuthService());
  });

  describe('initialization', () => {
    it('starts signed out when there is no session', () => {
      expect(service.getAuthState()).toMatchObject({ user: null, session: null, isLoading: false, isAuthenticated: false });
      expect(mockAuth.onAuthStateChange).toHaveBeenCalled();
    });

    it('hydrates the user from an existing session and the profiles row', async () => {
      mockAuth.getSession.mockResolvedValue({ data: { session: { user: supaUser } }, error: null });
      mockProfiles.single.mockResolvedValue({ data: { name: 'Profile Name', role: 'admin', avatar_url: 'x.png' }, error: null });
      const s = await make();
      expect(s.isAuthenticated()).toBe(true);
      expect(s.getCurrentUser()).toMatchObject({ id: 'u1', email: 'a@b.com', name: 'Profile Name', role: 'admin', avatar: 'x.png' });
    });

    it('falls back to user metadata and the user role without a profile', async () => {
      mockAuth.getSession.mockResolvedValue({ data: { session: { user: supaUser } }, error: null });
      const s = await make();
      expect(s.getCurrentUser()).toMatchObject({ name: 'Meta Name', role: 'user' });
    });

    it('stays signed out when getSession returns an error', async () => {
      mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: new Error('bad') });
      const s = await make();
      expect(s.isAuthenticated()).toBe(false);
      expect(s.isLoading()).toBe(false);
    });

    it('runs in demo mode (no client) when Supabase env is missing', () => {
      delete process.env.VITE_SUPABASE_URL;
      delete process.env.VITE_SUPABASE_ANON_KEY;
      const s = new AuthService();
      expect(warn).toHaveBeenCalled();
      expect(s.isAuthenticated()).toBe(false);
      expect(s.isLoading()).toBe(false);
      expect(s.onAuthStateChange(jest.fn()).data.subscription.unsubscribe).not.toThrow();
    });
  });

  describe('signUp / signIn', () => {
    it('signUp returns the created user', async () => {
      mockAuth.signUp.mockResolvedValue({ data: { user: supaUser }, error: null });
      const r = await service.signUp('a@b.com', 'pw', { name: 'N' });
      expect(mockAuth.signUp).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw', options: { data: { name: 'N' } } });
      expect(r.error).toBeNull();
      expect(r.user?.id).toBe('u1');
    });

    it('signUp surfaces Supabase errors, empty results and thrown errors', async () => {
      mockAuth.signUp.mockResolvedValueOnce({ data: { user: null }, error: { message: 'exists' } });
      expect(await service.signUp('a@b.com', 'pw')).toEqual({ user: null, error: 'exists' });
      mockAuth.signUp.mockResolvedValueOnce({ data: { user: null }, error: null });
      expect(await service.signUp('a@b.com', 'pw')).toEqual({ user: null, error: 'Signup failed' });
      mockAuth.signUp.mockRejectedValueOnce(new Error('Network error'));
      expect(await service.signUp('a@b.com', 'pw')).toEqual({ user: null, error: 'Network error' });
    });

    it('signIn returns the user, or the error message', async () => {
      mockAuth.signInWithPassword.mockResolvedValueOnce({ data: { user: supaUser }, error: null });
      const ok = await service.signIn('a@b.com', 'pw');
      expect(ok.user?.email).toBe('a@b.com');
      mockAuth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid login' } });
      expect(await service.signIn('a@b.com', 'x')).toEqual({ user: null, error: 'Invalid login' });
      mockAuth.signInWithPassword.mockRejectedValueOnce(new Error('timeout'));
      expect(await service.signIn('a@b.com', 'x')).toEqual({ user: null, error: 'timeout' });
    });
  });

  describe('signOut / password / profile', () => {
    it('signOut returns null or the error message', async () => {
      mockAuth.signOut.mockResolvedValueOnce({ error: null });
      expect(await service.signOut()).toEqual({ error: null });
      mockAuth.signOut.mockResolvedValueOnce({ error: { message: 'nope' } });
      expect(await service.signOut()).toEqual({ error: 'nope' });
      mockAuth.signOut.mockRejectedValueOnce(new Error('down'));
      expect(await service.signOut()).toEqual({ error: 'down' });
    });

    it('resetPassword sends a reset email with a redirect', async () => {
      mockAuth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });
      expect(await service.resetPassword('a@b.com')).toEqual({ error: null });
      expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.com', { redirectTo: expect.stringContaining('/reset-password') });
      mockAuth.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'rate limited' } });
      expect(await service.resetPassword('a@b.com')).toEqual({ error: 'rate limited' });
    });

    it('updatePassword calls updateUser', async () => {
      mockAuth.updateUser.mockResolvedValueOnce({ error: null });
      expect(await service.updatePassword('new')).toEqual({ error: null });
      expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'new' });
      mockAuth.updateUser.mockResolvedValueOnce({ error: { message: 'weak' } });
      expect(await service.updatePassword('1')).toEqual({ error: 'weak' });
    });

    it('updateProfile upserts the profile and updates local state', async () => {
      mockAuth.getSession.mockResolvedValue({ data: { session: { user: supaUser } }, error: null });
      const s = await make();
      expect(await s.updateProfile({ name: 'New' })).toEqual({ error: null });
      expect(mockProfiles.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1', name: 'New' }));
      expect(s.getCurrentUser()?.name).toBe('New');
      mockProfiles.upsert.mockResolvedValueOnce({ error: { message: 'denied' } });
      expect(await s.updateProfile({ name: 'X' })).toEqual({ error: 'denied' });
    });
  });

  describe('state, roles and permissions', () => {
    const signedInAs = async (role: string) => {
      mockAuth.getSession.mockResolvedValue({ data: { session: { user: supaUser } }, error: null });
      mockProfiles.single.mockResolvedValue({ data: { role }, error: null });
      return make();
    };

    it('notifies subscribers and supports unsubscribe', () => {
      const listener = jest.fn();
      const unsub = service.subscribe(listener);
      (service as any).updateAuthState({ isLoading: true });
      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
      (service as any).updateAuthState({ isLoading: false });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('hasRole / hasPermission follow the role table', async () => {
      const admin = await signedInAs('admin');
      expect(admin.hasRole('admin')).toBe(true);
      expect(admin.hasPermission('anything')).toBe(true);
      const agent = await signedInAs('agent');
      expect(agent.hasPermission('ai_agents')).toBe(true);
      expect(agent.hasPermission('write')).toBe(false);
      expect(service.hasPermission('read')).toBe(false); // signed out
    });

    it('getCurrentSession and onAuthStateChange delegate to the client', async () => {
      mockAuth.getSession.mockResolvedValueOnce({ data: { session: { user: supaUser } }, error: null });
      expect((await service.getCurrentSession()).data.session).toBeTruthy();
      mockAuth.getSession.mockRejectedValueOnce(new Error('x'));
      expect((await service.getCurrentSession()).data.session).toBeNull();
      const cb = jest.fn();
      service.onAuthStateChange(cb);
      const handler = mockAuth.onAuthStateChange.mock.calls.at(-1)[0];
      handler('SIGNED_IN', null);
      expect(cb).toHaveBeenCalledWith('SIGNED_IN', null);
    });
  });
});
