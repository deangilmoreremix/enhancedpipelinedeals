import { chain } from '../test-utils/chain';

let demo = true;
const calls: Array<[string, string, unknown[]]> = [];
const results: Record<string, any> = {};
jest.mock('../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t: string) => {
      const c = chain(results[t] ?? { data: [], error: null });
      return new Proxy(c, {
        get(target, prop: string) {
          const v = target[prop];
          return typeof v === 'function' && prop !== 'then' ? (...a: unknown[]) => { calls.push([t, prop, a]); return v(...a); } : v;
        }
      });
    }
  }
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));
jest.mock('../services/dealRecordShared', () => ({
  getCurrentUserId: async () => 'user-1',
  isUuid: (v: string) => /^[0-9a-f-]{36}$/.test(v),
  localId: (p: string) => `${p}-${Math.random().toString(36).slice(2)}`,
  errorMessage: (e: any) => e?.message ?? 'err'
}));
jest.mock('../store/dealRecordStore', () => ({ pushToast: jest.fn() }));

import * as svc from '../services/favoriteFoldersService';
import { useFavoriteFoldersStore } from '../store/favoriteFoldersStore';

const U1 = '11111111-1111-1111-1111-111111111111';
const D1 = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  demo = true; calls.length = 0;
  Object.keys(results).forEach(k => delete results[k]);
  localStorage.clear();
  useFavoriteFoldersStore.getState().reset();
});

describe('favoriteFoldersService (local)', () => {
  it('creates, renames, files, reorders and deletes folders', async () => {
    const a = await svc.createFolder('  Hot  ', 0);
    const b = await svc.createFolder('Cold', 1);
    expect(a.name).toBe('Hot');
    await svc.renameFolder(a.id, 'Warm');
    await svc.addDealToFolder(a.id, 'd1', 0);
    await svc.addDealToFolder(a.id, 'd1', 0); // idempotent
    await svc.addDealToFolder(a.id, 'd2', 1);
    await svc.reorderFolderDeals(a.id, ['d2', 'd1']);
    await svc.reorderFolders([b.id, a.id]);
    let list = await svc.listFolders();
    expect(list.map(f => f.name)).toEqual(['Cold', 'Warm']);
    expect(list[1].dealIds).toEqual(['d2', 'd1']);
    await svc.removeDealFromFolder(a.id, 'd2');
    await svc.deleteFolder(b.id);
    list = await svc.listFolders();
    expect(list).toHaveLength(1);
    expect(list[0].dealIds).toEqual(['d1']);
  });

  it('validates names', async () => {
    await expect(svc.createFolder('   ', 0)).rejects.toThrow(/required/);
    await expect(svc.createFolder('x'.repeat(61), 0)).rejects.toThrow(/60/);
  });
});

describe('favoriteFoldersService (remote)', () => {
  beforeEach(() => { demo = false; });

  it('lists folders with their ordered items', async () => {
    results.favorite_folders = { data: [{ id: U1, name: 'F', position: 0 }], error: null };
    results.favorite_folder_items = { data: [{ folder_id: U1, deal_id: D1, position: 0 }], error: null };
    expect(await svc.listFolders()).toEqual([{ id: U1, name: 'F', position: 0, dealIds: [D1] }]);
  });

  it('inserts, upserts items and refuses non-uuid deals', async () => {
    results.favorite_folders = { data: [{ id: U1, name: 'F', position: 3 }], error: null };
    const f = await svc.createFolder('F', 3);
    expect(f.id).toBe(U1);
    expect(calls.find(c => c[0] === 'favorite_folders' && c[1] === 'insert')![2][0]).toMatchObject({ user_id: 'user-1', name: 'F', position: 3 });
    await svc.addDealToFolder(U1, D1, 0);
    expect(calls.some(c => c[0] === 'favorite_folder_items' && c[1] === 'upsert')).toBe(true);
    await expect(svc.addDealToFolder(U1, 'local-deal', 0)).rejects.toThrow(/saved deals/);
  });

  it('delete reports an RLS zero-row result', async () => {
    results.favorite_folder_items = { data: [], error: null };
    results.favorite_folders = { data: [], error: null };
    await expect(svc.deleteFolder(U1)).rejects.toBeTruthy();
  });
});

describe('favoriteFoldersStore', () => {
  it('optimistically creates/renames/moves/reorders and rolls back on failure', async () => {
    const s = useFavoriteFoldersStore.getState();
    await s.load();
    const a = (await s.createFolder('A'))!;
    const b = (await s.createFolder('B'))!;
    expect(useFavoriteFoldersStore.getState().folders.map(f => f.name)).toEqual(['A', 'B']);
    await s.addDeal(a.id, 'd1');
    await s.addDeal(a.id, 'd2');
    await s.moveDeal(a.id, b.id, 'd1');
    const st = () => useFavoriteFoldersStore.getState().folders;
    expect(st().find(f => f.id === a.id)!.dealIds).toEqual(['d2']);
    expect(st().find(f => f.id === b.id)!.dealIds).toEqual(['d1']);
    await s.reorderFolders([b.id, a.id]);
    expect(st().map(f => f.name)).toEqual(['B', 'A']);
    await s.renameFolder(a.id, 'Renamed');
    expect(st().find(f => f.id === a.id)!.name).toBe('Renamed');
    await s.createFolder('   '); // invalid: ignored
    expect(st()).toHaveLength(2);
    await s.deleteFolder(b.id);
    expect(st().map(f => f.id)).toEqual([a.id]);

    demo = false;
    useFavoriteFoldersStore.setState({ folders: [{ id: U1, name: 'Renamed', position: 0, dealIds: [] }] });
    results.favorite_folders = { data: null, error: new Error('denied') };
    await s.renameFolder(U1, 'Nope');
    expect(st()[0].name).toBe('Renamed');
  });
});
