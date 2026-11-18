import { chain } from '../test-utils/chain';

let mockFrom: jest.Mock;
const mockClient: any = {
  from: (...a: unknown[]) => mockFrom(...a),
  auth: { getUser: jest.fn(), signOut: jest.fn() },
  channel: jest.fn(),
};

jest.mock('../lib/core/supabaseClient', () => ({
  get supabase() { return mockClient; },
  isSupabaseConfigured: true,
}));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => mockClient) }));

import { SupabaseService } from '../services/supabaseService';
import { PermissionDeniedError } from '../utils/rlsError';

const ok = (data: any) => chain({ data, error: null });
const fail = (message: string) => chain({ data: null, error: { message } });

describe('SupabaseService', () => {
  const origUrl = process.env.VITE_SUPABASE_URL;
  const origKey = process.env.VITE_SUPABASE_ANON_KEY;
  let service: SupabaseService;

  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
    mockFrom = jest.fn();
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    service = new SupabaseService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (origUrl === undefined) delete process.env.VITE_SUPABASE_URL; else process.env.VITE_SUPABASE_URL = origUrl;
    if (origKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY; else process.env.VITE_SUPABASE_ANON_KEY = origKey;
  });

  describe('configuration', () => {
    it('connects through the shared client when env is present', () => {
      expect(service.isConnectedToDatabase()).toBe(true);
      expect(service.client).toBe(mockClient);
    });

    it('is disconnected and refuses calls without env', async () => {
      delete process.env.VITE_SUPABASE_URL;
      delete process.env.VITE_SUPABASE_ANON_KEY;
      const s = new SupabaseService();
      expect(s.isConnectedToDatabase()).toBe(false);
      await expect(s.getContacts()).rejects.toThrow(/not configured/);
      await expect(s.getDeals()).rejects.toThrow(/not configured/);
      expect(await s.getCurrentUser()).toBeNull();
      expect(await s.checkConnection()).toBe(false);
    });
  });

  describe('contacts', () => {
    it('getContacts maps gamification_stats / is_team_member', async () => {
      mockFrom.mockReturnValue(ok([{ id: 'c1', name: 'A', gamification_stats: { xp: 1 }, is_team_member: true }, { id: 'c2', name: 'B' }]));
      const rows = await service.getContacts();
      expect(mockFrom).toHaveBeenCalledWith('contacts');
      expect(rows[0]).toMatchObject({ id: 'c1', gamificationStats: { xp: 1 }, isTeamMember: true });
      expect(rows[1]).toMatchObject({ gamificationStats: undefined, isTeamMember: false });
    });

    it('getContacts throws a descriptive error on query failure', async () => {
      mockFrom.mockReturnValue(fail('boom'));
      await expect(service.getContacts()).rejects.toThrow('Database query failed: boom');
    });

    it('createContact serialises gamification stats and returns the row', async () => {
      const c = ok([{ id: 'c1', name: 'New' }]);
      mockFrom.mockReturnValue(c);
      const res = await service.createContact({ name: 'New', gamificationStats: { xp: 5 } } as any);
      expect(res).toMatchObject({ id: 'c1' });
      const insert = c.calls.find(([m]: [string]) => m === 'insert')[1][0];
      expect(insert.gamification_stats).toEqual({ xp: 5 });
      expect(insert).not.toHaveProperty('gamificationStats');
      expect(insert.created_at).toBeDefined();
    });

    it('updateContact filters by id and stamps updated_at', async () => {
      const c = ok([{ id: 'c1', name: 'X' }]);
      mockFrom.mockReturnValue(c);
      await service.updateContact('c1', { name: 'X' });
      expect(c.calls.find(([m]: [string]) => m === 'eq')[1]).toEqual(['id', 'c1']);
      expect(c.calls.find(([m]: [string]) => m === 'update')[1][0].updated_at).toBeDefined();
    });

    it('deleteContact resolves, and rejects on error', async () => {
      mockFrom.mockReturnValueOnce(ok(null));
      await expect(service.deleteContact('c1')).resolves.toBeUndefined();
      mockFrom.mockReturnValueOnce(fail('nope'));
      await expect(service.deleteContact('c1')).rejects.toEqual({ message: 'nope' });
    });

    it('searchContacts builds an ilike OR filter', async () => {
      const c = ok([{ id: 'c1' }]);
      mockFrom.mockReturnValue(c);
      expect(await service.searchContacts('acme')).toHaveLength(1);
      expect(c.calls.find(([m]: [string]) => m === 'or')[1][0]).toContain('name.ilike.%acme%');
    });
  });

  describe('deals', () => {
    it('getDeals maps rows and hides soft-deleted ones unless asked', async () => {
      const rows = [{ id: 'd1', title: 'Live' }, { id: 'd2', title: 'Gone', deleted_at: '2024-01-01T00:00:00Z' }];
      mockFrom.mockReturnValue(ok(rows));
      const live = await service.getDeals();
      expect(live.map(d => d.id)).toEqual(['d1']);
      const all = await service.getDeals({ includeDeleted: true });
      expect(all.map(d => d.id)).toEqual(['d1', 'd2']);
    });

    it('getDeals pages through the table until a short page', async () => {
      const full = Array.from({ length: 500 }, (_, i) => ({ id: `d${i}`, title: 't' }));
      mockFrom.mockReturnValueOnce(ok(full)).mockReturnValueOnce(ok([{ id: 'last', title: 't' }]));
      const deals = await service.getDeals();
      expect(deals).toHaveLength(501);
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it('createDeal returns the mapped deal', async () => {
      mockFrom.mockReturnValue(ok([{ id: 'd1', title: 'New' }]));
      const d = await service.createDeal({ title: 'New' } as any);
      expect(d).toMatchObject({ id: 'd1', title: 'New' });
    });

    it('updateDeal rejects when Supabase errors', async () => {
      mockFrom.mockReturnValue(fail('x'));
      await expect(service.updateDeal('d1', { title: 'Z' })).rejects.toEqual({ message: 'x' });
    });

    it('deleteDeal treats zero affected rows as permission denied (RLS)', async () => {
      mockFrom.mockReturnValueOnce(ok([{ id: 'd1' }]));
      await expect(service.deleteDeal('d1')).resolves.toBeUndefined();
      mockFrom.mockReturnValueOnce(ok([]));
      await expect(service.deleteDeal('d1')).rejects.toBeInstanceOf(PermissionDeniedError);
    });
  });

  describe('activities', () => {
    it('logActivity inserts into activities', async () => {
      const c = ok(null);
      mockFrom.mockReturnValue(c);
      const activity = { type: 'note', entity_type: 'deal' as const, entity_id: 'd1', description: 'hi', user_id: 'u1' };
      await service.logActivity(activity);
      expect(mockFrom).toHaveBeenCalledWith('activities');
      expect(c.calls.find(([m]: [string]) => m === 'insert')[1][0]).toEqual(activity);
    });

    it('getActivities filters by entity and returns [] for null data', async () => {
      const c = ok(null);
      mockFrom.mockReturnValue(c);
      expect(await service.getActivities('deal', 'd1')).toEqual([]);
      const eqs = c.calls.filter(([m]: [string]) => m === 'eq').map(([, a]: any) => a);
      expect(eqs).toEqual([['entity_type', 'deal'], ['entity_id', 'd1']]);
    });
  });

  describe('auth and realtime', () => {
    it('getCurrentUser returns the auth user', async () => {
      mockClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
      expect(await service.getCurrentUser()).toEqual({ id: 'u1' });
    });

    it('signOut throws when auth fails', async () => {
      mockClient.auth.signOut.mockResolvedValueOnce({ error: null });
      await expect(service.signOut()).resolves.toBeUndefined();
      mockClient.auth.signOut.mockResolvedValueOnce({ error: new Error('x') });
      await expect(service.signOut()).rejects.toThrow('x');
    });

    it('subscribeToDeals maps new rows to Deal and old rows to { id }', () => {
      let handler: any;
      const channel: any = { on: jest.fn((_e, _f, cb) => { handler = cb; return channel; }), subscribe: jest.fn(() => 'sub') };
      mockClient.channel.mockReturnValue(channel);
      const cb = jest.fn();
      expect(service.subscribeToDeals(cb)).toBe('sub');
      handler({ eventType: 'UPDATE', new: { id: 'd1', title: 'T' }, old: { id: 'd1', title: 'old' } });
      const payload = cb.mock.calls[0][0];
      expect(payload.new).toMatchObject({ id: 'd1', title: 'T' });
      expect(payload.old).toEqual({ id: 'd1' });
    });

    it('checkConnection is true when the probe query works and false on a hard error', async () => {
      mockFrom.mockReturnValueOnce(ok([]));
      expect(await service.checkConnection()).toBe(true);
      mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: 'boom' } }));
      expect(await service.checkConnection()).toBe(false);
      mockFrom.mockReturnValueOnce(chain({ data: null, error: { code: '42501', message: 'x' } }));
      expect(await service.checkConnection()).toBe(true);
    });
  });
});
