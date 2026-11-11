/**
 * Hourly SLA / staleness sweep (Netlify scheduled function, v2).
 *
 *  - sla_instances: warns at 80% of the window, marks `breached` once target_at has passed
 *  - overdue open tasks: one `task_overdue` notification each
 *  - stale open deals (no update for N days; N from an active deal `stage_duration` SLA policy, default 30)
 *
 * Writes `notifications` rows and `workflow_events` (`deal.sla_breached`, `deal.stale`) that the
 * workflow-runner turns into automation runs. Every step is de-duplicated so re-running is safe.
 */
import type { DbLike } from './_workflowSteps';
import { serviceClient } from './workflow-runner';

export interface SweepSummary {
  slaWarned: number;
  slaBreached: number;
  overdueTasks: number;
  staleDeals: number;
  errors: string[];
}

const DAY_MS = 86_400_000;
const DEFAULT_STALE_DAYS = 30;
const STALE_REEMIT_DAYS = 7;

/** Days of inactivity before a deal is stale, from an active `stage_duration` deal policy (else 30). Pure. */
export function staleDaysFromPolicies(policies: Array<{ record_type?: string | null; metrics?: any }>): number {
  for (const p of policies) {
    if (p.record_type && p.record_type !== 'deal') continue;
    const m = p.metrics ?? {};
    if (m.type !== 'stage_duration' || !Number(m.target)) continue;
    const unit = m.unit ?? 'days';
    const days = unit === 'minutes' ? Number(m.target) / 1440 : unit === 'hours' ? Number(m.target) / 24 : Number(m.target);
    if (days > 0) return days;
  }
  return DEFAULT_STALE_DAYS;
}

export type SlaState = 'ok' | 'warning' | 'breached';

/** SLA state of an instance at `now`. Pure. */
export function slaState(inst: { started_at?: string | null; created_at?: string | null; target_at?: string | null }, now: Date): SlaState {
  if (!inst.target_at) return 'ok';
  const target = new Date(inst.target_at).getTime();
  if (target <= now.getTime()) return 'breached';
  const start = new Date(inst.started_at ?? inst.created_at ?? now).getTime();
  const total = target - start;
  if (total > 0 && now.getTime() - start >= total * 0.8) return 'warning';
  return 'ok';
}

async function sweepSla(db: DbLike, now: Date, s: SweepSummary): Promise<void> {
  const { data, error } = await db.from('sla_instances').select('*').in('status', ['active', 'warning']).limit(500);
  if (error) { s.errors.push(`sla: ${error.message}`); return; }
  for (const inst of (data ?? []) as any[]) {
    const state = slaState(inst, now);
    const sent: Array<{ type: string }> = Array.isArray(inst.notifications) ? inst.notifications : [];
    if (state === 'ok') continue;
    if (state === 'warning' && sent.some(n => n.type === 'warning')) continue;
    const entry = { id: `${inst.id}:${state}`, type: state === 'breached' ? 'breach' : 'warning', sentAt: now.toISOString() };
    const { error: upErr } = await db
      .from('sla_instances')
      .update({
        status: state === 'breached' ? 'breached' : 'warning',
        last_checked: now.toISOString(),
        notifications: [...sent, entry]
      })
      .eq('id', inst.id)
      .eq('status', inst.status); // optimistic: another sweep may have won
    if (upErr) { s.errors.push(`sla update ${inst.id}: ${upErr.message}`); continue; }

    await db.from('notifications').insert({
      type: state === 'breached' ? 'sla_breach' : 'sla_warning',
      title: state === 'breached' ? 'SLA breached' : 'SLA at risk',
      message: `${inst.record_type ?? 'record'} ${inst.record_id} ${state === 'breached' ? 'has breached its SLA' : 'is nearing its SLA target'}`,
      metadata: { slaInstanceId: inst.id, recordId: inst.record_id, recordType: inst.record_type }
    });
    if (state === 'breached') {
      s.slaBreached++;
      if (inst.record_type === 'deal' && inst.record_id) {
        await db.from('workflow_events').insert({
          event_type: 'deal.sla_breached', entity_type: 'deal', entity_id: inst.record_id,
          payload: { slaType: 'sla_instance', slaInstanceId: inst.id, policyId: inst.policy_id }
        });
      }
    } else s.slaWarned++;
  }
}

async function sweepOverdueTasks(db: DbLike, now: Date, s: SweepSummary): Promise<void> {
  const { data, error } = await db
    .from('tasks')
    .select('id, title, due_date, deal_id, user_id, status')
    .lt('due_date', now.toISOString())
    .not('status', 'in', '(done,completed,cancelled,closed)')
    .limit(500);
  if (error) { s.errors.push(`tasks: ${error.message}`); return; }
  const tasks = (data ?? []) as any[];
  if (!tasks.length) return;
  const { data: existing } = await db
    .from('notifications')
    .select('metadata')
    .eq('type', 'task_overdue')
    .in('metadata->>taskId', tasks.map(t => t.id));
  const already = new Set(((existing ?? []) as any[]).map(n => n.metadata?.taskId));
  for (const t of tasks) {
    if (already.has(t.id)) continue;
    const { error: insErr } = await db.from('notifications').insert({
      user_id: t.user_id ?? null,
      type: 'task_overdue',
      title: 'Task overdue',
      message: `"${t.title}" was due ${new Date(t.due_date).toLocaleDateString('en-US')}`,
      metadata: { taskId: t.id, dealId: t.deal_id }
    });
    if (insErr) s.errors.push(`task notify ${t.id}: ${insErr.message}`); else s.overdueTasks++;
  }
}

async function sweepStaleDeals(db: DbLike, now: Date, s: SweepSummary): Promise<void> {
  const { data: policies } = await db.from('sla_policies').select('record_type, metrics').eq('is_active', true);
  const staleDays = staleDaysFromPolicies((policies ?? []) as any[]);
  const cutoff = new Date(now.getTime() - staleDays * DAY_MS).toISOString();

  const { data: stages } = await db.from('pipeline_stages').select('key, is_won, is_lost');
  const closed = ((stages ?? []) as any[]).filter(st => st.is_won || st.is_lost).map(st => st.key as string);
  if (!closed.length) closed.push('closed-won', 'closed-lost');

  const { data, error } = await db
    .from('deals')
    .select('id, title, company, stage, updated_at, owner_id, created_by')
    .is('deleted_at', null)
    .lt('updated_at', cutoff)
    .not('stage', 'in', `(${closed.map(k => `"${k}"`).join(',')})`)
    .limit(500);
  if (error) { s.errors.push(`deals: ${error.message}`); return; }
  let deals = (data ?? []) as any[];
  if (!deals.length) return;

  // Prefer the last REAL activity (notes, tasks, emails, stage moves, ...) over `updated_at`, which any trivial edit bumps.
  // Uses the optional `deal_last_activity(deal_id, last_activity_at)` view; when it is absent the sweep falls back to updated_at.
  const lastActivity = new Map<string, string>();
  const { data: acts, error: actErr } = await db
    .from('deal_last_activity')
    .select('deal_id, last_activity_at')
    .in('deal_id', deals.map(d => d.id));
  if (!actErr) for (const a of (acts ?? []) as any[]) if (a.last_activity_at) lastActivity.set(a.deal_id, a.last_activity_at);
  const lastSeen = (d: any): string => {
    const act = lastActivity.get(d.id);
    return act && new Date(act).getTime() > new Date(d.updated_at).getTime() ? act : d.updated_at;
  };
  deals = deals.filter(d => lastSeen(d) < cutoff);
  if (!deals.length) return;

  const since = new Date(now.getTime() - STALE_REEMIT_DAYS * DAY_MS).toISOString();
  const { data: recent } = await db
    .from('workflow_events')
    .select('entity_id')
    .eq('event_type', 'deal.stale')
    .gte('created_at', since)
    .in('entity_id', deals.map(d => d.id));
  const recentlyFlagged = new Set(((recent ?? []) as any[]).map(r => r.entity_id));

  for (const d of deals) {
    if (recentlyFlagged.has(d.id)) continue;
    const idle = Math.floor((now.getTime() - new Date(lastSeen(d)).getTime()) / DAY_MS);
    const { error: evErr } = await db.from('workflow_events').insert({
      event_type: 'deal.stale', entity_type: 'deal', entity_id: d.id,
      payload: { slaType: 'stale', stage: d.stage, idleDays: idle, thresholdDays: staleDays }
    });
    if (evErr) { s.errors.push(`stale event ${d.id}: ${evErr.message}`); continue; }
    await db.from('notifications').insert({
      user_id: d.owner_id ?? d.created_by ?? null,
      type: 'deal_stale',
      title: 'Deal going stale',
      message: `${d.title || d.company || 'A deal'} has had no activity for ${idle} days`,
      metadata: { dealId: d.id, idleDays: idle }
    });
    s.staleDeals++;
  }
}

export async function runSlaSweep(db: DbLike, now: Date = new Date()): Promise<SweepSummary> {
  const s: SweepSummary = { slaWarned: 0, slaBreached: 0, overdueTasks: 0, staleDeals: 0, errors: [] };
  for (const step of [sweepSla, sweepOverdueTasks, sweepStaleDeals]) {
    try { await step(db, now, s); } catch (e) { s.errors.push(e instanceof Error ? e.message : String(e)); }
  }
  return s;
}

export default async (): Promise<Response> => {
  const db = serviceClient();
  const headers = { 'Content-Type': 'application/json' };
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }), { status: 500, headers });
  const summary = await runSlaSweep(db);
  return new Response(JSON.stringify({ ok: summary.errors.length === 0, ...summary }), { status: 200, headers });
};

export const config = { schedule: '0 * * * *' };
