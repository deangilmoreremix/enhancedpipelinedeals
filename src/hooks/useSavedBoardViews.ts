import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SavedPipelineView,
  SavedPipelineViewService
} from '../services/savedPipelineViewService';
import { isViewDirty, useBoardViewStore } from '../store/boardViewStore';

export interface ViewStatus {
  type: 'success' | 'error';
  text: string;
}

/**
 * Loads saved views (table saved_pipeline_views) and exposes the picker actions: apply, save, save-as,
 * rename, delete, set default, share. The applied configuration lives in useBoardViewStore.
 */
export function useSavedBoardViews() {
  const [views, setViews] = useState<SavedPipelineView[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ViewStatus | null>(null);
  const statusTimer = useRef<number | undefined>(undefined);
  const defaultChecked = useRef(false);

  const activeViewId = useBoardViewStore(s => s.activeViewId);
  const dirty = useBoardViewStore(s => isViewDirty(s));
  const applyView = useBoardViewStore(s => s.applyView);
  const markSaved = useBoardViewStore(s => s.markSaved);
  const clearActiveView = useBoardViewStore(s => s.clearActiveView);

  const flash = useCallback((type: ViewStatus['type'], text: string) => {
    setStatus({ type, text });
    window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(null), 4000);
  }, []);
  useEffect(() => () => window.clearTimeout(statusTimer.current), []);

  const reload = useCallback(async () => {
    const rows = await SavedPipelineViewService.getAllViews();
    setViews(rows);
    return rows;
  }, []);

  // Initial load: drop a stale persisted selection, or apply the default view on a pristine board.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await reload();
      if (cancelled) return;
      setLoading(false);
      const s = useBoardViewStore.getState();
      if (s.activeViewId && !rows.some(v => v.id === s.activeViewId)) {
        s.clearActiveView();
        return;
      }
      if (!defaultChecked.current) {
        defaultChecked.current = true;
        const pristine = !s.activeViewId && s.filters.length === 0 && s.groups.length === 0 && s.sorting.length === 0
          && s.groupBy === 'stage' && !s.favoritesOnly && s.currentView === 'kanban';
        const def = rows.find(v => v.is_default);
        if (pristine && def) s.applyView(def);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const activeView = views.find(v => v.id === activeViewId) ?? null;

  const select = useCallback((view: SavedPipelineView) => {
    applyView(view);
    void SavedPipelineViewService.incrementUsage(view.id);
  }, [applyView]);

  const saveAs = useCallback(async (name: string, isPublic = false): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) { flash('error', 'Enter a name for the view'); return false; }
    const payload = useBoardViewStore.getState().getPayload();
    const created = await SavedPipelineViewService.saveCurrentView(trimmed, payload.view_type, payload.filters, payload.sorting, payload.columns, {
      groupBy: payload.group_by,
      isPublic
    });
    if (!created) { flash('error', 'Could not save the view (is the name already used?)'); return false; }
    markSaved(created.id);
    await reload();
    flash('success', `Saved view "${created.name}"`);
    return true;
  }, [flash, markSaved, reload]);

  /** Overwrite the active view with the current configuration. */
  const saveChanges = useCallback(async (): Promise<boolean> => {
    const id = useBoardViewStore.getState().activeViewId;
    if (!id) return false;
    const payload = useBoardViewStore.getState().getPayload();
    const ok = await SavedPipelineViewService.updateView(id, {
      filters: payload.filters,
      sorting: payload.sorting,
      group_by: payload.group_by,
      view_type: payload.view_type,
      columns: payload.columns
    });
    if (!ok) { flash('error', 'Could not update the view (you may not own it)'); return false; }
    markSaved(id);
    await reload();
    flash('success', 'View updated');
    return true;
  }, [flash, markSaved, reload]);

  const rename = useCallback(async (view: SavedPipelineView, name: string): Promise<boolean> => {
    const ok = await SavedPipelineViewService.renameView(view.id, name);
    if (!ok) { flash('error', 'Could not rename the view (is the name already used?)'); return false; }
    await reload();
    return true;
  }, [flash, reload]);

  const remove = useCallback(async (view: SavedPipelineView): Promise<boolean> => {
    const ok = await SavedPipelineViewService.deleteView(view.id);
    if (!ok) { flash('error', 'Could not delete the view'); return false; }
    if (useBoardViewStore.getState().activeViewId === view.id) clearActiveView();
    await reload();
    flash('success', `Deleted "${view.name}"`);
    return true;
  }, [clearActiveView, flash, reload]);

  const toggleDefault = useCallback(async (view: SavedPipelineView) => {
    const ok = view.is_default
      ? await SavedPipelineViewService.clearDefaultView(view.id)
      : await SavedPipelineViewService.setDefaultView(view.id);
    if (!ok) flash('error', 'Could not change the default view');
    await reload();
  }, [flash, reload]);

  const togglePublic = useCallback(async (view: SavedPipelineView) => {
    const ok = await SavedPipelineViewService.setPublic(view.id, !view.is_public);
    if (!ok) flash('error', 'Could not change sharing (you may not own this view)');
    else flash('success', view.is_public ? 'View is private again' : 'View shared with everyone');
    await reload();
  }, [flash, reload]);

  return { views, loading, status, activeView, activeViewId, dirty, select, saveAs, saveChanges, rename, remove, toggleDefault, togglePublic, reload };
}
