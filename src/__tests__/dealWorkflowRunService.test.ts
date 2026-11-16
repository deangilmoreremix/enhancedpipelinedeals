import { describe, it, expect, beforeEach, jest } from '@jest/globals';

type Call = [string, ...unknown[]];
let calls: Call[] = [];
let tables: Record<string, { data: unknown; error: unknown }> = {};
const builder = (table: string): any => {
  const b: any = {};
  ['select', 'update', 'eq', 'in', 'order', 'limit'].forEach(m => { b[m] = (...a: unknown[]) => { calls.push([`${table}.${m}`, ...a]); return b; }; });
  b.then = (res: any, rej: any) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(res, rej);
  return b;
};
const channelObj: any = { on: jest.fn(() => channelObj), subscribe: jest.fn(() => channelObj) };
const removeChannel = jest.fn();
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { from: (t: string) => builder(t), channel: () => channelObj, removeChannel } }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));
const mockFetch = jest.fn<(...a: any[]) => Promise<any>>();
jest.mock('../services/aiClient', () => ({ authedFetch: (...a: any[]) => mockFetch(...a) }));

import {
  appliesToDeals, listDealWorkflows, setWorkflowActive, listDealRuns, lastRunByWorkflow, runWorkflowsNow, RunNowError, subscribeDealRuns, runNowMessage,
} from '../services/dealWorkflowRunService';

const DEAL = '11111111-1111-4111-8111-111111111111';

describe('dealWorkflowRunService', () => {
  beforeEach(() => { calls = []; tables = {}; mockFetch.mockReset(); removeChannel.mockReset(); });

  it('keeps workflows without scoping or with deal triggers only', () => {
    expect(appliesToDeals({ triggers: [] })).toBe(true);
    expect(appliesToDeals({ triggers: [{ type: 'stage_changed', config: { recordType: 'deal' } }] })).toBe(true);
    expect(appliesToDeals({ triggers: [{ type: 'record_created', config: { recordType: 'contact' } }] })).toBe(false);
  });

  it('lists applicable workflows', async () => {
    tables.deal_workflows = { data: [
      { id: 'w1', name: 'A', is_active: true, triggers: [] },
      { id: 'w2', name: 'B', is_active: null, triggers: [{ config: { recordType: 'contact' } }] },
    ], error: null };
    const l = await listDealWorkflows();
    expect(l.map(w => w.id)).toEqual(['w1']);
  });

  it('persists the toggle and throws when RLS affects 0 rows', async () => {
    tables.deal_workflows = { data: [{ id: 'w1' }], error: null };
    await setWorkflowActive('w1', false);
    expect((calls.find(c => c[0] === 'deal_workflows.update')![1] as any).is_active).toBe(false);
    expect(calls.some(c => c[0] === 'deal_workflows.eq' && c[1] === 'id' && c[2] === 'w1')).toBe(true);
    tables.deal_workflows = { data: [], error: null };
    await expect(setWorkflowActive('w1', true)).rejects.toThrow(/permission/i);
  });

  it('loads this deal\'s runs and the last run per workflow', async () => {
    tables.workflow_executions = { data: [
      { id: 'r2', workflow_id: 'w1', status: 'failed', started_at: '2026-01-02' },
      { id: 'r1', workflow_id: 'w1', status: 'completed', started_at: '2026-01-01' },
    ], error: null };
    const runs = await listDealRuns(DEAL);
    expect(runs).toHaveLength(2);
    expect(calls.some(c => c[0] === 'workflow_executions.eq' && c[1] === 'record_id' && c[2] === DEAL)).toBe(true);
    const last = await lastRunByWorkflow(['w1']);
    expect(last.w1.id).toBe('r2');
  });

  it('POSTs /api/workflow/run and returns the summary', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, events: 2, executions: 3, skipped: 0, failed: 0, resumed: 1, errors: [] }) });
    const s = await runWorkflowsNow();
    expect(s).toMatchObject({ events: 2, executions: 3, resumed: 1 });
    expect(mockFetch.mock.calls[0][0]).toBe('/api/workflow/run');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
  });

  it.each([[403, 'forbidden', /permission/i], [429, 'rate_limited', /rate limit/i], [401, 'unauthorized', /sign in/i], [503, 'unavailable', /not available/i]])(
    'maps %i to %s', async (status, kind, msg) => {
      mockFetch.mockResolvedValue({ ok: false, status, json: async () => ({ error: 'x' }) });
      const err = await runWorkflowsNow().catch(e => e);
      expect(err).toBeInstanceOf(RunNowError);
      expect(err.kind).toBe(kind);
      expect(err.message).toMatch(msg);
    });

  it('reports network failure and unknown statuses', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    await expect(runWorkflowsNow()).rejects.toMatchObject({ kind: 'unavailable' });
    expect(runNowMessage(500, 'boom')).toEqual({ kind: 'error', message: 'boom' });
  });

  it('subscribes to realtime for the deal, polls, and cleans up', () => {
    jest.useFakeTimers();
    const cb = jest.fn();
    const off = subscribeDealRuns(DEAL, cb, 1000);
    expect(channelObj.on).toHaveBeenCalled();
    expect((channelObj.on.mock.calls[0] as any)[1].filter).toBe(`record_id=eq.${DEAL}`);
    jest.advanceTimersByTime(2100);
    expect(cb).toHaveBeenCalledTimes(2);
    off();
    expect(removeChannel).toHaveBeenCalled();
    jest.advanceTimersByTime(3000);
    expect(cb).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
