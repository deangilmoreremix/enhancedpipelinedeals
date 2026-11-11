import { chain } from '../../test-utils/chain';
const results: Record<string, { data: any; error: any }> = {};
const log: Array<{ table: string; ch: any }> = [];
jest.mock('../../services/supabaseService', () => ({
  isSupabaseConfigured: true,
  getSupabaseService: () => ({ supabase: {} }),
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: '11111111-1111-1111-1111-111111111111' } } } }) },
    from: (t: string) => { const ch = chain(results[t] ?? { data: [], error: null }); log.push({ table: t, ch }); return ch; },
  },
}));
jest.mock('../../services/workflowExecutionEngine', () => ({ workflowExecutionEngine: {} }));

import { enhancedWorkflowService, deriveTriggers } from '../../services/enhancedWorkflowService';
import { DealWorkflowService, toWorkflowRow } from '../../services/dealWorkflowService';
import { buildReport, ViewsReportingService } from '../../services/viewsReportingService';

const trig = { id: 't1', type: 'record_created', name: 'n', description: '', config: {}, isActive: true } as any;
const step = { id: 's1', type: 'trigger', name: 'T', trigger: trig, isActive: true, position: { x: 0, y: 0 }, connections: [] } as any;
const wf: any = {
  name: 'W', category: 'custom', steps: [step], triggers: [],
  actions: [], settings: { isActive: true }, metadata: { version: 1 },
};

describe('workflow writes', () => {
  beforeEach(() => { Object.keys(results).forEach(k => delete results[k]); log.length = 0; });

  it('derives triggers from trigger steps', () => {
    expect(deriveTriggers([step], []).map(t => t.id)).toEqual(['t1']);
    expect(deriveTriggers([], [trig]).map(t => t.id)).toEqual(['t1']);
  });

  it('createWorkflow inserts derived triggers and only real columns', async () => {
    results.deal_workflows = { data: [{ id: 'w1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }], error: null };
    const out = await enhancedWorkflowService.createWorkflow(wf);
    expect(out?.id).toBe('w1');
    const insert = log[0].ch.calls.find((c: any) => c[0] === 'insert')[1][0];
    expect(insert.triggers).toHaveLength(1);
    expect(Object.keys(insert).sort()).toEqual(['category', 'created_by', 'description', 'is_active', 'metadata', 'name', 'settings', 'stages', 'triggers', 'user_id', 'version']);
  });

  it('createWorkflow surfaces a permission message on RLS denial', async () => {
    results.deal_workflows = { data: null, error: { code: '42501', message: 'rls' } };
    expect(await enhancedWorkflowService.createWorkflow(wf)).toBeNull();
    expect(enhancedWorkflowService.getLastError()).toMatch(/permission/);
  });

  it('deleteWorkflow / updateWorkflow fail visibly when 0 rows are affected', async () => {
    results.deal_workflows = { data: [], error: null };
    expect(await enhancedWorkflowService.deleteWorkflow('w')).toBe(false);
    expect(enhancedWorkflowService.getLastError()).toMatch(/permission/);
    expect(await enhancedWorkflowService.updateWorkflow('w', { name: 'x' })).toBe(false);
    expect(await DealWorkflowService.deleteWorkflow('w')).toBe(false);
    expect(DealWorkflowService.getLastError()).toMatch(/permission/);
  });

  it('dealWorkflowService whitelists columns', () => {
    expect(Object.keys(toWorkflowRow({ name: 'a', bogus: 1, id: 'x', created_at: 'y', triggers: [] }))).toEqual(['name', 'triggers']);
  });
});

describe('views/reporting client-side replacements', () => {
  beforeEach(() => { Object.keys(results).forEach(k => delete results[k]); log.length = 0; });

  it('buildReport groups and aggregates', () => {
    const r = buildReport({
      id: 'r', name: 'n', type: 'summary', visualization: { type: 'table', config: {} }, isActive: true,
      createdBy: '', createdAt: new Date(), updatedAt: new Date(),
      dataSource: { entity: 'deals', filters: [], groupBy: ['stage'], aggregations: [{ field: 'value', function: 'sum', alias: 'total' }] },
    } as any, [{ stage: 'a', value: 1 }, { stage: 'a', value: 2 }, { stage: 'b', value: 5 }]);
    expect(r.totalRecords).toBe(3);
    expect(r.groups.find(g => g.key.stage === 'a')?.values.total).toBe(3);
  });

  it('never calls the missing RPCs', async () => {
    const rpc = jest.fn();
    (jest.requireMock('../../services/supabaseService').supabase as any).rpc = rpc;
    results.deals = { data: [{ id: 'd', stage: 'a', value: 5, deleted_at: null }], error: null };
    results.custom_metrics = { data: [{ id: 'm', formula: 'total_value', category: 'custom' }], error: null };
    expect(await ViewsReportingService.calculateMetricValue('m')).toBe(5);
    expect(await ViewsReportingService.executeAdvancedQuery('deals', [], [], 10)).toHaveLength(1);
    expect(await ViewsReportingService.generateReport({
      id: 'r', name: 'n', type: 'summary', visualization: { type: 'table', config: {} }, isActive: true, createdBy: '', createdAt: new Date(), updatedAt: new Date(),
      dataSource: { entity: 'deals', filters: [] },
    } as any)).toMatchObject({ totalRecords: 1 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('updateWidgetPosition patches dashboards.widgets and verifies the write', async () => {
    results.dashboards = { data: [{ id: 'd', widgets: [{ id: 'w', position: { x: 0, y: 0, width: 1, height: 1 } }] }], error: null };
    expect(await ViewsReportingService.updateWidgetPosition('d', 'w', { x: 1, y: 2, width: 3, height: 4 })).toBe(true);
    const upd = log.find(l => l.table === 'dashboards' && l.ch.calls.some((c: any) => c[0] === 'update'));
    expect(upd!.ch.calls.find((c: any) => c[0] === 'update')[1][0].widgets[0].position.x).toBe(1);
  });
});
