import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useDealStore } from '../../store/dealStore';
import { usePermissions } from '../../hooks/usePermissions';
import {
  createDashboard, createWidget, deleteDashboard, deleteWidget, listDashboards, renameDashboard, saveWidgetOrder, updateWidget,
} from '../../services/dashboardService';
import { errorMessage } from '../../services/dealRecordShared';
import { toastFailure } from '../../utils/permissionToast';
import { pushToast } from '../../store/dealRecordStore';
import DealToasts from '../deals/DealToasts';
import { BTN, BTN_DANGER, BTN_PRIMARY, CONTROL } from '../ui/buttonStyles';
import { DashboardRecord, WidgetConfig, WidgetRecord, reorderWidgets } from './widgetModel';
import { WidgetCard } from './WidgetCard';
import { WidgetEditor } from './WidgetEditor';
import { useDashboardSources } from './useDashboardSources';

const LAST_KEY = 'pipeline.dashboards.last';
const remember = (id: string | null) => { try { if (id) localStorage.setItem(LAST_KEY, id); } catch { /* storage blocked */ } };
const recall = (): string | null => { try { return localStorage.getItem(LAST_KEY); } catch { return null; } };

export const DashboardsTab: React.FC = () => {
  const perms = usePermissions();
  const canEdit = perms.allowed('create', 'view');
  const stages = useDealStore(s => s.stages);
  const data = useDashboardSources();
  const [dashboards, setDashboards] = useState<DashboardRecord[]>([]);
  const [widgets, setWidgets] = useState<WidgetRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [naming, setNaming] = useState<null | { mode: 'new' | 'rename'; value: string }>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editor, setEditor] = useState<null | { widget: WidgetRecord | null }>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const r = await listDashboards();
      setDashboards(r.dashboards); setWidgets(r.widgets);
      setActiveId(cur => (cur && r.dashboards.some(d => d.id === cur) ? cur : (r.dashboards.find(d => d.id === recall()) ?? r.dashboards[0])?.id ?? null));
    } catch (e) { setLoadError(errorMessage(e, 'Failed to load dashboards')); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const active = dashboards.find(d => d.id === activeId) ?? null;
  const list = widgets.filter(w => w.dashboardId === activeId).sort((a, b) => a.order - b.order);

  const submitName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naming || !naming.value.trim()) return;
    try {
      if (naming.mode === 'new') {
        const d = await createDashboard(naming.value);
        setDashboards(p => [...p, d]); setActiveId(d.id); remember(d.id);
      } else if (active) {
        const before = dashboards;
        setDashboards(p => p.map(d => (d.id === active.id ? { ...d, name: naming.value.trim() } : d)));
        try { await renameDashboard(active.id, naming.value); } catch (err) { setDashboards(before); throw err; }
      }
      setNaming(null);
    } catch (err) { toastFailure(err, naming.mode === 'new' ? 'create' : 'edit', 'dashboard', `Could not save dashboard: ${errorMessage(err)}`); }
  };

  const removeDashboard = async () => {
    if (!active) return;
    const before = { dashboards, widgets };
    setDashboards(p => p.filter(d => d.id !== active.id)); setWidgets(p => p.filter(w => w.dashboardId !== active.id));
    setActiveId(dashboards.find(d => d.id !== active.id)?.id ?? null); setConfirmDelete(false);
    try { await deleteDashboard(active.id); pushToast('info', `Deleted dashboard "${active.name}"`); } catch (err) {
      setDashboards(before.dashboards); setWidgets(before.widgets); setActiveId(active.id);
      toastFailure(err, 'delete', 'dashboard', `Could not delete dashboard: ${errorMessage(err)}`);
    }
  };

  const saveWidget = async (title: string, config: WidgetConfig) => {
    const target = editor?.widget ?? null;
    setEditor(null);
    if (!activeId) return;
    try {
      if (target) {
        const next = { ...target, title, config };
        const before = widgets;
        setWidgets(p => p.map(w => (w.id === target.id ? next : w)));
        try { await updateWidget(next); } catch (err) { setWidgets(before); throw err; }
      } else {
        const order = list.length ? Math.max(...list.map(w => w.order)) + 1 : 0;
        const w = await createWidget(activeId, title, config, order);
        setWidgets(p => [...p, w]);
      }
    } catch (err) { toastFailure(err, target ? 'edit' : 'create', 'dashboard', `Could not save widget: ${errorMessage(err)}`); }
  };

  const persistOrder = async (before: WidgetRecord[], changed: WidgetRecord[]) => {
    try { await saveWidgetOrder(changed); } catch (err) {
      setWidgets(before);
      toastFailure(err, 'edit', 'dashboard', `Could not save widget order: ${errorMessage(err)}`);
    }
  };
  const move = (w: WidgetRecord, dir: -1 | 1) => {
    const before = widgets;
    const re = reorderWidgets(list, w.id, dir);
    const changed = re.filter(r => list.find(x => x.id === r.id)?.order !== r.order);
    setWidgets(p => p.map(x => re.find(r => r.id === x.id) ?? x));
    void persistOrder(before, changed);
  };
  const resize = (w: WidgetRecord, cols: 1 | 2 | 3) => {
    const next = { ...w, config: { ...w.config, cols } };
    const before = widgets;
    setWidgets(p => p.map(x => (x.id === w.id ? next : x)));
    void persistOrder(before, [next]);
  };
  const removeWidget = async (w: WidgetRecord) => {
    const before = widgets;
    setWidgets(p => p.filter(x => x.id !== w.id));
    try { await deleteWidget(w.id); } catch (err) { setWidgets(before); toastFailure(err, 'delete', 'dashboard', `Could not remove widget: ${errorMessage(err)}`); }
  };

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Loading dashboards…</p>;
  if (loadError) {
    return (
      <div role="alert" className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
        <span>{loadError}</span><button type="button" onClick={() => void load()} className="font-medium underline">Retry</button>
      </div>
    );
  }

  return (
    <div data-testid="dashboards-tab">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {dashboards.length > 0 && !naming && (
          <select aria-label="Dashboard" value={activeId ?? ''} onChange={e => { setActiveId(e.target.value); remember(e.target.value); setConfirmDelete(false); }} className={CONTROL}>
            {dashboards.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        {naming ? (
          <form onSubmit={submitName} className="flex items-center gap-2" aria-label={naming.mode === 'new' ? 'New dashboard' : 'Rename dashboard'}>
            <input autoFocus aria-label="Dashboard name" value={naming.value} onChange={e => setNaming({ ...naming, value: e.target.value })}
              onKeyDown={e => e.key === 'Escape' && setNaming(null)} placeholder="Dashboard name" className={CONTROL} />
            <button type="submit" disabled={!naming.value.trim()} className={BTN_PRIMARY}>{naming.mode === 'new' ? 'Create' : 'Save'}</button>
            <button type="button" onClick={() => setNaming(null)} className={BTN}>Cancel</button>
          </form>
        ) : canEdit && (
          <>
            {dashboards.length > 0 && <button type="button" onClick={() => setNaming({ mode: 'new', value: '' })} className={BTN}><Plus className="h-4 w-4" /> New dashboard</button>}
            {active && <button type="button" onClick={() => setNaming({ mode: 'rename', value: active.name })} className={BTN}><Pencil className="h-4 w-4" /> Rename</button>}
            {active && !confirmDelete && <button type="button" onClick={() => setConfirmDelete(true)} className={BTN}><Trash2 className="h-4 w-4" /> Delete</button>}
            {active && confirmDelete && (
              <span role="alertdialog" aria-label="Confirm delete dashboard" className="flex items-center gap-2 text-sm">
                Delete “{active.name}” and its widgets?
                <button type="button" onClick={() => void removeDashboard()} className={BTN_DANGER}>Delete dashboard</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className={BTN}>Keep</button>
              </span>
            )}
            {active && <button type="button" onClick={() => setEditor({ widget: null })} className={`${BTN_PRIMARY} ml-auto`}><Plus className="h-4 w-4" /> Add widget</button>}
          </>
        )}
      </div>

      {!active ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-600">
          <p className="text-sm text-gray-600 dark:text-gray-300">No dashboards yet. Build one from deals, tasks, contacts or companies.</p>
          {canEdit && <button type="button" onClick={() => setNaming({ mode: 'new', value: '' })} className={`${BTN_PRIMARY} mt-4`}><Plus className="h-4 w-4" /> Create dashboard</button>}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">
          This dashboard has no widgets yet.{canEdit ? ' Use “Add widget” to create a chart or number.' : ''}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label={`${active.name} widgets`}>
          {list.map((w, i) => (
            <WidgetCard key={w.id} widget={w} data={data} canEdit={canEdit} isFirst={i === 0} isLast={i === list.length - 1}
              onEdit={() => setEditor({ widget: w })} onDelete={() => void removeWidget(w)} onMove={d => move(w, d)} onResize={c => resize(w, c)} />
          ))}
        </div>
      )}

      {editor && (
        <WidgetEditor initial={editor.widget ? { title: editor.widget.title, config: editor.widget.config } : null}
          defs={data.defs} stages={stages} onSave={(t, c) => void saveWidget(t, c)} onClose={() => setEditor(null)} />
      )}
      <DealToasts />
    </div>
  );
};

export default DashboardsTab;
