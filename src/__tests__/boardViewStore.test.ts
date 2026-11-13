jest.mock('../services/supabaseService', () => ({ supabase: {}, isSupabaseConfigured: false }));

import { BOARD_VIEW_STORAGE_KEY, isViewDirty, presetForSorting, sortingForPreset, useBoardViewStore } from '../store/boardViewStore';
import type { SavedPipelineView } from '../services/savedPipelineViewService';

const setStorage = (api: unknown) => Object.defineProperty(window, 'localStorage', { value: api, configurable: true });

const makeStorage = () => {
  const data = new Map<string, string>();
  return {
    data,
    api: {
      getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
      setItem: (k: string, v: string) => { data.set(k, v); },
      removeItem: (k: string) => { data.delete(k); },
      clear: () => data.clear()
    }
  };
};

const view = (over: Partial<SavedPipelineView> = {}): SavedPipelineView => ({
  id: 'v1', user_id: null, name: 'Hot deals', view_type: 'board',
  filters: { conditions: [{ field: 'priority', operator: 'equals', value: 'high' }], groups: [], search: 'acme', favoritesOnly: true },
  sorting: [{ field: 'value', direction: 'desc', priority: 0 }], group_by: 'owner', columns: [],
  is_default: false, is_public: false, tags: [], usage_count: 0, created_at: '2026-01-01', updated_at: '2026-01-01', ...over
});

describe('boardViewStore', () => {
  let storage: ReturnType<typeof makeStorage>;
  beforeEach(() => {
    storage = makeStorage();
    setStorage(storage.api);
    useBoardViewStore.getState().reset();
  });

  it('merges search, favorites, filters, sort and group-by in one place', () => {
    const s = useBoardViewStore.getState();
    s.setSearch('acme');
    s.setFavoritesOnly(true);
    s.addFilter({ field: 'stage', operator: 'equals', value: 'lead' });
    s.setSortPreset('value');
    s.setGroupBy('priority');
    const st = useBoardViewStore.getState();
    expect(st).toMatchObject({ search: 'acme', favoritesOnly: true, groupBy: 'priority' });
    expect(st.filters).toHaveLength(1);
    expect(presetForSorting(st.sorting)).toBe('value');
    st.clearFilters();
    expect(useBoardViewStore.getState()).toMatchObject({ search: '', favoritesOnly: false, filters: [], groups: [] });
  });

  it('maps sort presets both ways', () => {
    expect(sortingForPreset('manual')).toEqual([]);
    expect(presetForSorting([])).toBe('manual');
    expect(presetForSorting([{ field: 'title', direction: 'asc', priority: 0 }])).toBe('title');
    expect(presetForSorting([{ field: 'title', direction: 'desc', priority: 0 }])).toBe('custom');
    expect(presetForSorting([{ field: 'value', direction: 'desc', priority: 0 }, { field: 'title', direction: 'asc', priority: 1 }])).toBe('custom');
  });

  it('persists filters, sort, group-by and the active view (but not the search text) to localStorage', async () => {
    const s = useBoardViewStore.getState();
    s.setSearch('transient');
    s.addFilter({ field: 'value', operator: 'greater_than', value: 100 });
    s.setSorting([{ field: 'company', direction: 'asc', priority: 0 }]);
    s.setGroupBy('company');
    s.setFavoritesOnly(true);

    const raw = storage.data.get(BOARD_VIEW_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw!).state;
    expect(saved).toMatchObject({ groupBy: 'company', favoritesOnly: true });
    expect(saved.filters).toEqual([{ field: 'value', operator: 'greater_than', value: 100 }]);
    expect(saved.search).toBeUndefined();

    // simulate a reload: wipe memory state, then rehydrate from storage
    useBoardViewStore.setState({ filters: [], sorting: [], groupBy: 'stage', favoritesOnly: false, search: '' });
    storage.data.set(BOARD_VIEW_STORAGE_KEY, raw!); // what the previous session left behind
    await useBoardViewStore.persist.rehydrate();
    expect(useBoardViewStore.getState()).toMatchObject({
      groupBy: 'company', favoritesOnly: true, filters: [{ field: 'value', operator: 'greater_than', value: 100 }], search: ''
    });
    expect(useBoardViewStore.getState().sorting[0]).toMatchObject({ field: 'company' });
  });

  it('survives unavailable storage', () => {
    setStorage({ getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    expect(() => useBoardViewStore.getState().setGroupBy('owner')).not.toThrow();
    expect(useBoardViewStore.getState().groupBy).toBe('owner');
  });

  it('applies a saved view and tracks unsaved changes', () => {
    useBoardViewStore.getState().applyView(view());
    let st = useBoardViewStore.getState();
    expect(st).toMatchObject({ activeViewId: 'v1', groupBy: 'owner', search: 'acme', favoritesOnly: true });
    expect(st.filters).toEqual([{ field: 'priority', operator: 'equals', value: 'high' }]);
    expect(isViewDirty(st)).toBe(false);

    st.addFilter({ field: 'value', operator: 'greater_than', value: 1 });
    expect(isViewDirty(useBoardViewStore.getState())).toBe(true);
    useBoardViewStore.getState().markSaved('v1');
    expect(isViewDirty(useBoardViewStore.getState())).toBe(false);

    useBoardViewStore.getState().clearActiveView();
    st = useBoardViewStore.getState();
    expect(st.activeViewId).toBeNull();
    expect(isViewDirty(st)).toBe(false);
  });

  it('accepts legacy filter shapes and unknown group-by values', () => {
    useBoardViewStore.getState().applyView(view({ filters: [{ field: 'stage', operator: 'equals', value: 'lead' }], group_by: 'bogus', sorting: null }));
    const st = useBoardViewStore.getState();
    expect(st.filters).toHaveLength(1);
    expect(st.groupBy).toBe('stage');
    expect(st.sorting).toEqual([]);
  });

  it('hands one-shot actions to the board exactly once', () => {
    useBoardViewStore.getState().requestAction('export');
    expect(useBoardViewStore.getState().consumeAction()).toBe('export');
    expect(useBoardViewStore.getState().consumeAction()).toBeNull();
  });
});
