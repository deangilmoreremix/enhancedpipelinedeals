import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import type { AdvancedFilterGroup, ViewFilter, ViewSort } from '../types';
import {
  SavedPipelineView,
  SavedViewFilters,
  normalizeSavedFilters,
  normalizeSavedSorting
} from '../services/savedPipelineViewService';
import type { BoardSortKey } from '../components/pipeline/kanban/kanbanUtils';

export type BoardGroupBy = 'stage' | 'owner' | 'priority' | 'company';
export const BOARD_GROUP_OPTIONS: Array<{ id: BoardGroupBy; label: string }> = [
  { id: 'stage', label: 'Stage' },
  { id: 'owner', label: 'Owner' },
  { id: 'priority', label: 'Priority' },
  { id: 'company', label: 'Company' }
];

/** One-shot UI requests (from the command palette) that the board consumes when mounted. */
export type BoardActionRequest =
  | 'new-deal'
  | 'show-deleted'
  | 'find-duplicates'
  | 'export'
  | 'import';

const PRESET_SORTS: Record<Exclude<BoardSortKey, 'manual'>, ViewSort[]> = {
  value: [{ field: 'value', direction: 'desc', priority: 0 }],
  createdAt: [{ field: 'createdAt', direction: 'desc', priority: 0 }],
  probability: [{ field: 'probability', direction: 'desc', priority: 0 }],
  title: [{ field: 'title', direction: 'asc', priority: 0 }]
};

/** ViewSort[] equivalent of a quick-sort preset (manual = no explicit sort). */
export const sortingForPreset = (key: BoardSortKey): ViewSort[] =>
  key === 'manual' ? [] : PRESET_SORTS[key].map(s => ({ ...s }));

/** Preset that exactly matches `sorting`, 'manual' when empty, 'custom' for anything else. */
export const presetForSorting = (sorting: ViewSort[]): BoardSortKey | 'custom' => {
  if (sorting.length === 0) return 'manual';
  if (sorting.length === 1) {
    for (const [key, preset] of Object.entries(PRESET_SORTS)) {
      if (preset[0].field === sorting[0].field && preset[0].direction === sorting[0].direction) return key as BoardSortKey;
    }
  }
  return 'custom';
};

export interface BoardViewPayload {
  filters: SavedViewFilters;
  sorting: ViewSort[];
  group_by: BoardGroupBy;
}

interface BoardViewState {
  search: string;
  favoritesOnly: boolean;
  filters: ViewFilter[];
  groups: AdvancedFilterGroup[];
  sorting: ViewSort[];
  groupBy: BoardGroupBy;
  activeViewId: string | null;
  /** JSON of the payload when the active view was applied/saved (detects unsaved changes). */
  appliedSnapshot: string | null;
  pendingAction: BoardActionRequest | null;

  setSearch: (q: string) => void;
  setFavoritesOnly: (on: boolean) => void;
  addFilter: (filter: ViewFilter) => void;
  updateFilter: (index: number, filter: ViewFilter) => void;
  removeFilter: (index: number) => void;
  setFilters: (filters: ViewFilter[]) => void;
  setGroups: (groups: AdvancedFilterGroup[]) => void;
  /** Clears chips, advanced groups, favorites and search (not sort/group). */
  clearFilters: () => void;
  setSorting: (sorting: ViewSort[]) => void;
  setSortPreset: (key: BoardSortKey) => void;
  setGroupBy: (g: BoardGroupBy) => void;
  applyView: (view: SavedPipelineView) => void;
  /** Mark the current configuration as the saved state of `viewId` (after save / save-as). */
  markSaved: (viewId: string | null) => void;
  clearActiveView: () => void;
  getPayload: () => BoardViewPayload;
  requestAction: (a: BoardActionRequest) => void;
  consumeAction: () => BoardActionRequest | null;
  reset: () => void;
}

export const VALID_GROUPS: BoardGroupBy[] = ['stage', 'owner', 'priority', 'company'];
export const isBoardGroupBy = (v: unknown): v is BoardGroupBy => VALID_GROUPS.includes(v as BoardGroupBy);

/** localStorage access that never throws (private mode, SSR, tests). */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try { return typeof localStorage !== 'undefined' ? localStorage.getItem(name) ?? null : null; } catch { return null; }
  },
  setItem: (name, value) => {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(name, value); } catch { /* ignore */ }
  },
  removeItem: (name) => {
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(name); } catch { /* ignore */ }
  }
};

export const BOARD_VIEW_STORAGE_KEY = 'board-view-v1';

const initial = {
  search: '',
  favoritesOnly: false,
  filters: [] as ViewFilter[],
  groups: [] as AdvancedFilterGroup[],
  sorting: [] as ViewSort[],
  groupBy: 'stage' as BoardGroupBy,
  activeViewId: null as string | null,
  appliedSnapshot: null as string | null,
  pendingAction: null as BoardActionRequest | null
};

const withPriorities = (sorting: ViewSort[]): ViewSort[] => sorting.map((s, i) => ({ ...s, priority: i }));

export const useBoardViewStore = create<BoardViewState>()(
  persist(
    (set, get) => ({
      ...initial,

      setSearch: (search) => set({ search }),
      setFavoritesOnly: (favoritesOnly) => set({ favoritesOnly }),
      addFilter: (filter) => set(s => ({ filters: [...s.filters, filter] })),
      updateFilter: (index, filter) => set(s => ({ filters: s.filters.map((f, i) => (i === index ? filter : f)) })),
      removeFilter: (index) => set(s => ({ filters: s.filters.filter((_, i) => i !== index) })),
      setFilters: (filters) => set({ filters }),
      setGroups: (groups) => set({ groups }),
      clearFilters: () => set({ filters: [], groups: [], favoritesOnly: false, search: '' }),
      setSorting: (sorting) => set({ sorting: withPriorities(sorting) }),
      setSortPreset: (key) => set({ sorting: sortingForPreset(key) }),
      setGroupBy: (groupBy) => set({ groupBy }),

      applyView: (view) => {
        const f = normalizeSavedFilters(view.filters);
        const sorting = withPriorities(normalizeSavedSorting(view.sorting));
        const groupBy = isBoardGroupBy(view.group_by) ? view.group_by : 'stage';
        const payload: BoardViewPayload = { filters: f, sorting, group_by: groupBy };
        set({
          filters: f.conditions,
          groups: f.groups,
          search: f.search,
          favoritesOnly: f.favoritesOnly,
          sorting,
          groupBy,
          activeViewId: view.id,
          appliedSnapshot: JSON.stringify(payload)
        });
      },

      markSaved: (viewId) => set({ activeViewId: viewId, appliedSnapshot: viewId ? JSON.stringify(get().getPayload()) : null }),
      clearActiveView: () => set({ activeViewId: null, appliedSnapshot: null }),

      getPayload: () => {
        const s = get();
        return {
          filters: { conditions: s.filters, groups: s.groups, search: s.search, favoritesOnly: s.favoritesOnly },
          sorting: s.sorting,
          group_by: s.groupBy
        };
      },

      requestAction: (pendingAction) => set({ pendingAction }),
      consumeAction: () => {
        const a = get().pendingAction;
        if (a) set({ pendingAction: null });
        return a;
      },

      reset: () => set({ ...initial })
    }),
    {
      name: BOARD_VIEW_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      // Search text and one-shot actions are session-only
      partialize: (s) => ({
        favoritesOnly: s.favoritesOnly,
        filters: s.filters,
        groups: s.groups,
        sorting: s.sorting,
        groupBy: s.groupBy,
        activeViewId: s.activeViewId,
        appliedSnapshot: s.appliedSnapshot
      }) as unknown as BoardViewState
    }
  )
);

/** True when the live configuration differs from the active saved view. */
export const isViewDirty = (s: Pick<BoardViewState, 'activeViewId' | 'appliedSnapshot' | 'getPayload'>): boolean =>
  !!s.activeViewId && s.appliedSnapshot !== JSON.stringify(s.getPayload());
