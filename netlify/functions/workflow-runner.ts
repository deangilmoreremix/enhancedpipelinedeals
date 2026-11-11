/**
 * Workflow runner (Netlify Functions v2).
 *
 * Scheduled every 5 minutes: claims unprocessed `workflow_events`, finds active `deal_workflows`
 * whose triggers match, runs their steps server-side (see ./_workflowSteps), records every run in
 * `workflow_executions`, resumes delayed branches from `scheduled_triggers`, and marks events processed.
 *
 * Idempotent: executions use the deterministic id `evt:<eventId>:<workflowId>`, events are claimed with
 * `claim_workflow_events` (skip locked, bounded attempts) and runs already done by the browser are skipped.
 * Manual runs: POST /api/workflow/run (see workflow-run-now.ts).
 */
import { createClient } from '@supabase/supabase-js';
import {
  EVENT_TO_TRIGGER, findMatchingTrigger, type MatchTrigger, type MatchWorkflow
} from '../../src/services/workflowTriggerMatch';
import { runWorkflowGraph, type DbLike, type GraphResult, type ServerStep, type StepContext, type StepDeps } from './_workflowSteps';

export interface WorkflowEventRow {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  attempts?: number;
}

export interface WorkflowRow extends MatchWorkflow {
  name?: string | null;
  stages?: ServerStep[] | null;
  settings?: { isActive?: boolean; retryPolicy?: { enabled?: boolean; maxRetries?: number } } | null;
}

export interface BatchSummary {
  events: number;
  executions: number;
  skipped: number;
  failed: number;
  resumed: number;
  errors: string[];
}

const MAX_EVENTS_PER_RUN = 25;
const TIME_BUDGET_MS = 22_000;
const CLIENT_DEDUPE_WINDOW_MS = 120_000;

// ---------------------------------------------------------------------------
// Pure matching
// ---------------------------------------------------------------------------

/** Workflows (with the trigger that matched) that should run for an event. Pure. */
export function matchWorkflows(
  event: Pick<WorkflowEventRow, 'event_type' | 'entity_type' | 'payload'>,
  workflows: WorkflowRow[],
  record?: Record<string, unknown> | null
): Array<{ workflow: WorkflowRow; trigger: MatchTrigger }> {
  const triggerType = EVENT_TO_TRIGGER[event.event_type];
  if (!triggerType) return [];
  const out: Array<{ workflow: WorkflowRow; trigger: MatchTrigger }> = [];
  for (const workflow of workflows) {
    const trigger = findMatchingTrigger(workflow, {
      triggerType,
      entityType: event.entity_type,
      payload: event.payload ?? {},
      record: record ?? undefined
    });
    if (trigger) out.push({ workflow, trigger });
  }
  return out;
}

export const executionId = (eventId: string, workflowId: string) => `evt:${eventId}:${workflowId}`;

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

async function saveExecution(
  db: DbLike,
  row: {
    id: string; workflowId: string; trigger?: MatchTrigger; triggerType: string; eventId?: string;
    recordId?: string; recordType?: string; startedAt: Date; result: GraphResult; context: StepContext; attempt: number;
  }
): Promise<void> {
  const completed = new Date();
  const status = row.result.status === 'waiting' ? 'waiting' : row.result.status;
  const { error } = await db.from('workflow_executions').upsert({
    id: row.id,
    workflow_id: row.workflowId,
    trigger_id: row.trigger?.id ?? null,
    trigger_type: row.triggerType,
    status,
    started_at: row.startedAt.toISOString(),
    completed_at: status === 'waiting' ? null : completed.toISOString(),
    duration: completed.getTime() - row.startedAt.getTime(),
    context: { recordId: row.recordId, recordType: row.recordType, inputData: row.context.inputData, source: 'server' },
    steps: row.result.steps,
    logs: [],
    error_message: row.result.error?.message ?? null,
    error_step_id: row.result.error?.stepId ?? null,
    event_id: row.eventId ?? null,
    source: 'server',
    record_id: row.recordId ?? null,
    record_type: row.recordType ?? null,
    attempt: row.attempt
  });
  if (error) throw new Error(`Failed to save execution: ${error.message}`);
}

async function scheduleResumes(db: DbLike, execId: string, workflowId: string, result: GraphResult, ctx: StepContext): Promise<void> {
  for (let i = 0; i < result.resumes.length; i++) {
    const r = result.resumes[i];
    const name = `resume:${execId}:${i}`;
    const { data: existing } = await db.from('scheduled_triggers').select('id').eq('name', name).maybeSingle();
    if (existing) continue;
    const { error } = await db.from('scheduled_triggers').insert({
      workflow_id: workflowId,
      name,
      is_active: true,
      next_run: new Date(Date.now() + r.delayMinutes * 60_000).toISOString(),
      schedule_config: {
        kind: 'delay_resume',
        stepIds: r.stepIds,
        variables: r.variables,
        context: { recordId: ctx.recordId, recordType: ctx.recordType, inputData: ctx.inputData }
      }
    });
    if (error) throw new Error(`Failed to schedule resume: ${error.message}`);
  }
}

async function ranInBrowser(db: DbLike, workflowId: string, triggerType: string, event: WorkflowEventRow): Promise<boolean> {
  if (!event.entity_id) return false;
  const since = new Date(new Date(event.created_at).getTime() - CLIENT_DEDUPE_WINDOW_MS).toISOString();
  const { data } = await db
    .from('workflow_executions')
    .select('id')
    .eq('workflow_id', workflowId)
    .eq('trigger_type', triggerType)
    .eq('context->>recordId', event.entity_id)
    .gte('started_at', since)
    .not('id', 'like', 'evt:%')
    .not('id', 'like', 'resume:%')
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

// ---------------------------------------------------------------------------
// Event processing
// ---------------------------------------------------------------------------

export async function processEvent(
  event: WorkflowEventRow,
  workflows: WorkflowRow[],
  deps: StepDeps
): Promise<{ executions: number; skipped: number; failed: number; retry: boolean }> {
  const db = deps.db;
  let record: Record<string, unknown> | null = null;
  if (event.entity_type === 'deal' && event.entity_id) {
    const { data } = await db.from('deals').select('*').eq('id', event.entity_id).maybeSingle();
    record = data ?? null;
  }

  const matches = matchWorkflows(event, workflows, record);
  const triggerType = EVENT_TO_TRIGGER[event.event_type] ?? event.event_type;
  let executions = 0, skipped = 0, failed = 0, retry = false;

  for (const { workflow, trigger } of matches) {
    const id = executionId(event.id, workflow.id);
    const { data: prior } = await db.from('workflow_executions').select('id,status,attempt').eq('id', id).maybeSingle();
    if (prior && prior.status !== 'failed') { skipped++; continue; }
    if (!prior && (await ranInBrowser(db, workflow.id, triggerType, event))) { skipped++; continue; }

    const ctx: StepContext = {
      recordId: event.entity_id ?? undefined,
      recordType: event.entity_type,
      inputData: { ...(record ?? {}), ...(event.payload ?? {}), record, eventType: event.event_type },
      variables: {},
      eventId: event.id,
      workflowId: workflow.id
    };
    const startedAt = new Date();
    const result = await runWorkflowGraph(workflow.stages ?? [], ctx, deps);
    await saveExecution(db, {
      id, workflowId: workflow.id, trigger, triggerType, eventId: event.id,
      recordId: event.entity_id ?? undefined, recordType: event.entity_type,
      startedAt, result, context: ctx, attempt: (prior?.attempt ?? 0) + 1
    });
    if (result.resumes.length) await scheduleResumes(db, id, workflow.id, result, ctx);
    executions++;
    if (result.status === 'failed') {
      failed++;
      const rp = workflow.settings?.retryPolicy;
      if (rp?.enabled && (event.attempts ?? 1) < (rp.maxRetries ?? 3)) retry = true;
    }
  }
  return { executions, skipped, failed, retry };
}

/** Resume delayed branches whose time has come. */
export async function resumeDueDelays(db: DbLike, workflows: WorkflowRow[], deps: StepDeps, limit = 25): Promise<number> {
  const { data: due } = await db
    .from('scheduled_triggers')
    .select('*')
    .eq('is_active', true)
    .lte('next_run', new Date().toISOString())
    .eq('schedule_config->>kind', 'delay_resume')
    .order('next_run')
    .limit(limit);
  let resumed = 0;
  for (const t of (due ?? []) as Array<{ id: string; workflow_id: string; schedule_config: any }>) {
    // claim: only one runner flips is_active
    const { data: claimed } = await db
      .from('scheduled_triggers')
      .update({ is_active: false, last_run: new Date().toISOString() })
      .eq('id', t.id)
      .eq('is_active', true)
      .select('id');
    if (!claimed || claimed.length === 0) continue;

    const wf = workflows.find(w => w.id === t.workflow_id);
    if (!wf) continue;
    const cfg = t.schedule_config ?? {};
    const ctx: StepContext = {
      recordId: cfg.context?.recordId,
      recordType: cfg.context?.recordType,
      inputData: cfg.context?.inputData ?? {},
      variables: cfg.variables ?? {},
      workflowId: wf.id
    };
    const id = `resume:${t.id}`;
    const startedAt = new Date();
    const result = await runWorkflowGraph(wf.stages ?? [], ctx, deps, cfg.stepIds ?? []);
    await saveExecution(deps.db, {
      id, workflowId: wf.id, triggerType: 'scheduled', recordId: ctx.recordId, recordType: ctx.recordType,
      startedAt, result, context: ctx, attempt: 1
    });
    if (result.resumes.length) await scheduleResumes(deps.db, id, wf.id, result, ctx);
    resumed++;
  }
  return resumed;
}

export async function runWorkflowBatch(deps: StepDeps, opts: { maxEvents?: number } = {}): Promise<BatchSummary> {
  const db = deps.db;
  const started = Date.now();
  const summary: BatchSummary = { events: 0, executions: 0, skipped: 0, failed: 0, resumed: 0, errors: [] };

  const { data: wfData, error: wfError } = await db.from('deal_workflows').select('*').eq('is_active', true);
  if (wfError) { summary.errors.push(`workflows: ${wfError.message}`); return summary; }
  const workflows = (wfData ?? []) as WorkflowRow[];

  const { data: claimed, error: claimError } = await (db as any).rpc('claim_workflow_events', {
    p_limit: opts.maxEvents ?? MAX_EVENTS_PER_RUN, p_max_attempts: 5
  });
  if (claimError) { summary.errors.push(`claim: ${claimError.message}`); return summary; }

  for (const event of (claimed ?? []) as WorkflowEventRow[]) {
    if (Date.now() - started > TIME_BUDGET_MS) break; // leave the rest claimed-but-stale; they are re-claimable
    summary.events++;
    try {
      const r = await processEvent(event, workflows, deps);
      summary.executions += r.executions;
      summary.skipped += r.skipped;
      summary.failed += r.failed;
      if (r.retry) {
        await db.from('workflow_events').update({ error: 'workflow failed; will retry', claimed_at: null }).eq('id', event.id);
      } else {
        await db.from('workflow_events').update({ processed: true, processed_at: new Date().toISOString(), error: null }).eq('id', event.id);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      summary.errors.push(`${event.id}: ${message}`);
      const exhausted = (event.attempts ?? 1) >= 5;
      await db.from('workflow_events').update(
        exhausted ? { processed: true, processed_at: new Date().toISOString(), error: message } : { error: message, claimed_at: null }
      ).eq('id', event.id);
    }
  }

  try {
    summary.resumed = await resumeDueDelays(db, workflows, deps);
  } catch (e) {
    summary.errors.push(`resume: ${e instanceof Error ? e.message : String(e)}`);
  }
  return summary;
}

export interface RunActionResult { ok: boolean; error?: string; executionId?: string; status?: string; resumed?: number }

/** Re-runs a recorded execution from its original context as a new execution (`rerun:<id>:<ts>`). */
export async function rerunExecution(deps: StepDeps, executionId: string): Promise<RunActionResult> {
  const db = deps.db;
  const { data: prior, error } = await db.from('workflow_executions').select('*').eq('id', executionId).maybeSingle();
  if (error || !prior) return { ok: false, error: error?.message ?? 'Run not found' };
  const { data: wf } = await db.from('deal_workflows').select('*').eq('id', prior.workflow_id).maybeSingle();
  if (!wf) return { ok: false, error: 'Workflow no longer exists' };
  const c = (prior.context ?? {}) as { recordId?: string; recordType?: string; inputData?: Record<string, unknown> };
  const recordId = prior.record_id ?? c.recordId;
  const recordType = prior.record_type ?? c.recordType;
  const ctx: StepContext = {
    recordId: recordId ?? undefined,
    recordType: recordType ?? undefined,
    inputData: (c.inputData ?? {}) as Record<string, any>,
    variables: {},
    eventId: prior.event_id ?? undefined,
    workflowId: wf.id
  };
  const startedAt = new Date();
  const result = await runWorkflowGraph((wf as WorkflowRow).stages ?? [], ctx, deps);
  const id = `rerun:${executionId}:${startedAt.getTime()}`;
  await saveExecution(db, {
    id, workflowId: wf.id, triggerType: prior.trigger_type ?? 'manual',
    recordId: recordId ?? undefined, recordType: recordType ?? undefined,
    startedAt, result, context: ctx, attempt: (prior.attempt ?? 0) + 1
  });
  if (result.resumes.length) await scheduleResumes(db, id, wf.id, result, ctx);
  return { ok: true, executionId: id, status: result.status };
}

/** Makes the delayed branches of a `waiting` execution due now and runs them. */
export async function resumeExecution(deps: StepDeps, executionId: string): Promise<RunActionResult> {
  const db = deps.db;
  const { data: pending } = await db
    .from('scheduled_triggers')
    .select('id')
    .like('name', `resume:${executionId}:%`)
    .eq('is_active', true);
  if (!pending || pending.length === 0) return { ok: false, error: 'Nothing to resume: this run has no pending delayed steps' };
  const { error } = await db
    .from('scheduled_triggers')
    .update({ next_run: new Date(Date.now() - 1000).toISOString() })
    .like('name', `resume:${executionId}:%`)
    .eq('is_active', true);
  if (error) return { ok: false, error: error.message };
  const { data: wfData } = await db.from('deal_workflows').select('*');
  const resumed = await resumeDueDelays(db, (wfData ?? []) as WorkflowRow[], deps);
  return { ok: true, resumed };
}

export function serviceClient(): DbLike | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as DbLike;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Scheduled entry point (not URL-routable in production). */
export default async (): Promise<Response> => {
  const db = serviceClient();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }), { status: 500, headers: JSON_HEADERS });
  const summary = await runWorkflowBatch({ db });
  return new Response(JSON.stringify({ ok: summary.errors.length === 0, ...summary }), { status: 200, headers: JSON_HEADERS });
};

export const config = { schedule: '*/5 * * * *' };
