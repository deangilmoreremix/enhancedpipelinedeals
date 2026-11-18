import { describe, it, expect, beforeEach, jest } from '@jest/globals';

let tables: Record<string, { data: unknown; error: unknown }> = {};
let remote = true;
const builder = (table: string): any => {
  const b: any = {};
  ['select', 'eq', 'is', 'gte', 'order', 'limit'].forEach(m => { b[m] = () => b; });
  b.then = (res: any, rej: any) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(res, rej);
  return b;
};
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { from: (t: string) => builder(t), auth: { getSession: async () => ({ data: { session: null } }) } } }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => !remote }));
const mockTimeline = jest.fn<(...a: any[]) => Promise<any[]>>();
jest.mock('../services/dealTimelineService', () => ({ getDealTimeline: (...a: any[]) => mockTimeline(...a) }));

import { computeDealAnalytics, bucketWeekly, computeStageDurations, computeProbabilityTrend, loadDealAnalytics, weekStartOf } from '../services/dealAnalyticsService';

const DEAL = '11111111-1111-4111-8111-111111111111';
const NOW = new Date(2026, 5, 17, 12, 0, 0); // Wed 17 Jun 2026 local

describe('dealAnalyticsService (pure)', () => {
  it('weeks start on Monday', () => {
    expect(weekStartOf(NOW).getDay()).toBe(1);
  });

  it('buckets activities per type per week and ignores older ones', () => {
    const { weeks, types } = bucketWeekly([
      { type: 'note', at: new Date(2026, 5, 16).toISOString() },
      { type: 'note', at: new Date(2026, 5, 15).toISOString() },
      { type: 'task', at: new Date(2026, 5, 10).toISOString() },
      { type: 'note', at: new Date(2020, 0, 1).toISOString() },
    ], NOW, 4);
    expect(weeks).toHaveLength(4);
    expect(weeks[3].byType).toEqual({ note: 2 });
    expect(weeks[2].byType).toEqual({ task: 1 });
    expect(types).toEqual(['note', 'task']);
  });

  it('sums time per stage from velocity rows, counting the open stay until now', () => {
    const d = computeStageDurations([
      { stage: 'lead', entered_at: '2026-06-01T00:00:00Z', exited_at: '2026-06-05T00:00:00Z', days_in_stage: 4 },
      { stage: 'proposal', entered_at: '2026-06-05T00:00:00Z', exited_at: null, days_in_stage: null },
    ], [], {}, new Date('2026-06-15T00:00:00Z'));
    expect(d).toEqual([{ stage: 'lead', days: 4, current: false }, { stage: 'proposal', days: 10, current: true }]);
  });

  it('falls back to deal_history stage changes when there are no velocity rows', () => {
    const d = computeStageDurations([], [
      { field: 'stage', old_value: 'lead', new_value: 'proposal', changed_at: '2026-06-03T00:00:00Z' },
    ], { createdAt: '2026-06-01T00:00:00Z' }, new Date('2026-06-13T00:00:00Z'));
    expect(d).toEqual([{ stage: 'lead', days: 2, current: false }, { stage: 'proposal', days: 10, current: true }]);
  });

  it('extracts the probability trend in time order, skipping non-numeric values', () => {
    const t = computeProbabilityTrend([
      { field: 'probability', old_value: '10', new_value: '40', changed_at: '2026-06-03T00:00:00Z' },
      { field: 'probability', old_value: null, new_value: '20', changed_at: '2026-06-01T00:00:00Z' },
      { field: 'probability', old_value: null, new_value: 'abc', changed_at: '2026-06-02T00:00:00Z' },
      { field: 'stage', old_value: 'a', new_value: 'b', changed_at: '2026-06-02T00:00:00Z' },
    ]);
    expect(t.map(p => p.value)).toEqual([20, 40]);
  });

  it('reports empty state when nothing exists and counts stage changes / days since last activity', () => {
    const empty = computeDealAnalytics({ deal: {}, activities: [], history: [], velocity: [], source: 'database', now: NOW });
    expect(empty.hasData).toBe(false);
    expect(empty.daysSinceLastActivity).toBeNull();
    const a = computeDealAnalytics({
      deal: {}, activities: [{ type: 'note', at: new Date(2026, 5, 14, 12).toISOString() }],
      history: [{ field: 'stage', old_value: 'a', new_value: 'b', changed_at: '2026-06-02T00:00:00Z' }], velocity: [], source: 'database', now: NOW,
    });
    expect(a.hasData).toBe(true);
    expect(a.stageChangeCount).toBe(1);
    expect(a.daysSinceLastActivity).toBe(3);
  });
});

describe('loadDealAnalytics', () => {
  beforeEach(() => { tables = {}; remote = true; mockTimeline.mockReset(); });

  it('uses the DB sources incl. the deal_last_activity view', async () => {
    const recent = new Date().toISOString();
    tables.sales_velocity_metrics = { data: [{ stage: 'lead', entered_at: new Date(Date.now() - 3 * 864e5).toISOString(), exited_at: null, days_in_stage: null }], error: null };
    tables.deal_history = { data: [{ field: 'stage', old_value: 'a', new_value: 'lead', changed_at: recent }, { field: 'probability', old_value: '10', new_value: '30', changed_at: recent }], error: null };
    tables.deal_activities = { data: [{ type: 'call', created_at: recent }], error: null };
    tables.notes = { data: [{ created_at: recent }], error: null };
    tables.tasks = { data: [], error: null };
    tables.communication_records = { data: [], error: null };
    tables.outbound_messages = { data: [{ created_at: recent }], error: null };
    tables.deal_last_activity = { data: [{ last_activity_at: recent }], error: null };
    const r = await loadDealAnalytics({ id: DEAL, stage: 'lead' });
    expect(r.source).toBe('database');
    expect(r.stageChangeCount).toBe(1);
    expect(r.totalActivities).toBe(3);
    expect(r.activityTypes).toEqual(['call', 'email_queued', 'note']);
    expect(r.daysSinceLastActivity).toBe(0);
    expect(r.probabilityTrend).toHaveLength(1);
    expect(r.stageDurations[0]).toMatchObject({ stage: 'lead', current: true });
  });

  it('degrades per source and reports the error', async () => {
    tables.deal_history = { data: null, error: { message: 'denied' } };
    const r = await loadDealAnalytics({ id: DEAL });
    expect(r.errors).toEqual(['deal history: denied']);
    expect(r.hasData).toBe(false);
  });

  it('derives from the in-memory timeline in demo mode', async () => {
    remote = false;
    const at = new Date();
    mockTimeline.mockResolvedValue([
      { id: '1', kind: 'note', type: 'note', title: 'n', at },
      { id: '2', kind: 'activity', type: 'stage_changed', title: 's', at, diffs: [{ field: 'stage', label: 'Stage', from: 'lead', to: 'proposal' }] },
    ]);
    const r = await loadDealAnalytics({ id: 'demo-1', stage: 'proposal', createdAt: new Date(Date.now() - 5 * 864e5) });
    expect(r.source).toBe('timeline');
    expect(r.stageChangeCount).toBe(1);
    expect(r.totalActivities).toBe(2);
    expect(r.stageDurations.map(s => s.stage)).toEqual(['lead', 'proposal']);
  });
});
