import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/core/supabaseClient';
import { WorkflowRunDetail } from './WorkflowRunDetail';
import { useWorkflowRunsRealtime } from './useWorkflowRunsRealtime';
import { STATUS_STYLE, StatusIcon, formatDuration } from './runShared';

export { formatDuration };

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
  recordId: string | null;
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
    stepsFailed: r.steps_failed !== undefined ? Number(r.steps_failed) : steps.filter(s => s?.status === 'failed').length,
    recordId: r.record_id ?? r.context?.recordId ?? null
  };
}

export interface RunFilters {
  workflowId: string;
  status: string;
  source: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: RunFilters = { workflowId: '', status: '', source: '', from: '', to: '' };
const STATUSES = ['completed', 'failed', 'running', 'waiting', 'timeout', 'cancelled'];
const SOURCES = ['client', 'server'];

const selectCls = 'px-2 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white';

/** Applies the filters to a supabase query builder (shared by the view and the table fallback). */
export function applyRunFilters<Q extends { eq: (c: string, v: string) => Q; gte: (c: string, v: string) => Q; lte: (c: string, v: string) => Q }>(q: Q, f: RunFilters): Q {
  let out = q;
  if (f.workflowId) out = out.eq('workflow_id', f.workflowId);
  if (f.status) out = out.eq('status', f.status);
  if (f.source) out = out.eq('source', f.source);
  if (f.from) out = out.gte('started_at', new Date(`${f.from}T00:00:00`).toISOString());
  if (f.to) out = out.lte('started_at', new Date(`${f.to}T23:59:59.999`).toISOString());
  return out;
}

interface Props {
  /** Pin the list to one workflow (hides the workflow filter). */
  workflowId?: string;
  limit?: number;
}

export const WorkflowRunHistory: React.FC<Props> = ({ workflowId, limit = 25 }) => {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RunFilters>(EMPTY_FILTERS);
  const [workflowNames, setWorkflowNames] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const effective: RunFilters = useMemo(() => ({ ...filters, workflowId: workflowId ?? filters.workflowId }), [filters, workflowId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let { data, error: err } = await applyRunFilters(
        supabase.from('workflow_run_history').select('*').order('started_at', { ascending: false }).limit(limit) as any,
        effective
      );
      if (err) {
        // view not migrated yet: fall back to the table
        ({ data, error: err } = await applyRunFilters(
          supabase.from('workflow_executions').select('*').order('started_at', { ascending: false }).limit(limit) as any,
          effective
        ));
      }
      if (err) throw err;
      setRuns(((data ?? []) as Record<string, any>[]).map(toRun));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load run history');
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [effective, limit]);

  useEffect(() => { void load(); }, [load]);
  useWorkflowRunsRealtime(() => { void load(); }, { workflowId });

  // workflow filter options (all workflows, so the filter works even when no runs match yet)
  useEffect(() => {
    if (workflowId) return;
    let cancelled = false;
    void Promise.resolve(supabase.from('deal_workflows').select('id,name'))
      .then(({ data }: { data: Array<{ id: string; name: string | null }> | null }) => {
        if (!cancelled && data) setWorkflowNames(Object.fromEntries(data.map(w => [String(w.id), w.name ?? String(w.id)])));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [workflowId]);

  const options = useMemo(() => {
    const map = { ...workflowNames };
    for (const r of runs) if (r.workflowId && !map[r.workflowId]) map[r.workflowId] = r.workflowName;
    return Object.entries(map);
  }, [workflowNames, runs]);

  const set = (patch: Partial<RunFilters>) => setFilters(f => ({ ...f, ...patch }));
  const hasFilters = Boolean(filters.workflowId || filters.status || filters.source || filters.from || filters.to);

  if (openId) {
    return (
      <div className="mt-8">
        <WorkflowRunDetail runId={openId} onBack={() => setOpenId(null)} />
      </div>
    );
  }

  return (
    <section className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700" aria-label="Workflow run history">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Run history</h3>
        <div className="flex flex-wrap items-center gap-2">
          {!workflowId && (
            <select aria-label="Filter by workflow" value={filters.workflowId} onChange={e => set({ workflowId: e.target.value })} className={selectCls}>
              <option value="">All workflows</option>
              {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
          <select aria-label="Filter by status" value={filters.status} onChange={e => set({ status: e.target.value })} className={selectCls}>
            <option value="">Any status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select aria-label="Filter by source" value={filters.source} onChange={e => set({ source: e.target.value })} className={selectCls}>
            <option value="">Any source</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" aria-label="From date" value={filters.from} max={filters.to || undefined} onChange={e => set({ from: e.target.value })} className={selectCls} />
          <input type="date" aria-label="To date" value={filters.to} min={filters.from || undefined} onChange={e => set({ to: e.target.value })} className={selectCls} />
          {hasFilters && <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Clear</button>}
          <button type="button" onClick={() => void load()} aria-label="Refresh run history" className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      {error ? (
        <p className="p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : runs.length === 0 ? (
        <p className="p-4 text-sm text-gray-500 dark:text-gray-400">{loading ? 'Loading…' : hasFilters ? 'No runs match these filters.' : 'No workflow runs yet.'}</p>
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
                <tr
                  key={r.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open run ${r.workflowName} ${r.status}`}
                  onClick={() => setOpenId(r.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(r.id); } }}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none focus:bg-blue-50 dark:focus:bg-gray-700"
                >
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{r.workflowName}<span className="ml-2 text-[10px] uppercase text-gray-400">{r.source}</span></td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{r.triggerType}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${STATUS_STYLE[r.status] ?? STATUS_STYLE.unknown}`}>
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
