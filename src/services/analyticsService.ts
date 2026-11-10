/**
 * Pipeline analytics: pure functions over Deal[] + PipelineStage[] (+ deal_history rows),
 * plus thin data loaders (deal_history fetch, pipeline_aggregates RPC).
 *
 * Everything that computes is pure and unit tested; the loaders degrade gracefully when
 * Supabase is unavailable (the UI then relies on the client-side computation).
 */
import type { Deal, PipelineStage } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HistoryRow {
  deal_id: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export interface StageSummary {
  key: string;
  name: string;
  color: string;
  value: number;
  count: number;
  avgDealSize: number;
  weighted: number;
  isWon: boolean;
  isLost: boolean;
}

export interface WinRateResult {
  won: number;
  lost: number;
  /** 0..1; 0 when nothing closed. */
  rate: number;
  wonValue: number;
  lostValue: number;
}

export interface FunnelStep {
  key: string;
  name: string;
  color: string;
  reached: number;
  /** Share of the previous step that reached this one (0..1); 1 for the first step. */
  conversionFromPrev: number;
  /** Share of the first step that reached this one (0..1). */
  conversionFromFirst: number;
  source: 'history' | 'stage-order';
}

export interface ForecastMonth {
  /** `YYYY-MM` or `unscheduled`. */
  month: string;
  label: string;
  total: number;
  weighted: number;
  count: number;
}

export interface TimeInStageRow {
  key: string;
  name: string;
  color: string;
  avgDays: number;
  samples: number;
  source: 'history' | 'estimated';
}

export interface AtRiskDeal {
  deal: Deal;
  score: number;
  reasons: string[];
  daysSinceUpdate: number;
}

export type GroupBy = 'stage' | 'owner' | 'priority' | 'company' | 'month';
export type AggregateOp = 'count' | 'sum' | 'avg';

export interface GroupedAggregate {
  key: string;
  label: string;
  value: number;
  count: number;
}

export type DateRangeKey = '7d' | '30d' | '90d' | '365d' | 'all';

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toTime = (d: Date | string | number | undefined | null): number => {
  if (d === undefined || d === null) return NaN;
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return t;
};

const stageMap = (stages: PipelineStage[]) => new Map(stages.map(s => [s.key, s]));
const sortedStages = (stages: PipelineStage[]) => [...stages].sort((a, b) => a.position - b.position);

export function isOpenDeal(deal: Deal, stages: PipelineStage[]): boolean {
  const s = stageMap(stages).get(deal.stage);
  if (s) return !s.isWon && !s.isLost;
  return !/^closed/.test(deal.stage);
}

function isWonDeal(deal: Deal, map: Map<string, PipelineStage>): boolean {
  const s = map.get(deal.stage);
  return s ? s.isWon : deal.stage === 'closed-won';
}

function isLostDeal(deal: Deal, map: Map<string, PipelineStage>): boolean {
  const s = map.get(deal.stage);
  return s ? s.isLost : deal.stage === 'closed-lost';
}

/** Probability (0..1) used to weight a deal. Stage probability wins; falls back to the deal's own. */
export function dealProbability(deal: Deal, stage: PipelineStage | undefined, prefer: 'stage' | 'deal' = 'stage'): number {
  const fromStage = stage && Number.isFinite(stage.probability) ? stage.probability : undefined;
  const fromDeal = Number.isFinite(deal.probability) ? deal.probability : undefined;
  const pct = prefer === 'deal' ? (fromDeal ?? fromStage ?? 0) : (fromStage ?? fromDeal ?? 0);
  return Math.min(100, Math.max(0, pct)) / 100;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// ---------------------------------------------------------------------------
// Date range
// ---------------------------------------------------------------------------

export function rangeStart(range: DateRangeKey, now: Date = new Date()): Date | null {
  const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365, all: 0 }[range];
  return days ? new Date(now.getTime() - days * DAY_MS) : null;
}

/** Keep deals created within the range (all deals for `all`). */
export function filterDealsByRange(deals: Deal[], range: DateRangeKey, now: Date = new Date()): Deal[] {
  const start = rangeStart(range, now);
  if (!start) return deals;
  return deals.filter(d => toTime(d.createdAt) >= start.getTime());
}

// ---------------------------------------------------------------------------
// Per-stage summaries
// ---------------------------------------------------------------------------

export function stageSummaries(deals: Deal[], stages: PipelineStage[]): StageSummary[] {
  return sortedStages(stages).map(s => {
    const inStage = deals.filter(d => d.stage === s.key);
    const value = inStage.reduce((sum, d) => sum + num(d.value), 0);
    const weighted = inStage.reduce((sum, d) => sum + num(d.value) * dealProbability(d, s), 0);
    return {
      key: s.key,
      name: s.name,
      color: s.color,
      value,
      count: inStage.length,
      avgDealSize: inStage.length ? value / inStage.length : 0,
      weighted,
      isWon: s.isWon,
      isLost: s.isLost
    };
  });
}

export const valueByStage = (deals: Deal[], stages: PipelineStage[]) =>
  stageSummaries(deals, stages).map(s => ({ key: s.key, name: s.name, color: s.color, value: s.value }));

export const countByStage = (deals: Deal[], stages: PipelineStage[]) =>
  stageSummaries(deals, stages).map(s => ({ key: s.key, name: s.name, color: s.color, count: s.count }));

export const avgDealSizeByStage = (deals: Deal[], stages: PipelineStage[]) =>
  stageSummaries(deals, stages).map(s => ({ key: s.key, name: s.name, color: s.color, avg: s.avgDealSize }));

// ---------------------------------------------------------------------------
// Win rate
// ---------------------------------------------------------------------------

export function winRate(deals: Deal[], stages: PipelineStage[]): WinRateResult {
  const map = stageMap(stages);
  let won = 0, lost = 0, wonValue = 0, lostValue = 0;
  for (const d of deals) {
    if (isWonDeal(d, map)) { won++; wonValue += num(d.value); }
    else if (isLostDeal(d, map)) { lost++; lostValue += num(d.value); }
  }
  const closed = won + lost;
  return { won, lost, rate: closed ? won / closed : 0, wonValue, lostValue };
}

// ---------------------------------------------------------------------------
// History helpers
// ---------------------------------------------------------------------------

interface StageChange { at: number; from: string | null; to: string | null }

function stageChangesByDeal(history: HistoryRow[]): Map<string, StageChange[]> {
  const out = new Map<string, StageChange[]>();
  for (const h of history) {
    if (h.field !== 'stage') continue;
    const at = toTime(h.changed_at);
    if (!Number.isFinite(at)) continue;
    const list = out.get(h.deal_id) ?? [];
    list.push({ at, from: h.old_value, to: h.new_value });
    out.set(h.deal_id, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.at - b.at);
  return out;
}

// ---------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------

/**
 * Stage conversion funnel over the non-lost stages, in order.
 * With history: a deal "reached" a stage if it ever sat in it (initial stage, any stage change target,
 * current stage) or in any later stage. Without history: reached = current stage order >= stage order.
 */
export function conversionFunnel(deals: Deal[], stages: PipelineStage[], history: HistoryRow[] = []): FunnelStep[] {
  const ordered = sortedStages(stages);
  const funnelStages = ordered.filter(s => !s.isLost);
  const orderOf = new Map(ordered.map((s, i) => [s.key, i]));
  const changes = stageChangesByDeal(history);
  const hasHistory = changes.size > 0;
  const lostKeys = new Set(ordered.filter(s => s.isLost).map(s => s.key));

  // highest stage index each deal has reached
  const maxReached = new Map<string, number>();
  for (const d of deals) {
    let max = -1;
    const cur = orderOf.get(d.stage);
    if (cur !== undefined && !lostKeys.has(d.stage)) max = cur;
    const list = changes.get(d.id);
    if (list) {
      for (const c of list) {
        for (const k of [c.from, c.to]) {
          if (k && !lostKeys.has(k)) {
            const i = orderOf.get(k);
            if (i !== undefined && i > max) max = i;
          }
        }
      }
    }
    // Lost deals with no history carry no information about how far they got.
    if (max >= 0) maxReached.set(d.id, max);
  }

  const counts = funnelStages.map(s => {
    const idx = orderOf.get(s.key) ?? 0;
    let n = 0;
    for (const m of maxReached.values()) if (m >= idx) n++;
    return n;
  });

  return funnelStages.map((s, i) => ({
    key: s.key,
    name: s.name,
    color: s.color,
    reached: counts[i],
    conversionFromPrev: i === 0 ? 1 : counts[i - 1] ? counts[i] / counts[i - 1] : 0,
    conversionFromFirst: counts[0] ? counts[i] / counts[0] : 0,
    source: hasHistory ? 'history' : 'stage-order'
  }));
}

// ---------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------

export function weightedForecast(
  deals: Deal[],
  stages: PipelineStage[],
  prefer: 'stage' | 'deal' = 'stage'
): { total: number; weighted: number; count: number } {
  const map = stageMap(stages);
  let total = 0, weighted = 0, count = 0;
  for (const d of deals) {
    if (!isOpenDeal(d, stages)) continue;
    const v = num(d.value);
    total += v;
    weighted += v * dealProbability(d, map.get(d.stage), prefer);
    count++;
  }
  return { total, weighted, count };
}

const monthKey = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (key: string) => {
  if (key === 'unscheduled') return 'No close date';
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
};

const dealCloseTime = (d: Deal) => {
  const t = toTime(d.closeDate ?? d.dueDate);
  return Number.isFinite(t) ? t : NaN;
};

/** Open-deal pipeline bucketed by expected close month (close date, else due date). */
export function forecastByMonth(
  deals: Deal[],
  stages: PipelineStage[],
  prefer: 'stage' | 'deal' = 'stage'
): ForecastMonth[] {
  const map = stageMap(stages);
  const buckets = new Map<string, ForecastMonth>();
  for (const d of deals) {
    if (!isOpenDeal(d, stages)) continue;
    const t = dealCloseTime(d);
    const key = Number.isFinite(t) ? monthKey(t) : 'unscheduled';
    const b = buckets.get(key) ?? { month: key, label: monthLabel(key), total: 0, weighted: 0, count: 0 };
    b.total += num(d.value);
    b.weighted += num(d.value) * dealProbability(d, map.get(d.stage), prefer);
    b.count++;
    buckets.set(key, b);
  }
  return [...buckets.values()].sort((a, b) => {
    if (a.month === 'unscheduled') return 1;
    if (b.month === 'unscheduled') return -1;
    return a.month.localeCompare(b.month);
  });
}

// ---------------------------------------------------------------------------
// Time in stage / cycle time
// ---------------------------------------------------------------------------

/**
 * Average days deals spend in each stage. Uses deal_history stage changes; for deals without
 * history the current stage dwell is estimated from `updatedAt` (flagged `estimated`).
 */
export function timeInStage(
  deals: Deal[],
  stages: PipelineStage[],
  history: HistoryRow[] = [],
  now: Date = new Date()
): TimeInStageRow[] {
  const changes = stageChangesByDeal(history);
  const totals = new Map<string, { days: number; n: number; fromHistory: boolean }>();
  const add = (key: string, days: number, fromHistory: boolean) => {
    if (!Number.isFinite(days) || days < 0) return;
    const t = totals.get(key) ?? { days: 0, n: 0, fromHistory: false };
    t.days += days; t.n++; t.fromHistory = t.fromHistory || fromHistory;
    totals.set(key, t);
  };

  const nowT = now.getTime();
  for (const d of deals) {
    const list = changes.get(d.id);
    if (list && list.length) {
      let cursor = toTime(d.createdAt);
      let current = list[0].from ?? d.stage;
      if (!Number.isFinite(cursor)) cursor = list[0].at;
      for (const c of list) {
        add(current, (c.at - cursor) / DAY_MS, true);
        cursor = c.at;
        current = c.to ?? current;
      }
      // still sitting in the final stage (only meaningful for open deals)
      if (isOpenDeal(d, stages)) add(current, (nowT - cursor) / DAY_MS, true);
    } else if (isOpenDeal(d, stages)) {
      const since = toTime(d.updatedAt ?? d.createdAt);
      if (Number.isFinite(since)) add(d.stage, (nowT - since) / DAY_MS, false);
    }
  }

  return sortedStages(stages).map(s => {
    const t = totals.get(s.key);
    return {
      key: s.key,
      name: s.name,
      color: s.color,
      avgDays: t && t.n ? Math.round((t.days / t.n) * 10) / 10 : 0,
      samples: t?.n ?? 0,
      source: t?.fromHistory ? 'history' : 'estimated'
    };
  });
}

/** Average days from creation to first entering a won stage (history) or last update (fallback). */
export function cycleTime(
  deals: Deal[],
  stages: PipelineStage[],
  history: HistoryRow[] = []
): { avgDays: number; samples: number } {
  const map = stageMap(stages);
  const changes = stageChangesByDeal(history);
  const wonKeys = new Set(stages.filter(s => s.isWon).map(s => s.key));
  if (!wonKeys.size) wonKeys.add('closed-won');
  let sum = 0, n = 0;
  for (const d of deals) {
    if (!isWonDeal(d, map)) continue;
    const created = toTime(d.createdAt);
    const wonChange = changes.get(d.id)?.find(c => c.to && wonKeys.has(c.to));
    const end = wonChange ? wonChange.at : toTime(d.updatedAt);
    const days = (end - created) / DAY_MS;
    if (Number.isFinite(days) && days >= 0) { sum += days; n++; }
  }
  return { avgDays: n ? Math.round((sum / n) * 10) / 10 : 0, samples: n };
}

/** Sales velocity: (open deals × avg deal size × win rate) / cycle days = value per day. */
export function pipelineVelocity(deals: Deal[], stages: PipelineStage[], history: HistoryRow[] = []): number {
  const open = deals.filter(d => isOpenDeal(d, stages));
  if (!open.length) return 0;
  const avg = open.reduce((s, d) => s + num(d.value), 0) / open.length;
  const wr = winRate(deals, stages).rate;
  const { avgDays } = cycleTime(deals, stages, history);
  if (!avgDays || !wr) return 0;
  return (open.length * avg * wr) / avgDays;
}

// ---------------------------------------------------------------------------
// At-risk / stale
// ---------------------------------------------------------------------------

export function atRiskDeals(
  deals: Deal[],
  stages: PipelineStage[],
  opts: { staleDays?: number; limit?: number; now?: Date } = {}
): AtRiskDeal[] {
  const { staleDays = 30, limit = 8, now = new Date() } = opts;
  const map = stageMap(stages);
  const out: AtRiskDeal[] = [];
  for (const d of deals) {
    if (!isOpenDeal(d, stages)) continue;
    const reasons: string[] = [];
    let score = 0;
    const updated = toTime(d.updatedAt ?? d.createdAt);
    const idle = Number.isFinite(updated) ? Math.floor((now.getTime() - updated) / DAY_MS) : 0;
    if (idle >= staleDays) { score += Math.min(60, 30 + (idle - staleDays)); reasons.push(`No activity for ${idle} days`); }
    else if (idle >= staleDays / 2) { score += 10; reasons.push(`Quiet for ${idle} days`); }
    const close = dealCloseTime(d);
    if (Number.isFinite(close) && close < now.getTime()) {
      const late = Math.ceil((now.getTime() - close) / DAY_MS);
      score += Math.min(40, 20 + late); reasons.push(`Past close date by ${late} days`);
    }
    if (dealProbability(d, map.get(d.stage)) < 0.2 && num(d.value) > 0) { score += 5; reasons.push('Low win probability'); }
    if (score > 0) score += Math.min(10, Math.log10(Math.max(1, num(d.value))));
    if (reasons.length) out.push({ deal: d, score: Math.round(score), reasons, daysSinceUpdate: idle });
  }
  return out.sort((a, b) => b.score - a.score || num(b.deal.value) - num(a.deal.value)).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Generic group-by / aggregate (chart widget behaviour)
// ---------------------------------------------------------------------------

export function groupAggregate(
  deals: Deal[],
  stages: PipelineStage[],
  groupBy: GroupBy,
  op: AggregateOp
): GroupedAggregate[] {
  const smap = stageMap(stages);
  const keyOf = (d: Deal): { key: string; label: string } => {
    switch (groupBy) {
      case 'stage': return { key: d.stage, label: smap.get(d.stage)?.name ?? d.stage };
      case 'owner': { const o = d.assignedTo || d.ownerId || ''; return { key: o || 'unassigned', label: o || 'Unassigned' }; }
      case 'priority': return { key: d.priority, label: d.priority ? d.priority[0].toUpperCase() + d.priority.slice(1) : 'None' };
      case 'company': return { key: d.company || 'unknown', label: d.company || 'Unknown' };
      case 'month': {
        const t = toTime(d.createdAt);
        const k = Number.isFinite(t) ? monthKey(t) : 'unscheduled';
        return { key: k, label: monthLabel(k) };
      }
    }
  };
  const groups = new Map<string, GroupedAggregate & { sum: number }>();
  for (const d of deals) {
    const { key, label } = keyOf(d);
    const g = groups.get(key) ?? { key, label, value: 0, count: 0, sum: 0 };
    g.count++; g.sum += num(d.value);
    groups.set(key, g);
  }
  const rows = [...groups.values()].map(g => ({
    key: g.key,
    label: g.label,
    count: g.count,
    value: op === 'count' ? g.count : op === 'sum' ? g.sum : g.count ? g.sum / g.count : 0
  }));
  if (groupBy === 'stage') {
    const order = new Map(sortedStages(stages).map((s, i) => [s.key, i]));
    return rows.sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
  }
  if (groupBy === 'month') return rows.sort((a, b) => a.key.localeCompare(b.key));
  return rows.sort((a, b) => b.value - a.value);
}

// ---------------------------------------------------------------------------
// Data loaders (Supabase; optional)
// ---------------------------------------------------------------------------

export interface AggregateRow { stage: string; deal_count: number; agg: number }

/** Server-side aggregate per stage via `pipeline_aggregates`; null when unavailable. */
export async function fetchPipelineAggregates(
  op: 'count' | 'sum' | 'avg' | 'min' | 'max' = 'sum',
  field: 'value' | 'probability' = 'value',
  stageKeys?: string[]
): Promise<AggregateRow[] | null> {
  try {
    const { supabase } = await import('./supabaseService');
    const { data, error } = await supabase.rpc('pipeline_aggregates', {
      p_stage_keys: stageKeys ?? null,
      p_op: op,
      p_field: field
    });
    if (error || !Array.isArray(data)) return null;
    return (data as Array<{ stage: string; deal_count: number | string; agg: number | string }>).map(r => ({
      stage: r.stage,
      deal_count: Number(r.deal_count),
      agg: Number(r.agg)
    }));
  } catch {
    return null;
  }
}

/** Stage-change history rows (deal_history); [] when unavailable. */
export async function fetchDealHistory(since?: Date, limit = 5000): Promise<HistoryRow[]> {
  try {
    const { supabase } = await import('./supabaseService');
    let q = supabase
      .from('deal_history')
      .select('deal_id, field, old_value, new_value, changed_at')
      .eq('field', 'stage')
      .order('changed_at', { ascending: true })
      .limit(limit);
    if (since) q = q.gte('changed_at', since.toISOString());
    const { data, error } = await q;
    if (error || !Array.isArray(data)) return [];
    return data as HistoryRow[];
  } catch {
    return [];
  }
}
