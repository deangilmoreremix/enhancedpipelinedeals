import { chain } from '../test-utils/chain';

let demo = true;
let configured = false;
const upserts: any[] = [];
const results: Record<string, any> = {};
jest.mock('../lib/core/supabaseClient', () => ({
  get isSupabaseConfigured() { return configured; },
  supabase: {
    from: (t: string) => {
      const c = chain(results[t] ?? { data: null, error: null });
      return new Proxy(c, {
        get(target, prop: string) {
          const v = target[prop];
          if (prop === 'upsert') return (...a: unknown[]) => { upserts.push(a[0]); return v(...a); };
          return v;
        }
      });
    }
  }
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));
jest.mock('../services/dealRecordShared', () => ({
  getCurrentUserId: async () => 'user-1',
  isUuid: (v: string) => /^[0-9a-f-]{36}$/.test(v)
}));
jest.mock('../store/dealRecordStore', () => ({ pushToast: jest.fn() }));

import { loadPrefs, savePrefs, normalizePrefs, LS_PREFS_KEY } from '../services/dealViewPrefsService';
import { useDealViewPrefsStore } from '../store/dealViewPrefsStore';

const UUID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  demo = true; configured = false; upserts.length = 0;
  Object.keys(results).forEach(k => delete results[k]);
  localStorage.clear();
  useDealViewPrefsStore.getState().reset();
});

describe('normalizePrefs', () => {
  it('drops junk, trims and dedupes, accepts snake_case rows', () => {
    const p = normalizePrefs({ tab_order: ['a', ' a ', '', 3, 'b'], hiddenTabs: 'nope', hidden_field_groups: ['x'], pinned_deal_ids: ['d1', 'd1'] });
    expect(p).toEqual({ tabOrder: ['a', 'b'], hiddenTabs: [], hiddenFieldGroups: ['x'], pinnedDealIds: ['d1'] });
    expect(normalizePrefs(null)).toEqual({ tabOrder: [], hiddenTabs: [], hiddenFieldGroups: [], pinnedDealIds: [] });
  });
});

describe('dealViewPrefsService', () => {
  it('uses localStorage in demo mode', async () => {
    await savePrefs({ tabOrder: ['notes'], hiddenTabs: [], hiddenFieldGroups: [], pinnedDealIds: ['d1'] });
    expect(JSON.parse(localStorage.getItem(LS_PREFS_KEY)!).tabOrder).toEqual(['notes']);
    expect((await loadPrefs()).pinnedDealIds).toEqual(['d1']);
    expect(upserts).toHaveLength(0);
  });

  it('upserts uuid-only pins for the signed-in user and merges local-only pins on load', async () => {
    demo = false; configured = true;
    await savePrefs({ tabOrder: ['t'], hiddenTabs: ['h'], hiddenFieldGroups: ['g'], pinnedDealIds: [UUID, 'local-1'] });
    expect(upserts[0]).toMatchObject({ user_id: 'user-1', tab_order: ['t'], hidden_tabs: ['h'], hidden_field_groups: ['g'], pinned_deal_ids: [UUID] });
    results.deal_view_prefs = { data: { user_id: 'user-1', tab_order: ['t'], hidden_tabs: [], hidden_field_groups: [], pinned_deal_ids: [UUID] }, error: null };
    const p = await loadPrefs();
    expect(p.pinnedDealIds).toEqual([UUID, 'local-1']);
  });

  it('throws when the database rejects the save', async () => {
    demo = false; configured = true;
    results.deal_view_prefs = { data: null, error: new Error('boom') };
    await expect(savePrefs(normalizePrefs({}))).rejects.toThrow('boom');
  });
});

describe('dealViewPrefsStore', () => {
  it('applies updates optimistically and persists them', async () => {
    const s = useDealViewPrefsStore.getState();
    await s.getPrefs();
    const p = s.setTabOrder(['b', 'a']);
    expect(useDealViewPrefsStore.getState().prefs.tabOrder).toEqual(['b', 'a']); // before the save resolves
    await p;
    await s.setHiddenTabs(['files']);
    await s.toggleFieldGroup('financial');
    expect(useDealViewPrefsStore.getState().prefs.hiddenFieldGroups).toEqual(['financial']);
    await s.toggleFieldGroup('financial');
    expect(useDealViewPrefsStore.getState().prefs.hiddenFieldGroups).toEqual([]);
    await s.pin('d1');
    await s.pin('d1');
    expect(useDealViewPrefsStore.getState().prefs.pinnedDealIds).toEqual(['d1']);
    expect(s.isPinned('d1')).toBe(true);
    await s.unpin('d1');
    expect(s.isPinned('d1')).toBe(false);
    expect(JSON.parse(localStorage.getItem(LS_PREFS_KEY)!)).toMatchObject({ tabOrder: ['b', 'a'], hiddenTabs: ['files'] });
  });

  it('rolls back when persisting fails', async () => {
    demo = false; configured = true;
    results.deal_view_prefs = { data: null, error: new Error('nope') };
    const s = useDealViewPrefsStore.getState();
    await s.setHiddenTabs(['x']);
    expect(useDealViewPrefsStore.getState().prefs.hiddenTabs).toEqual([]);
  });

  it('rejects invalid input', async () => {
    await expect(useDealViewPrefsStore.getState().setTabOrder([1 as any])).rejects.toThrow(/tabOrder/);
    await expect(useDealViewPrefsStore.getState().pin('')).rejects.toThrow();
  });
});
