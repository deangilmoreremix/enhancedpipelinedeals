import { mockDb } from '../test-utils/mockSupabase';

let demo = false;
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: require('../test-utils/mockSupabase').mockDb.client }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));

import { getPipelineAnalyticsService } from '../services/pipelineAnalyticsService';
import { getAEAgentService } from '../services/aeAgentService';

const ops = (table: string, name: string) => mockDb.calls.filter((c) => c.table === table).flatMap((c) => c.ops).filter((o) => o[0] === name);
const fresh = () => { const s: any = getPipelineAnalyticsService(); s.cache.clear(); return s; };

describe('pipelineAnalyticsService (supabase)', () => {
  const fetchSpy = jest.fn();
  beforeEach(() => { mockDb.reset(); demo = false; fetchSpy.mockReset(); (global as any).fetch = fetchSpy; jest.spyOn(console, 'warn').mockImplementation(() => {}); jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { expect(fetchSpy).not.toHaveBeenCalled(); jest.restoreAllMocks(); });

  it('getPipelineMetrics reads non-deleted deals from the deals table', async () => {
    mockDb.on('deals', { data: [
      { id: 'd1', stage: 'qualification', value: 100, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' },
      { id: 'd2', stage: 'qualification', value: 300, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' },
    ], error: null });
    const m = await fresh().getPipelineMetrics();
    expect(m).toMatchObject({ totalDeals: 2, totalValue: 400, averageDealSize: 200 });
    expect(ops('deals', 'is')[0].slice(1)).toEqual(['deleted_at', null]);
  });

  it('applies the date range on created_at', async () => {
    mockDb.on('deals', { data: [], error: null });
    await fresh().getPipelineMetrics({ start: '2026-01-01', end: '2026-02-01' });
    expect(ops('deals', 'gte')[0].slice(1)).toEqual(['created_at', '2026-01-01']);
    expect(ops('deals', 'lte')[0].slice(1)).toEqual(['created_at', '2026-02-01']);
  });

  it('a failing query degrades to an empty data set (same as before)', async () => {
    mockDb.on('deals', { data: null, error: { message: 'rls' } });
    expect((await fresh().getPipelineMetrics()).totalDeals).toBe(0);
  });

  it('getAgentPerformance derives per-agent stats from agent_metrics + sdr_agent_executions (+ labels from agent_metadata)', async () => {
    mockDb.on('agent_metrics', { data: [{ agent_id: 'sdr-cold-email', total_runs: 10, successful_runs: 8, failed_runs: 2 }, { agent_id: 'x', total_runs: 0, successful_runs: 0, failed_runs: 0 }], error: null });
    mockDb.on('agent_metadata', { data: [{ id: 'sdr-cold-email', label: 'Cold Email SDR' }], error: null });
    mockDb.on('sdr_agent_executions', { data: [
      { agent_id: 'sdr-cold-email', context_id: 'c1', executed_at: new Date(Date.now() - 2 * 86_400_000).toISOString() },
      { agent_id: 'sdr-cold-email', context_id: 'c1', executed_at: new Date().toISOString() },
      { agent_id: 'sdr-cold-email', context_id: 'c2', executed_at: new Date().toISOString() },
    ], error: null });
    const perf = await fresh().getAgentPerformance();
    const a = perf.find((p: any) => p.agentId === 'sdr-cold-email');
    expect(a).toMatchObject({ agentName: 'Cold Email SDR', dealsManaged: 2, winRate: 80, revenueGenerated: 0 });
    expect(a.efficiency).toBeGreaterThan(0);
    expect(a.activityScore).toBeGreaterThan(50);
    expect(perf.find((p: any) => p.agentId === 'x')).toMatchObject({ agentName: 'x', winRate: 0, dealsManaged: 0 });
  });

  it('demo mode: no Supabase, no network (empty states)', async () => {
    demo = true;
    expect((await fresh().getAgentPerformance())).toEqual([]);
    expect((await fresh().getPipelineMetrics()).totalDeals).toBe(0);
    expect(mockDb.calls).toHaveLength(0);
  });
});

describe('aeAgentService.analyzeDeal (supabase)', () => {
  const fetchSpy = jest.fn();
  beforeEach(() => { mockDb.reset(); demo = false; fetchSpy.mockReset(); (global as any).fetch = fetchSpy; jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { expect(fetchSpy).not.toHaveBeenCalled(); jest.restoreAllMocks(); });

  it('loads the deal and its contact from Supabase', async () => {
    mockDb.on('deals', { data: { id: 'd1', title: 'Big', value: 5000, stage: 'proposal', probability: 40, contact_id: 'c1', company: 'Acme', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' }, error: null });
    mockDb.on('contacts', { data: { id: 'c1', name: 'Ada', title: 'CTO', company: 'Acme' }, error: null });
    const ctx = await (getAEAgentService() as any).analyzeDeal('d1');
    expect(ctx).toMatchObject({ id: 'd1', title: 'Big', value: 5000, stage: 'proposal', contact: { id: 'c1', name: 'Ada', title: 'CTO', company: 'Acme' } });
    expect(ops('deals', 'eq')[0].slice(1)).toEqual(['id', 'd1']);
    expect(ops('contacts', 'eq')[0].slice(1)).toEqual(['id', 'c1']);
  });

  it('missing deal -> "Deal not found"; query error is surfaced', async () => {
    mockDb.on('deals', { data: null, error: null });
    await expect((getAEAgentService() as any).analyzeDeal('nope')).rejects.toThrow('Deal not found');
    mockDb.on('deals', { data: null, error: { message: 'rls denied' } });
    await expect((getAEAgentService() as any).analyzeDeal('d1')).rejects.toThrow('rls denied');
  });

  it('demo mode uses the bundled mock deals without any query', async () => {
    demo = true;
    const ctx = await (getAEAgentService() as any).analyzeDeal('deal-1');
    expect(ctx.id).toBe('deal-1');
    await expect((getAEAgentService() as any).analyzeDeal('zzz')).rejects.toThrow('Deal not found');
    expect(mockDb.calls).toHaveLength(0);
  });
});
