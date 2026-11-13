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

/** Layout the pipeline is rendered in (persisted; saved views carry it). */
export type BoardViewType = 'kanban' | 'list' | 'table' | 'calendar' | 'dashboard' | 'timeline';
export const BOARD_VIEW_TYPES: BoardViewType[] = ['kanban', 'list', 'table', 'calendar', 'dashboard', 'timeline'];
export const isBoardViewType = (v: unknown): v is BoardViewType => BOARD_VIEW_TYPES.includes(v as BoardViewType);

/** Table / list column keys, in the default order. */
export type TableColumnKey =
  | 'title' | 'company' | 'contact' | 'owner' | 'value' | 'stage' | 'priority'
  | 'probability' | 'closeDate' | 'dueDate' | 'updated' | 'aiScore';

export interface TableColumnConfig {
  key: TableColumnKey;
  visible: boolean;
  /** Pixel width (table only); undefined = auto. */
  width?: number;
}

export const TABLE_COLUMN_LABELS: Record<TableColumnKey, string> = {
  title: 'Deal Title', company: 'Company', contact: 'Contact', owner: 'Owner', value: 'Value', stage: 'Stage',
  priority: 'Priority', probability: 'Win %', closeDate: 'Close date', dueDate: 'Due date', updated: 'Updated', aiScore: 'AI Score'
};

export const DEFAULT_TABLE_COLUMNS: TableColumnConfig[] = [
  { key: 'title', visible: true },
  { key: 'company', visible: true },
  { key: 'contact', visible: true },
  { key: 'owner', visible: false },
  { key: 'value', visible: true },
  { key: 'stage', visible: true },
  { key: 'priority', visible: false },
  { key: 'probability', visible: true },
  { key: 'closeDate', visible: false },
  { key: 'dueDate', visible: false },
  { key: 'updated', visible: true },
  { key: 'aiScore', visible: true }
];

const COLUMN_KEYS = Object.keys(TABLE_COLUMN_LABELS) as TableColumnKey[];

/** Coerce stored columns (saved view / persisted state) into a complete, ordered, de-duplicated list. */
export function normalizeTableColumns(raw: unknown): TableColumnConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_TABLE_COLUMNS.map(c => ({ ...c }));
  const seen = new Set<string>();
  const out: TableColumnConfig[] = [];
  raw.forEach(c => {
    const key = (c && typeof c === 'object' ? (c as any).key : c) as TableColumnKey;
    if (!COLUMN_KEYS.includes(key) || seen.has(key)) return;
    seen.add(key);
    const width = typeof (c as any)?.width === 'number' && (c as any).width > 0 ? Math.round((c as any).width) : undefined;
    out.push({ key, visible: typeof c === 'object' ? (c as any).visible !== false : true, ...(width ? { width } : {}) });
  });
  // Keys missing from the stored list are appended hidden (so new columns stay opt-in)
  DEFAULT_TABLE_COLUMNS.forEach(d => { if (!seen.has(d.key)) out.push({ key: d.key, visible: false }); });
  return out;
}

export interface BoardViewPayload {
  filters: SavedViewFilters;
  sorting: ViewSort[];
  group_by: BoardGroupBy;
  /** Layout: saved as saved_pipeline_views.view_type. */
  view_type: BoardViewType;
  /** Table/list column keys, order and widths: saved as saved_pipeline_views.columns. */
  columns: TableColumnConfig[];
}

interface BoardViewState {
  search: string;
  favoritesOnly: boolean;
  filters: ViewFilter[];
  groups: AdvancedFilterGroup[];
  sorting: ViewSort[];
  groupBy: BoardGroupBy;
  /** Current layout (kanban | list | table | calendar | dashboard | timeline). */
  currentView: BoardViewType;
  /** Table/list column configuration (order, visibility, widths). */
  tableColumns: TableColumnConfig[];
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
  setCurrentView: (v: BoardViewType) => void;
  setTableColumns: (cols: TableColumnConfig[]) => void;
  toggleTableColumn: (key: TableColumnKey) => void;
  moveTableColumn: (key: TableColumnKey, dir: -1 | 1) => void;
  setTableColumnWidth: (key: TableColumnKey, width: number | undefined) => void;
  /** Click-to-sort on a column header: asc -> desc -> asc on the same field; replaces the sort rules. */
  toggleSortField: (field: string, defaultDirection?: 'asc' | 'desc') => void;
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
  currentView: 'kanban' as BoardViewType,
  tableColumns: DEFAULT_TABLE_COLUMNS.map(c => ({ ...c })) as TableColumnConfig[],
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
      setCurrentView: (currentView) => set({ currentView }),
      setTableColumns: (cols) => set({ tableColumns: normalizeTableColumns(cols) }),
      toggleTableColumn: (key) => set(s => {
        const cols = s.tableColumns.map(c => (c.key === key ? { ...c, visible: !c.visible } : c));
        // Never hide the last visible column
        return cols.some(c => c.visible) ? { tableColumns: cols } : {};
      }),
      moveTableColumn: (key, dir) => set(s => {
        const cols = [...s.tableColumns];
        const i = cols.findIndex(c => c.key === key);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= cols.length) return {};
        [cols[i], cols[j]] = [cols[j], cols[i]];
        return { tableColumns: cols };
      }),
      setTableColumnWidth: (key, width) => set(s => ({
        tableColumns: s.tableColumns.map(c => {
          if (c.key !== key) return c;
          const { width: _w, ...rest } = c;
          return width && width > 0 ? { ...rest, width: Math.round(width) } : rest;
        })
      })),
      toggleSortField: (field, defaultDirection = 'desc') => set(s => {
        const cur = s.sorting[0];
        const direction = cur && cur.field === field && s.sorting.length === 1
          ? (cur.direction === 'asc' ? 'desc' : 'asc')
          : defaultDirection;
        return { sorting: withPriorities([{ field, direction, priority: 0 }]) };
      }),

      applyView: (view) => {
        const f = normalizeSavedFilters(view.filters);
        const sorting = withPriorities(normalizeSavedSorting(view.sorting));
        const groupBy = isBoardGroupBy(view.group_by) ? view.group_by : 'stage';
        // Legacy 'board' rows (and anything unknown) mean the kanban layout
        const currentView: BoardViewType = isBoardViewType(view.view_type) ? view.view_type : 'kanban';
        const tableColumns = normalizeTableColumns(view.columns);
        set({
          filters: f.conditions,
          groups: f.groups,
          search: f.search,
          favoritesOnly: f.favoritesOnly,
          sorting,
          groupBy,
          currentView,
          tableColumns,
          activeViewId: view.id
        });
        set({ appliedSnapshot: JSON.stringify(get().getPayload()) });
      },

      markSaved: (viewId) => set({ activeViewId: viewId, appliedSnapshot: viewId ? JSON.stringify(get().getPayload()) : null }),
      clearActiveView: () => set({ activeViewId: null, appliedSnapshot: null }),

      getPayload: () => {
        const s = get();
        return {
          filters: { conditions: s.filters, groups: s.groups, search: s.search, favoritesOnly: s.favoritesOnly },
          sorting: s.sorting,
          group_by: s.groupBy,
          view_type: s.currentView,
          columns: s.tableColumns
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
      version: 2,
      // v1 -> v2 only adds currentView/tableColumns (defaults come from the initial state)
      migrate: (persisted) => persisted as unknown as BoardViewState,
      storage: createJSONStorage(() => safeStorage),
      // Search text and one-shot actions are session-only
      partialize: (s) => ({
        favoritesOnly: s.favoritesOnly,
        filters: s.filters,
        groups: s.groups,
        sorting: s.sorting,
        groupBy: s.groupBy,
        currentView: s.currentView,
        tableColumns: s.tableColumns,
        activeViewId: s.activeViewId,
        appliedSnapshot: s.appliedSnapshot
      }) as unknown as BoardViewState
    }
  )
);

/** True when the live configuration differs from the active saved view. */
export const isViewDirty = (s: Pick<BoardViewState, 'activeViewId' | 'appliedSnapshot' | 'getPayload'>): boolean =>
  !!s.activeViewId && s.appliedSnapshot !== JSON.stringify(s.getPayload());
