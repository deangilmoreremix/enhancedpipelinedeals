import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { supabase } from '../../services/supabaseService';

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  triggerType: string;
  status: string;
  source: string;
  startedAt: string | null;
  durationMs: number | null;
  error: string | null;
  stepsTotal: number;
  stepsFailed: number;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** Normalises a `workflow_run_history` view row or a raw `workflow_executions` row. */
export function toRun(r: Record<string, any>): WorkflowRun {
  const steps: any[] = Array.isArray(r.steps) ? r.steps : [];
  const started = r.started_at ?? null;
  const done = r.completed_at ? new Date(r.completed_at).getTime() : NaN;
  const derived = started && Number.isFinite(done) ? done - new Date(started).getTime() : null;
  return {
    id: String(r.id),
    workflowId: String(r.workflow_id ?? ''),
    workflowName: r.workflow_name ?? r.workflow_id ?? 'Workflow',
    triggerType: r.trigger_type ?? '—',
    status: r.status ?? 'unknown',
    source: r.source ?? 'client',
    startedAt: started,
    durationMs: r.duration_ms !== undefined && r.duration_ms !== null ? Number(r.duration_ms) : r.duration != null ? Number(r.duration) : derived,
    error: r.error_message ?? null,
    stepsTotal: r.steps_total !== undefined ? Number(r.steps_total) : steps.length,
    stepsFailed: r.steps_failed !== undefined ? Number(r.steps_failed) : steps.filter(s => s?.status === 'failed').length
  };
}

const STATUS_STYLE: Record<string, string> = {
  completed: 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/30',
  failed: 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/30',
  running: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30',
  waiting: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30',
  timeout: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30'
};

const StatusIcon: React.FC<{ status: string }> = ({ status }) =>
  status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
  status === 'failed' ? <XCircle className="w-3.5 h-3.5" /> :
  status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />;

export const WorkflowRunHistory: React.FC<{ workflowId?: string; limit?: number }> = ({ workflowId, limit = 25 }) => {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase.from('workflow_run_history').select('*').order('started_at', { ascending: false }).limit(limit);
      if (workflowId) q = q.eq('workflow_id', workflowId);
      let { data, error: err } = await q;
      if (err) {
        // view not migrated yet: fall back to the table
        let t = supabase.from('workflow_executions').select('*').order('started_at', { ascending: false }).limit(limit);
        if (workflowId) t = t.eq('workflow_id', workflowId);
        ({ data, error: err } = await t);
      }
      if (err) throw err;
      setRuns(((data ?? []) as Record<string, any>[]).map(toRun));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load run history');
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [workflowId, limit]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700" aria-label="Workflow run history">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Run history</h3>
        <button type="button" onClick={() => void load()} aria-label="Refresh run history" className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {error ? (
        <p className="p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : runs.length === 0 ? (
        <p className="p-4 text-sm text-gray-500 dark:text-gray-400">{loading ? 'Loading…' : 'No workflow runs yet.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                <th className="px-4 py-2 font-medium">Workflow</th>
                <th className="px-4 py-2 font-medium">Trigger</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Started</th>
                <th className="px-4 py-2 font-medium">Duration</th>
                <th className="px-4 py-2 font-medium">Steps</th>
                <th className="px-4 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {runs.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{r.workflowName}<span className="ml-2 text-[10px] uppercase text-gray-400">{r.source}</span></td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{r.triggerType}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${STATUS_STYLE[r.status] ?? 'text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-700'}`}>
                      <StatusIcon status={r.status} />{r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{formatDuration(r.durationMs)}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{r.stepsTotal - r.stepsFailed}/{r.stepsTotal}</td>
                  <td className="px-4 py-2 text-red-600 dark:text-red-400 max-w-xs truncate" title={r.error ?? undefined}>{r.error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default WorkflowRunHistory;
