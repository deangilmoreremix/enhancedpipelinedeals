jest.mock('../services/supabaseService', () => ({ supabase: {}, isSupabaseConfigured: false }));

import {
  useBoardViewStore, isViewDirty, normalizeTableColumns, DEFAULT_TABLE_COLUMNS, BOARD_VIEW_STORAGE_KEY
} from '../store/boardViewStore';
import { SavedPipelineViewService, SavedPipelineView } from '../services/savedPipelineViewService';

const view = (over: Partial<SavedPipelineView> = {}): SavedPipelineView => ({
  id: 'v1', user_id: null, name: 'V', view_type: 'board', filters: {}, sorting: [], group_by: null, columns: [],
  is_default: false, is_public: false, tags: [], usage_count: 0, created_at: '', updated_at: '', ...over,
});

beforeEach(() => {
  localStorage.clear();
  useBoardViewStore.getState().reset();
});

describe('board view type + columns in saved views', () => {
  it('payload carries the view type and the table column configuration', () => {
    const st = useBoardViewStore.getState();
    st.setCurrentView('table');
    st.toggleTableColumn('priority');
    st.toggleTableColumn('contact');
    st.moveTableColumn('priority', -1);
    st.setTableColumnWidth('title', 240);
    const payload = useBoardViewStore.getState().getPayload();
    expect(payload.view_type).toBe('table');
    expect(payload.columns.find(c => c.key === 'priority')).toMatchObject({ visible: true });
    expect(payload.columns.find(c => c.key === 'contact')).toMatchObject({ visible: false });
    expect(payload.columns.find(c => c.key === 'title')).toMatchObject({ width: 240 });
    // priority moved up one slot
    const keys = payload.columns.map(c => c.key);
    expect(keys.indexOf('priority')).toBe(DEFAULT_TABLE_COLUMNS.findIndex(c => c.key === 'priority') - 1);
  });

  it('round trip: saving then applying restores view type, columns, sort and grouping', async () => {
    const st = useBoardViewStore.getState();
    st.setCurrentView('list');
    st.toggleTableColumn('owner');
    st.setTableColumnWidth('company', 180);
    st.setSorting([{ field: 'value', direction: 'desc', priority: 0 }]);
    const p = useBoardViewStore.getState().getPayload();

    const saved = await SavedPipelineViewService.saveCurrentView('My list', p.view_type, p.filters, p.sorting, p.columns, { groupBy: p.group_by });
    expect(saved?.view_type).toBe('list');

    useBoardViewStore.getState().reset();
    expect(useBoardViewStore.getState().currentView).toBe('kanban');
    useBoardViewStore.getState().applyView(saved as SavedPipelineView);

    const after = useBoardViewStore.getState();
    expect(after.currentView).toBe('list');
    expect(after.tableColumns).toEqual(p.columns);
    expect(after.tableColumns.find(c => c.key === 'owner')?.visible).toBe(true);
    expect(after.tableColumns.find(c => c.key === 'company')?.width).toBe(180);
    expect(after.sorting).toEqual([{ field: 'value', direction: 'desc', priority: 0 }]);
    expect(after.activeViewId).toBe(saved?.id);
    expect(isViewDirty(after)).toBe(false);
  });

  it('is dirty after switching layout, and updating the saved view clears it', async () => {
    const created = await SavedPipelineViewService.saveCurrentView('K', 'kanban', {}, [], DEFAULT_TABLE_COLUMNS) as SavedPipelineView;
    useBoardViewStore.getState().applyView(created);
    expect(isViewDirty(useBoardViewStore.getState())).toBe(false);
    useBoardViewStore.getState().setCurrentView('calendar');
    expect(isViewDirty(useBoardViewStore.getState())).toBe(true);

    const p = useBoardViewStore.getState().getPayload();
    expect(await SavedPipelineViewService.updateView(created.id, { view_type: p.view_type, columns: p.columns })).toBe(true);
    useBoardViewStore.getState().markSaved(created.id);
    expect(isViewDirty(useBoardViewStore.getState())).toBe(false);
    expect((await SavedPipelineViewService.getViewById(created.id))?.view_type).toBe('calendar');
  });

  it('legacy "board" rows (and unknown types) open as the kanban layout with default columns', () => {
    useBoardViewStore.getState().setCurrentView('table');
    useBoardViewStore.getState().applyView(view({ view_type: 'board', columns: [] }));
    expect(useBoardViewStore.getState().currentView).toBe('kanban');
    expect(useBoardViewStore.getState().tableColumns).toEqual(DEFAULT_TABLE_COLUMNS);
    useBoardViewStore.getState().applyView(view({ view_type: 'dashboard' }));
    expect(useBoardViewStore.getState().currentView).toBe('dashboard');
  });

  it('normalizes stored columns: drops unknown keys, de-duplicates, appends missing ones hidden', () => {
    const cols = normalizeTableColumns([
      { key: 'value', visible: true, width: 120 }, { key: 'nope', visible: true }, { key: 'value', visible: false }, { key: 'title' },
    ]);
    expect(cols.slice(0, 2)).toEqual([{ key: 'value', visible: true, width: 120 }, { key: 'title', visible: true }]);
    expect(cols.length).toBe(DEFAULT_TABLE_COLUMNS.length);
    expect(cols.slice(2).every(c => c.visible === false)).toBe(true);
    expect(normalizeTableColumns(undefined)).toEqual(DEFAULT_TABLE_COLUMNS);
  });

  it('never hides the last visible column', () => {
    const st = useBoardViewStore.getState();
    st.setTableColumns([{ key: 'title', visible: true }]);
    st.toggleTableColumn('title');
    expect(useBoardViewStore.getState().tableColumns.find(c => c.key === 'title')?.visible).toBe(true);
  });

  it('the current view and columns are persisted (survive a reload)', () => {
    useBoardViewStore.getState().setCurrentView('timeline');
    useBoardViewStore.getState().toggleTableColumn('closeDate');
    const raw = JSON.parse(localStorage.getItem(BOARD_VIEW_STORAGE_KEY) as string);
    expect(raw.state.currentView).toBe('timeline');
    expect(raw.state.tableColumns.find((c: { key: string }) => c.key === 'closeDate').visible).toBe(true);
  });

  it('toggleSortField: first click uses the default direction, then flips', () => {
    const st = useBoardViewStore.getState();
    st.toggleSortField('value', 'desc');
    expect(useBoardViewStore.getState().sorting).toEqual([{ field: 'value', direction: 'desc', priority: 0 }]);
    useBoardViewStore.getState().toggleSortField('value', 'desc');
    expect(useBoardViewStore.getState().sorting[0].direction).toBe('asc');
    useBoardViewStore.getState().toggleSortField('title', 'asc');
    expect(useBoardViewStore.getState().sorting).toEqual([{ field: 'title', direction: 'asc', priority: 0 }]);
  });
});
