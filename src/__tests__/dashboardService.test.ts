import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { chain } from '../test-utils/chain';

let mockRemote = true;
let mockResults: Record<string, { data?: any; error?: any }> = {};
let mockCalls: Array<{ table: string; c: any }> = [];
jest.mock('../lib/core/supabaseClient', () => ({
  get isSupabaseConfigured() { return mockRemote; },
  supabase: {
    from: (t: string) => { const c = chain(mockResults[t] ?? { data: [], error: null }); mockCalls.push({ table: t, c }); return c; },
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1' } } } }) },
  },
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));

import * as svc from '../services/dashboardService';
import { DEFAULT_WIDGET_CONFIG } from '../components/dashboards/widgetModel';

const ops = (table: string) => mockCalls.filter(x => x.table === table).flatMap(x => x.c.calls as Array<[string, any[]]>);
beforeEach(() => { mockRemote = true; mockResults = {}; mockCalls = []; svc.__resetLocalDashboards(); });

describe('dashboardService (remote)', () => {
  it('creates a dashboard with the current user', async () => {
    mockResults.dashboards = { data: [{ id: 'd1', name: 'Sales' }], error: null };
    const d = await svc.createDashboard('  Sales ');
    expect(d).toEqual({ id: 'd1', name: 'Sales', description: null });
    expect(ops('dashboards').find(o => o[0] === 'insert')![1][0]).toEqual({ name: 'Sales', created_by: 'user-1' });
  });
  it('stores a widget in the existing dashboard_widgets columns', async () => {
    mockResults.dashboard_widgets = { data: [{ id: 'w1', dashboard_id: 'd1', title: 'T', widget_type: 'bar', data_source: 'deals', config: { ...DEFAULT_WIDGET_CONFIG, cols: 2 }, position: { order: 3, cols: 2 } }], error: null };
    const w = await svc.createWidget('d1', 'T', { ...DEFAULT_WIDGET_CONFIG, cols: 2 }, 3);
    const body = ops('dashboard_widgets').find(o => o[0] === 'insert')![1][0];
    expect(body).toMatchObject({ dashboard_id: 'd1', title: 'T', widget_type: 'bar', data_source: 'deals', position: { order: 3, cols: 2 } });
    expect(w.order).toBe(3); expect(w.config.cols).toBe(2);
  });
  it('maps rows with missing config to defaults', () => {
    const w = svc.widgetFromRow({ id: 'w', dashboard_id: 'd', title: null, widget_type: 'pie', data_source: 'tasks', config: null, position: null });
    expect(w.config).toMatchObject({ chart: 'pie', object: 'tasks', cols: 1 }); expect(w.title).toBe('Untitled widget');
  });
  it('treats a zero-row update/delete as a permission failure', async () => {
    mockResults.dashboards = { data: [], error: null };
    await expect(svc.renameDashboard('d1', 'x')).rejects.toThrow(/row-level security|permission/i);
    await expect(svc.deleteDashboard('d1')).rejects.toThrow();
    mockResults.dashboard_widgets = { data: [], error: null };
    await expect(svc.deleteWidget('w1')).rejects.toThrow();
  });
  it('rejects empty names', async () => {
    await expect(svc.createDashboard('  ')).rejects.toThrow('required');
  });
});

describe('dashboardService (local fallback)', () => {
  beforeEach(() => { mockRemote = false; });
  it('round-trips dashboards and widgets through localStorage', async () => {
    const d = await svc.createDashboard('Local');
    const w1 = await svc.createWidget(d.id, 'A', DEFAULT_WIDGET_CONFIG, 0);
    await svc.createWidget(d.id, 'B', DEFAULT_WIDGET_CONFIG, 1);
    await svc.updateWidget({ ...w1, title: 'A2', order: 5 });
    await svc.renameDashboard(d.id, 'Renamed');
    const r = await svc.listDashboards();
    expect(r.dashboards.map(x => x.name)).toEqual(['Renamed']);
    expect(r.widgets.map(x => x.title)).toEqual(['B', 'A2']);
    expect(mockCalls).toHaveLength(0);
    await svc.deleteDashboard(d.id);
    expect(await svc.listDashboards()).toEqual({ dashboards: [], widgets: [] });
  });
});
