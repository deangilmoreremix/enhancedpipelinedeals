/**
 * Deal-view workflow helpers over the real tables:
 *  - deal_workflows (list applicable workflows, persist the enable/disable toggle)
 *  - workflow_executions (this deal's recent runs + last run per workflow, realtime with a poll fallback)
 *  - POST /api/workflow/run {action:'manual', workflowId, dealId} (netlify/functions/workflow-run-now.ts): runs ONE
 *    active workflow against ONE deal now. Needs an admin / manager role.
 */
import { supabase, isSupabaseConfigured } from '../lib/core/supabaseClient';
import { isDemoMode } from '../config/demoMode';
import { authedFetch } from './aiClient';
import { isUuid, errorMessage } from './dealRecordShared';

export const RUN_NOW_URL = '/api/workflow/run';

export interface DealWorkflowRow {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  category?: string | null;
  triggers?: any[] | null;
  updated_at?: string | null;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string | null;
  status: string | null;
  trigger_type: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration: number | null;
  error_message: string | null;
  source: string | null;
}

/** Remote workflow data is only available with a configured, non-demo database. */
export const workflowsAvailable = (): boolean => isSupabaseConfigured && !isDemoMode();

/** A workflow applies to deals when it has no trigger scoping, or a trigger for deal records. */
export function appliesToDeals(w: Pick<DealWorkflowRow, 'triggers'>): boolean {
  const triggers = Array.isArray(w.triggers) ? w.triggers : [];
  if (triggers.length === 0) return true;
  return triggers.some(t => {
    const rt = t?.config?.recordType;
    return !rt || rt === 'deal';
  });
}

export async function listDealWorkflows(): Promise<DealWorkflowRow[]> {
  if (!workflowsAvailable()) return [];
  const { data, error } = await supabase
    .from('deal_workflows')
    .select('id,name,description,is_active,category,triggers,updated_at')
    .order('name');
  if (error) throw new Error(error.message || 'Could not load workflows');
  return ((data ?? []) as DealWorkflowRow[]).filter(appliesToDeals).map(w => ({ ...w, is_active: !!w.is_active }));
}

/** Persist the enabled flag. Throws when RLS rejects the write (0 rows affected). */
export async function setWorkflowActive(id: string, active: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('deal_workflows')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message || 'Could not update the workflow');
  if (!Array.isArray(data) || data.length === 0) throw new Error('You do not have permission to change this workflow');
}

const RUN_COLUMNS = 'id,workflow_id,status,trigger_type,started_at,completed_at,duration,error_message,source';

/** Most recent runs recorded against this deal. */
export async function listDealRuns(dealId: string, limit = 10): Promise<WorkflowRun[]> {
  if (!workflowsAvailable() || !isUuid(dealId)) return [];
  const { data, error } = await supabase
    .from('workflow_executions')
    .select(RUN_COLUMNS)
    .eq('record_id', dealId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message || 'Could not load runs');
  return (data ?? []) as WorkflowRun[];
}

/** Last recorded run per workflow id (any record). */
export async function lastRunByWorkflow(workflowIds: string[]): Promise<Record<string, WorkflowRun>> {
  if (!workflowsAvailable() || workflowIds.length === 0) return {};
  const { data, error } = await supabase
    .from('workflow_executions')
    .select(RUN_COLUMNS)
    .in('workflow_id', workflowIds)
    .order('started_at', { ascending: false })
    .limit(Math.max(50, workflowIds.length * 5));
  if (error) throw new Error(error.message || 'Could not load last runs');
  const out: Record<string, WorkflowRun> = {};
  for (const r of (data ?? []) as WorkflowRun[]) if (r.workflow_id && !out[r.workflow_id]) out[r.workflow_id] = r;
  return out;
}

export type RunNowErrorKind = 'unauthorized' | 'forbidden' | 'rate_limited' | 'unavailable' | 'error';

export class RunNowError extends Error {
  constructor(public kind: RunNowErrorKind, message: string, public status?: number) {
    super(message);
    this.name = 'RunNowError';
  }
}

export interface RunNowResult { executionId?: string; status?: string }

/** Maps an HTTP status from the run-now endpoint to a user-facing message. */
export function runNowMessage(status: number, serverError?: string): { kind: RunNowErrorKind; message: string } {
  if (status === 401) return { kind: 'unauthorized', message: 'Please sign in again to run workflows.' };
  if (status === 403) return { kind: 'forbidden', message: 'You do not have permission to run workflows. An admin or manager role is required.' };
  if (status === 429) return { kind: 'rate_limited', message: 'Rate limit reached. Please wait a minute before running workflows again.' };
  if (status === 503 || status === 404) return { kind: 'unavailable', message: 'The workflow runner is not available right now.' };
  return { kind: 'error', message: serverError || `Run failed (${status})` };
}

/** POST /api/workflow/run (manual): runs one workflow on one deal. Resolves with the execution; rejects with RunNowError. */
export async function runWorkflowNow(workflowId: string, dealId: string): Promise<RunNowResult> {
  let res: Response;
  try {
    res = await authedFetch(RUN_NOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'manual', workflowId, dealId }),
    });
  } catch (e) {
    throw new RunNowError('unavailable', `Could not reach the workflow runner: ${errorMessage(e)}`);
  }
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = runNowMessage(res.status, body?.error);
    throw new RunNowError(m.kind, m.message, res.status);
  }
  return { executionId: body.executionId, status: body.status };
}

/**
 * Calls `onChange` whenever a run for this deal changes: Supabase realtime on workflow_executions
 * (filtered by record_id) plus a slow poll as a fallback. Returns an unsubscribe function.
 */
export function subscribeDealRuns(dealId: string, onChange: () => void, pollMs = 15000): () => void {
  if (!workflowsAvailable() || !isUuid(dealId)) return () => undefined;
  let channel: any = null;
  try {
    channel = (supabase as any)
      .channel(`deal-runs-${dealId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_executions', filter: `record_id=eq.${dealId}` }, () => onChange())
      .subscribe();
  } catch {
    channel = null;
  }
  const timer = setInterval(onChange, pollMs);
  return () => {
    clearInterval(timer);
    try { if (channel) void (supabase as any).removeChannel(channel); } catch { /* ignore */ }
  };
}
