/**
 * Per-deal analytics computed from real rows only (no random / invented numbers).
 *
 * Remote deals: sales_velocity_metrics (time in stage), deal_history (stage changes, probability trend),
 * deal_activities + notes + tasks + email (communication_records / outbound_messages) for weekly activity counts,
 * and the deal_last_activity view for "days since last activity".
 * Demo / unsaved deals: derived from the in-memory timeline (getDealTimeline) which merges the in-memory
 * activities, notes, tasks and files.
 */
import { supabase } from '../lib/core/supabaseClient';
import { canUseRemote } from './dealRecordShared';
import { getDealTimeline } from './dealTimelineService';

export interface StageDuration { stage: string; days: number; current: boolean }
export interface WeekBucket { weekStart: string; label: string; total: number; byType: Record<string, number> }
export interface ProbabilityPoint { at: string; value: number }

export interface DealAnalytics {
  stageDurations: StageDuration[];
  stageChangeCount: number;
  weeks: WeekBucket[];
  activityTypes: string[];
  totalActivities: number;
  lastActivityAt: string | null;
  daysSinceLastActivity: number | null;
  probabilityTrend: ProbabilityPoint[];
  source: 'database' | 'timeline';
  /** Sources that could not be read (the others are still shown). */
  errors: string[];
  hasData: boolean;
}

export interface RawVelocity { stage: string | null; entered_at: string | null; exited_at: string | null; days_in_stage: number | string | null }
export interface RawHistory { field: string | null; old_value: string | null; new_value: string | null; changed_at: string | null }
export interface RawActivity { type: string; at: string }

const DAY = 864e5;
export const WEEKS_SHOWN = 8;

/** Monday 00:00 (local) of the week containing d. */
export function weekStartOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x;
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function bucketWeekly(activities: RawActivity[], now: Date = new Date(), weeks = WEEKS_SHOWN): { weeks: WeekBucket[]; types: string[] } {
  const thisWeek = weekStartOf(now);
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const s = new Date(thisWeek);
    s.setDate(s.getDate() - i * 7);
    buckets.push({ weekStart: isoDay(s), label: s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), total: 0, byType: {} });
  }
  const index = new Map(buckets.map(b => [b.weekStart, b]));
  const types = new Set<string>();
  for (const a of activities) {
    const t = new Date(a.at);
    if (Number.isNaN(t.getTime())) continue;
    const b = index.get(isoDay(weekStartOf(t)));
    if (!b) continue;
    b.total++;
    b.byType[a.type] = (b.byType[a.type] ?? 0) + 1;
    types.add(a.type);
  }
  return { weeks: buckets, types: [...types].sort() };
}

/** Time in each stage: prefers velocity rows; falls back to stage changes in deal_history. */
export function computeStageDurations(
  velocity: RawVelocity[], history: RawHistory[], current: { stage?: string; createdAt?: Date | string | null }, now: Date = new Date(),
): StageDuration[] {
  const totals = new Map<string, { days: number; current: boolean }>();
  const add = (stage: string, days: number, isCurrent: boolean) => {
    if (!stage || !Number.isFinite(days) || days < 0) return;
    const prev = totals.get(stage) ?? { days: 0, current: false };
    totals.set(stage, { days: prev.days + days, current: prev.current || isCurrent });
  };
  const rows = velocity.filter(v => v.stage && v.entered_at);
  if (rows.length) {
    for (const v of rows) {
      const entered = new Date(v.entered_at as string).getTime();
      const open = !v.exited_at;
      const end = open ? now.getTime() : new Date(v.exited_at as string).getTime();
      const days = v.days_in_stage !== null && v.days_in_stage !== undefined && !open ? Number(v.days_in_stage) : (end - entered) / DAY;
      add(v.stage as string, days, open);
    }
  } else {
    const changes = history.filter(h => h.field === 'stage' && h.changed_at)
      .sort((a, b) => new Date(a.changed_at as string).getTime() - new Date(b.changed_at as string).getTime());
    if (changes.length) {
      let prevStage = changes[0].old_value ?? '';
      let since = current.createdAt ? new Date(current.createdAt).getTime() : new Date(changes[0].changed_at as string).getTime();
      for (const c of changes) {
        const at = new Date(c.changed_at as string).getTime();
        add(prevStage, (at - since) / DAY, false);
        prevStage = c.new_value ?? '';
        since = at;
      }
      add(prevStage || (current.stage ?? ''), (now.getTime() - since) / DAY, true);
    }
  }
  return [...totals.entries()].map(([stage, v]) => ({ stage, days: Math.round(v.days * 10) / 10, current: v.current }));
}

export function computeProbabilityTrend(history: RawHistory[]): ProbabilityPoint[] {
  return history
    .filter(h => (h.field === 'probability' || h.field === 'win_probability') && h.changed_at && h.new_value !== null && h.new_value !== '')
    .map(h => ({ at: h.changed_at as string, value: Number(h.new_value) }))
    .filter(p => Number.isFinite(p.value))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY));
}

/** Pure assembly (exported for tests). */
export function computeDealAnalytics(input: {
  deal: { stage?: string; createdAt?: Date | string | null };
  activities: RawActivity[];
  history: RawHistory[];
  velocity: RawVelocity[];
  lastActivityAt?: string | null;
  source: DealAnalytics['source'];
  errors?: string[];
  now?: Date;
}): DealAnalytics {
  const now = input.now ?? new Date();
  const { weeks, types } = bucketWeekly(input.activities, now);
  const stageDurations = computeStageDurations(input.velocity, input.history, input.deal, now);
  const stageChangeCount = input.history.filter(h => h.field === 'stage').length;
  let last = input.lastActivityAt ?? null;
  if (!last && input.activities.length) {
    last = input.activities.map(a => a.at).filter(a => !Number.isNaN(new Date(a).getTime())).sort().pop() ?? null;
  }
  const probabilityTrend = computeProbabilityTrend(input.history);
  const hasData = input.activities.length > 0 || stageDurations.length > 0 || stageChangeCount > 0 || probabilityTrend.length > 0 || !!last;
  return {
    stageDurations, stageChangeCount, weeks, activityTypes: types, totalActivities: input.activities.length,
    lastActivityAt: last, daysSinceLastActivity: daysSince(last, now), probabilityTrend,
    source: input.source, errors: input.errors ?? [], hasData,
  };
}

export async function loadDealAnalytics(deal: { id: string; stage?: string; createdAt?: Date | string | null }): Promise<DealAnalytics> {
  if (!canUseRemote(deal.id)) {
    const events = await getDealTimeline(deal.id, { limit: 500 });
    const activities: RawActivity[] = events.map(e => ({ type: e.kind === 'activity' ? e.type : e.kind === 'task' ? 'task' : e.kind, at: e.at.toISOString() }));
    const history: RawHistory[] = [];
    for (const e of events) {
      for (const d of e.diffs ?? []) history.push({ field: d.field, old_value: d.from, new_value: d.to, changed_at: e.at.toISOString() });
    }
    return computeDealAnalytics({ deal, activities, history, velocity: [], source: 'timeline' });
  }

  const errors: string[] = [];
  const q = async <T,>(label: string, run: () => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> => {
    try {
      const { data, error } = await run();
      if (error) { errors.push(`${label}: ${error.message ?? 'failed'}`); return []; }
      return data ?? [];
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : 'failed'}`);
      return [];
    }
  };
  const since = new Date(Date.now() - (WEEKS_SHOWN + 1) * 7 * DAY).toISOString();

  const [velocity, history, acts, notes, tasks, records, outbound, last] = await Promise.all([
    q<RawVelocity>('stage time', () => supabase.from('sales_velocity_metrics').select('stage,entered_at,exited_at,days_in_stage').eq('deal_id', deal.id).order('entered_at', { ascending: true })),
    q<RawHistory>('deal history', () => supabase.from('deal_history').select('field,old_value,new_value,changed_at').eq('deal_id', deal.id).order('changed_at', { ascending: true })),
    q<any>('activities', () => supabase.from('deal_activities').select('type,created_at').eq('deal_id', deal.id).gte('created_at', since)),
    q<any>('notes', () => supabase.from('notes').select('created_at').eq('deal_id', deal.id).is('deleted_at', null).gte('created_at', since)),
    q<any>('tasks', () => supabase.from('tasks').select('created_at').eq('deal_id', deal.id).gte('created_at', since)),
    q<any>('communications', () => supabase.from('communication_records').select('type,timestamp,created_at').eq('deal_id', deal.id).gte('created_at', since)),
    q<any>('outbound email', () => supabase.from('outbound_messages').select('created_at').eq('deal_id', deal.id).gte('created_at', since)),
    q<any>('last activity', () => supabase.from('deal_last_activity').select('last_activity_at').eq('deal_id', deal.id).limit(1)),
  ]);

  // The audit trail ("Deal updated" / "Stage changed" rows written by the DB trigger) is counted as its own types.
  const activities: RawActivity[] = [
    ...acts.map((a: any) => ({ type: String(a.type), at: a.created_at })),
    ...notes.map((n: any) => ({ type: 'note', at: n.created_at })),
    ...tasks.map((t: any) => ({ type: 'task', at: t.created_at })),
    ...records.map((r: any) => ({ type: String(r.type ?? 'communication'), at: r.timestamp ?? r.created_at })),
    ...outbound.map((o: any) => ({ type: 'email_queued', at: o.created_at })),
  ].filter(a => a.at);

  return computeDealAnalytics({
    deal, activities, history, velocity, lastActivityAt: (last[0] as any)?.last_activity_at ?? null, source: 'database', errors,
  });
}
