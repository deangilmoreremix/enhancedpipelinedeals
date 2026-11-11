import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Loader2, MinusCircle, Play, RefreshCw, RotateCcw, XCircle } from 'lucide-react';
import type { Workflow, WorkflowStep } from '../../types/workflow';
import { supabase } from '../../lib/core/supabaseClient';
import { authedFetch } from '../../services/aiClient';
import { enhancedWorkflowService } from '../../services/enhancedWorkflowService';
import { WorkflowBuilder } from './WorkflowBuilder';
import { mapRunSteps, type RawRunStep } from './workflowRunUtils';
import { formatDuration, STATUS_STYLE, StatusIcon } from './runShared';
import { entryOfStep } from './workflowGraph';
import { useWorkflowRunsRealtime } from './useWorkflowRunsRealtime';

/** A `workflow_executions` row. */
export interface ExecutionRow {
  id: string;
  workflow_id: string;
  status: string;
  trigger_type?: string | null;
  source?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  duration?: number | null;
  attempt?: number | null;
  record_id?: string | null;
  record_type?: string | null;
  event_id?: string | null;
  error_message?: string | null;
  error_step_id?: string | null;
  context?: Record<string, unknown> | null;
  steps?: RawRunStep[] | null;
  logs?: unknown[] | null;
}

const STEP_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  failed: <XCircle className="w-4 h-4 text-red-600" />,
  skipped: <MinusCircle className="w-4 h-4 text-gray-400" />,
  waiting: <Clock className="w-4 h-4 text-amber-500" />,
  running: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
};

const RecordLink: React.FC<{ id: string; type?: string | null }> = ({ id, type }) => {
  const inRouter = useInRouterContext();
  const label = `${type ?? 'record'} ${id.slice(0, 8)}`;
  if (type && type !== 'deal') return <span>{label}</span>;
  return inRouter
    ? <Link to={`/deals/${id}`} className="text-blue-600 dark:text-blue-400 hover:underline">{label}</Link>
    : <a href={`/deals/${id}`} className="text-blue-600 dark:text-blue-400 hover:underline">{label}</a>;
};

const Meta: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[11px] uppercase tracking-wide text-gray-400">{label}</dt>
    <dd className="text-sm text-gray-900 dark:text-white">{children}</dd>
  </div>
);

interface ViewProps {
  run: ExecutionRow;
  workflow: Workflow | null;
  workflowName?: string;
  onBack?: () => void;
  onRerun?: (action: 'rerun' | 'resume') => void;
  busy?: boolean;
  notice?: { ok: boolean; text: string } | null;
}

/** Presentational run detail (props in, no data fetching): header, annotated diagram, timeline, JSON. */
export const WorkflowRunDetailView: React.FC<ViewProps> = ({ run, workflow, workflowName, onBack, onRerun, busy, notice }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const steps: WorkflowStep[] = workflow?.steps ?? [];
  const statusByStep = useMemo(() => mapRunSteps(run.steps, steps, run.status), [run.steps, steps, run.status]);
  const rawSteps: RawRunStep[] = Array.isArray(run.steps) ? run.steps : [];
  const stepName = (id?: string) => steps.find(s => s.id === id)?.name ?? id ?? 'Step';
  const durationMs = run.duration ?? (run.started_at && run.completed_at ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime() : null);

  const retryable = run.status === 'failed' || run.status === 'timeout' || run.status === 'cancelled';
  const resumable = run.status === 'waiting';

  return (
    <section aria-label="Workflow run detail" className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {onBack && (
              <button type="button" onClick={onBack} aria-label="Back to run history" className="mt-0.5 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{workflowName ?? workflow?.name ?? run.workflow_id}</h3>
              <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs ${STATUS_STYLE[run.status] ?? STATUS_STYLE.unknown}`}>
                <StatusIcon status={run.status} />{run.status}
              </span>
            </div>
          </div>
          {onRerun && (
            <div className="flex items-center gap-2">
              {resumable && (
                <button type="button" disabled={busy} onClick={() => onRerun('resume')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
                  <Play className="w-4 h-4" /> Resume
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => onRerun('rerun')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {retryable ? 'Retry' : 'Re-run'}
              </button>
            </div>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Meta label="Trigger">{run.trigger_type ?? '—'}</Meta>
          <Meta label="Source">{run.source ?? 'client'}</Meta>
          <Meta label="Started">{run.started_at ? new Date(run.started_at).toLocaleString() : '—'}</Meta>
          <Meta label="Duration">{formatDuration(durationMs)}</Meta>
          <Meta label="Attempts">{run.attempt ?? 1}</Meta>
          <Meta label="Record">{run.record_id ? <RecordLink id={run.record_id} type={run.record_type} /> : '—'}</Meta>
        </dl>
        {run.error_message && (
          <p role="alert" className="mt-3 text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {run.error_step_id ? `${stepName(run.error_step_id)}: ` : ''}{run.error_message}
          </p>
        )}
        {notice && (
          <p role="status" className={`mt-3 text-sm rounded-lg px-3 py-2 ${notice.ok ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>{notice.text}</p>
        )}
      </div>

      {workflow && steps.length > 0 ? (
        <div className="h-[420px]">
          <WorkflowBuilder
            workflow={workflow}
            onWorkflowChange={() => undefined}
            onSave={() => undefined}
            onExecute={() => undefined}
            readOnly
            hideProperties
            statusByStep={statusByStep}
            selectedStepId={selected}
            onSelectStep={setSelected}
          />
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          The workflow definition is no longer available, so the diagram cannot be shown.
        </p>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <h4 className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">Step timeline</h4>
        {rawSteps.length === 0 ? (
          <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No steps were recorded for this run.</p>
        ) : (
          <ol className="divide-y divide-gray-100 dark:divide-gray-700">
            {rawSteps.map((s, i) => (
              <li key={s.id ?? i}>
                <button
                  type="button"
                  onClick={() => setSelected(s.stepId ?? null)}
                  className={`w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${selected === s.stepId ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''}`}
                >
                  <span className="mt-0.5">{STEP_ICON[s.status ?? 'completed'] ?? STEP_ICON.completed}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                      {stepName(s.stepId)}
                      <span className="text-[10px] uppercase text-gray-400">{steps.find(x => x.id === s.stepId) ? entryOfStep(steps.find(x => x.id === s.stepId) as WorkflowStep)?.label ?? '' : ''}</span>
                    </span>
                    {s.error && <span className="block text-xs text-red-600 dark:text-red-400 break-words">{s.error}</span>}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDuration(s.duration ?? null)}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <details className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <summary className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white cursor-pointer">Context</summary>
          <pre className="px-4 pb-4 text-xs text-gray-700 dark:text-gray-200 overflow-auto max-h-72">{JSON.stringify(run.context ?? {}, null, 2)}</pre>
        </details>
        <details className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <summary className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white cursor-pointer">Logs ({Array.isArray(run.logs) ? run.logs.length : 0})</summary>
          <pre className="px-4 pb-4 text-xs text-gray-700 dark:text-gray-200 overflow-auto max-h-72">{JSON.stringify(run.logs ?? [], null, 2)}</pre>
        </details>
      </div>
    </section>
  );
};

/** Loads a run (and its workflow) and wires Retry / Re-run / Resume to POST /api/workflow/run. */
export const WorkflowRunDetail: React.FC<{ runId: string; onBack?: () => void }> = ({ runId, onBack }) => {
  const [run, setRun] = useState<ExecutionRow | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, error: err } = await supabase.from('workflow_executions').select('*').eq('id', runId).maybeSingle();
      if (err) throw err;
      if (!data) { setError('Run not found'); return; }
      setRun(data as ExecutionRow);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load run');
    }
  }, [runId]);

  useEffect(() => { void load(); }, [load]);
  useWorkflowRunsRealtime(() => { void load(); }, { workflowId: run?.workflow_id });

  const workflowId = run?.workflow_id;
  useEffect(() => {
    if (!workflowId) return;
    let cancelled = false;
    void enhancedWorkflowService.getWorkflowById(workflowId).then(w => { if (!cancelled) setWorkflow(w); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [workflowId]);

  const act = async (action: 'rerun' | 'resume') => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await authedFetch('/api/workflow/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, executionId: runId })
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; status?: string; resumed?: number };
      if (!res.ok || body.ok === false) throw new Error(body.error || `Request failed (${res.status})`);
      setNotice({ ok: true, text: action === 'resume' ? `Resumed ${body.resumed ?? 0} delayed branch(es).` : `Re-run finished (${body.status ?? 'done'}). See the latest run in the history.` });
      await load();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Action failed' });
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-3">
        {onBack && <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400"><ArrowLeft className="w-4 h-4" /> Back</button>}
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }
  if (!run) return <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading run…</p>;
  return <WorkflowRunDetailView run={run} workflow={workflow} onBack={onBack} onRerun={act} busy={busy} notice={notice} />;
};

export default WorkflowRunDetail;
