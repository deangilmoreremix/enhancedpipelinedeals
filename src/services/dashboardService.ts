import { supabase, isSupabaseConfigured } from '../lib/core/supabaseClient';
import { isDemoMode } from '../config/demoMode';
import { assertRowsAffected } from '../utils/rlsError';
import { getCurrentUserId, localId } from './dealRecordShared';
import { DEFAULT_WIDGET_CONFIG, DashboardRecord, WidgetCols, WidgetConfig, WidgetRecord } from '../components/dashboards/widgetModel';

/**
 * Dashboards + widgets of the Analytics > Dashboards tab.
 * Remote: `dashboards` (name, description, created_by) and `dashboard_widgets` (title, widget_type = chart,
 * data_source = object, config jsonb = WidgetConfig, position jsonb = { order, cols }).
 * Demo / unconfigured: localStorage (falls back to memory when storage is blocked).
 */

const KEY = 'pipeline.dashboards.v1';
export const dashboardsRemote = (): boolean => isSupabaseConfigured && !isDemoMode();

interface LocalState { dashboards: DashboardRecord[]; widgets: WidgetRecord[] }
let memory: LocalState = { dashboards: [], widgets: [] };

const readLocal = (): LocalState => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) {
      const p = JSON.parse(raw) as LocalState;
      if (Array.isArray(p.dashboards) && Array.isArray(p.widgets)) return (memory = p);
    }
  } catch { /* unreadable: use memory */ }
  return memory;
};
const writeLocal = (s: LocalState): void => {
  memory = s;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
};
export const __resetLocalDashboards = (): void => {
  memory = { dashboards: [], widgets: [] };
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY); } catch { /* ignore */ }
};

const asCols = (n: unknown): WidgetCols => (Number(n) === 2 ? 2 : Number(n) === 3 ? 3 : 1);

export const dashboardFromRow = (r: Record<string, any>): DashboardRecord => ({ id: r.id, name: r.name || 'Untitled dashboard', description: r.description ?? null });

export function widgetFromRow(r: Record<string, any>): WidgetRecord {
  const cfg = (r.config && typeof r.config === 'object' ? r.config : {}) as Partial<WidgetConfig>;
  const pos = (r.position && typeof r.position === 'object' ? r.position : {}) as { order?: number; cols?: number };
  return {
    id: r.id,
    dashboardId: r.dashboard_id,
    title: r.title || 'Untitled widget',
    // chart / object also live in widget_type / data_source columns; the config jsonb wins when it has them
    config: { ...DEFAULT_WIDGET_CONFIG, chart: r.widget_type, object: r.data_source, ...cfg, cols: asCols(pos.cols ?? cfg.cols) } as WidgetConfig,
    order: Number.isFinite(Number(pos.order)) ? Number(pos.order) : 0,
  };
}

const widgetColumns = (title: string, config: WidgetConfig, order: number) => ({
  title,
  widget_type: config.chart,
  data_source: config.object,
  config,
  position: { order, cols: config.cols },
});

const byOrder = (a: WidgetRecord, b: WidgetRecord) => a.order - b.order;

export async function listDashboards(): Promise<{ dashboards: DashboardRecord[]; widgets: WidgetRecord[] }> {
  if (!dashboardsRemote()) {
    const s = readLocal();
    return { dashboards: s.dashboards, widgets: [...s.widgets].sort(byOrder) };
  }
  const { data: d, error } = await supabase.from('dashboards').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  const dashboards = ((d ?? []) as Array<Record<string, any>>).map(dashboardFromRow);
  if (dashboards.length === 0) return { dashboards, widgets: [] };
  const { data: w, error: wErr } = await supabase.from('dashboard_widgets').select('*').in('dashboard_id', dashboards.map(x => x.id));
  if (wErr) throw wErr;
  return { dashboards, widgets: ((w ?? []) as Array<Record<string, any>>).map(widgetFromRow).sort(byOrder) };
}

export async function createDashboard(name: string): Promise<DashboardRecord> {
  const n = name.trim();
  if (!n) throw new Error('Dashboard name is required');
  if (!dashboardsRemote()) {
    const rec: DashboardRecord = { id: localId('dash'), name: n, description: null };
    const s = readLocal();
    writeLocal({ ...s, dashboards: [...s.dashboards, rec] });
    return rec;
  }
  const { data, error } = await supabase.from('dashboards').insert({ name: n, created_by: await getCurrentUserId() }).select().single();
  if (error) throw error;
  return dashboardFromRow(data);
}

export async function renameDashboard(id: string, name: string): Promise<void> {
  const n = name.trim();
  if (!n) throw new Error('Dashboard name is required');
  if (!dashboardsRemote()) {
    const s = readLocal();
    writeLocal({ ...s, dashboards: s.dashboards.map(d => (d.id === id ? { ...d, name: n } : d)) });
    return;
  }
  const { data, error } = await supabase.from('dashboards').update({ name: n, updated_at: new Date().toISOString() }).eq('id', id).select('id');
  if (error) throw error;
  assertRowsAffected(data);
}

export async function deleteDashboard(id: string): Promise<void> {
  if (!dashboardsRemote()) {
    const s = readLocal();
    writeLocal({ dashboards: s.dashboards.filter(d => d.id !== id), widgets: s.widgets.filter(w => w.dashboardId !== id) });
    return;
  }
  const { error: wErr } = await supabase.from('dashboard_widgets').delete().eq('dashboard_id', id);
  if (wErr) throw wErr;
  const { data, error } = await supabase.from('dashboards').delete().eq('id', id).select('id');
  if (error) throw error;
  assertRowsAffected(data);
}

export async function createWidget(dashboardId: string, title: string, config: WidgetConfig, order: number): Promise<WidgetRecord> {
  if (!dashboardsRemote()) {
    const rec: WidgetRecord = { id: localId('widget'), dashboardId, title, config, order };
    const s = readLocal();
    writeLocal({ ...s, widgets: [...s.widgets, rec] });
    return rec;
  }
  const { data, error } = await supabase.from('dashboard_widgets').insert({ dashboard_id: dashboardId, ...widgetColumns(title, config, order) }).select().single();
  if (error) throw error;
  return widgetFromRow(data);
}

export async function updateWidget(w: WidgetRecord): Promise<void> {
  if (!dashboardsRemote()) {
    const s = readLocal();
    writeLocal({ ...s, widgets: s.widgets.map(x => (x.id === w.id ? w : x)) });
    return;
  }
  const { data, error } = await supabase
    .from('dashboard_widgets')
    .update({ ...widgetColumns(w.title, w.config, w.order), updated_at: new Date().toISOString() })
    .eq('id', w.id)
    .select('id');
  if (error) throw error;
  assertRowsAffected(data);
}

/** Persist a new order for the widgets of one dashboard (position.order) in a single call per widget. */
export async function saveWidgetOrder(widgets: WidgetRecord[]): Promise<void> {
  await Promise.all(widgets.map(w => updateWidget(w)));
}

export async function deleteWidget(id: string): Promise<void> {
  if (!dashboardsRemote()) {
    const s = readLocal();
    writeLocal({ ...s, widgets: s.widgets.filter(w => w.id !== id) });
    return;
  }
  const { data, error } = await supabase.from('dashboard_widgets').delete().eq('id', id).select('id');
  if (error) throw error;
  assertRowsAffected(data);
}

export const DashboardService = { listDashboards, createDashboard, renameDashboard, deleteDashboard, createWidget, updateWidget, saveWidgetOrder, deleteWidget };
