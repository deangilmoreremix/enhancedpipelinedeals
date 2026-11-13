import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const state = { demo: false, session: null as any, profiles: { data: [] as any[], error: null as any } };
jest.mock('../config/demoMode', () => ({ isDemoMode: () => state.demo }));
jest.mock('../services/supabaseService', () => ({
  getSupabaseService: () => ({}),
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: state.session } }) },
    from: () => ({ select: () => ({ order: () => ({ limit: async () => state.profiles }) }) }),
  },
}));
jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/pipelineStageService', () => ({ getStages: jest.fn(() => Promise.resolve([])), subscribe: jest.fn(() => () => {}), DEFAULT_STAGES: [] }));

import * as svc from '../services/userDirectoryService';
import { useUserDirectoryStore } from '../store/userDirectoryStore';
import { useDealStore } from '../store/dealStore';

describe('userDirectoryService', () => {
  beforeEach(() => {
    state.demo = false;
    state.session = { user: { id: 'me', email: 'me@x.com', user_metadata: { full_name: 'Me Myself' } } };
    state.profiles = { data: [{ id: 'p1', name: 'Ann', avatar: 'a.png' }, { id: 'p2', name: null }], error: null };
    useDealStore.setState({ deals: {} });
    useUserDirectoryStore.setState({ users: [], loadedAt: null });
  });

  it('lists profiles plus the current user, sorted, without duplicates', async () => {
    state.profiles.data.push({ id: 'me', name: 'Me Myself' });
    const users = await svc.listUsers();
    expect(users.map(u => u.name)).toEqual(['Ann', 'Me Myself', 'Unnamed user']);
    expect(users.find(u => u.id === 'p1')?.avatar).toBe('a.png');
  });

  it('falls back to current user when profiles are unreadable (remote: no fake ids)', async () => {
    state.profiles = { data: [], error: { message: 'denied' } };
    useDealStore.setState({ deals: { d: { id: 'd', assignedTo: 'Zed' } as any } });
    const users = await svc.listUsers();
    expect(users).toEqual([{ id: 'me', name: 'Me Myself', avatar: undefined }]);
  });

  it('demo mode: current user + names found on deals', async () => {
    state.demo = true;
    state.session = null;
    useDealStore.setState({ deals: {
      a: { id: 'a', assignedTo: 'Zed' } as any,
      b: { id: 'b', assignedTo: 'zed' } as any,
      c: { id: 'c', assignedTo: 'Amy', ownerId: 'uid-1' } as any,
    } });
    const users = await svc.listUsers();
    expect(users.map(u => u.name)).toEqual(['Amy', 'Zed']);
    expect(users.find(u => u.name === 'Amy')?.id).toBe('uid-1');
    expect(users.find(u => u.name === 'Zed')?.id).toMatch(/^local-user-/);
  });

  it('filterUsers is case-insensitive', () => {
    expect(svc.filterUsers([{ id: '1', name: 'Ann' }, { id: '2', name: 'Bob' }], 'AN').map(u => u.id)).toEqual(['1']);
  });

  it('store caches within the TTL and search/getById read from it', async () => {
    const first = await useUserDirectoryStore.getState().load();
    state.profiles = { data: [], error: null };
    const second = await useUserDirectoryStore.getState().load();
    expect(second).toEqual(first);
    expect(useUserDirectoryStore.getState().search('ann').map(u => u.id)).toEqual(['p1']);
    expect(useUserDirectoryStore.getState().getById('me')?.name).toBe('Me Myself');
    const forced = await useUserDirectoryStore.getState().load(true);
    expect(forced.map(u => u.id)).toEqual(['me']);
  });
});
