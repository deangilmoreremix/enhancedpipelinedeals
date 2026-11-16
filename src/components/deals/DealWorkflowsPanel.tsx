import React, { useCallback, useEffect, useState } from 'react';
import { Play, Loader2, RefreshCw } from 'lucide-react';
import { DealWorkflow, getAllWorkflows, assignWorkflowToDeal } from '../../services/dealWorkflowService';
import {
  DealWorkflowRow, WorkflowRun, listDealWorkflows, listDealRuns, lastRunByWorkflow, setWorkflowActive,
  runWorkflowsNow, RunNowError, subscribeDealRuns, workflowsAvailable,
} from '../../services/dealWorkflowRunService';
import { usePermissions } from '../../hooks/usePermissions';
import { useDealStore } from '../../store/dealStore';
import { EnhancedWorkflowPanel } from '../workflows/EnhancedWorkflowPanel';

const statusClass = (s: string | null) => {
  switch ((s ?? '').toLowerCase()) {
    case 'completed': case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'failed': case 'error': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    case 'running': case 'pending': case 'waiting': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
};

const when = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
};

export const RunStatus: React.FC<{ status: string | null }> = ({ status }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(status)}`}>{status ?? 'unknown'}</span>
);

/**
 * Deal workflows (mountable in the deal view): workflows that apply to deals with an enable/disable toggle
 * (persisted on deal_workflows.is_active), a "Run now" button (POST /api/workflow/run) and this deal's recent runs
 * (workflow_executions, realtime + poll). Set `showDesigner={false}` to hide the canvas editor.
 */
export const DealWorkflowsPanel: React.FC<{
  dealId?: string;
  /** Show the workflow canvas (EnhancedWorkflowPanel). Default true (workflows page); pass false in the deal view. */
  showDesigner?: boolean;
}> = ({ dealId, showDesigner = true }) => {
  const { allowed } = usePermissions();
  const dealRecord = useDealStore(st => (dealId ? st.deals[dealId] : undefined));
  const canAssignToDeal = allowed('edit', 'deal', dealRecord);
  const available = workflowsAvailable();

  const [workflows, setWorkflows] = useState<DealWorkflowRow[]>([]);
  const [assignable, setAssignable] = useState<DealWorkflow[]>([]);
  const [lastRuns, setLastRuns] = useState<Record<string, WorkflowRun>>({});
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(available);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [selected, setSelected] = useState('');

  const loadRuns = useCallback(async () => {
    if (!dealId) return;
    try {
      setRuns(await listDealRuns(dealId, 10));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load runs');
    }
  }, [dealId]);

  const loadAll = useCallback(async () => {
    if (!available) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const list = await listDealWorkflows();
      setWorkflows(list);
      setLastRuns(await lastRunByWorkflow(list.map(w => w.id)).catch(() => ({})));
      await loadRuns();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load workflows');
    } finally {
      setLoading(false);
    }
  }, [available, loadRuns]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  useEffect(() => {
    void getAllWorkflows().then(setAssignable).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!dealId) return undefined;
    return subscribeDealRuns(dealId, () => { void loadRuns(); });
  }, [dealId, loadRuns]);

  const toggle = async (w: DealWorkflowRow) => {
    setToggling(w.id);
    setNotice(null);
    const next = !w.is_active;
    try {
      await setWorkflowActive(w.id, next);
      setWorkflows(prev => prev.map(x => (x.id === w.id ? { ...x, is_active: next } : x)));
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Could not update the workflow' });
    } finally {
      setToggling(null);
    }
  };

  const runNow = async () => {
    setRunning(true);
    setNotice(null);
    try {
      const s = await runWorkflowsNow();
      setNotice({
        ok: s.errors.length === 0 && s.failed === 0,
        text: `Processed ${s.events} event(s): ${s.executions} run(s) started, ${s.failed} failed, ${s.resumed} resumed.${s.errors.length ? ` Errors: ${s.errors.join('; ')}` : ''}`,
      });
      await loadAll();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof RunNowError ? e.message : 'Run failed' });
    } finally {
      setRunning(false);
    }
  };

  const handleAssign = async () => {
    if (!selected) return;
    if (!dealId) { setNotice({ ok: false, text: 'Select a deal first to assign a workflow.' }); return; }
    try {
      const ok = await assignWorkflowToDeal(dealId, selected);
      setNotice(ok ? { ok: true, text: 'Workflow assigned to the deal.' } : { ok: false, text: 'Failed to assign workflow.' });
    } catch {
      setNotice({ ok: false, text: 'Error assigning workflow.' });
    }
  };

  const nameOf = (id: string | null) => workflows.find(w => w.id === id)?.name ?? (id ? `Workflow ${id.slice(0, 8)}` : 'Workflow');

  return (
    <div className="space-y-4">
      <section aria-label="Workflows" className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">Workflows</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              "Run now" processes queued workflow events and due delayed steps immediately (all workflows, not only this deal). Requires an admin or manager role.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void loadAll()} aria-label="Refresh workflows" className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => void runNow()} disabled={running || !available} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Run now
            </button>
          </div>
        </div>

        {notice && (
          <p role="status" className={`mb-3 text-sm ${notice.ok ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>{notice.text}</p>
        )}
        {loadError && <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{loadError}</p>}

        {!available ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Workflows need a connected database. They are not available in demo mode.</p>
        ) : loading ? (
          <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Loading workflows...</p>
        ) : workflows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No workflows apply to deals yet. Create one on the workflows page.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {workflows.map(w => {
              const last = lastRuns[w.id];
              return (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900 dark:text-white">{w.name}</p>
                    {w.description && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{w.description}</p>}
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {last ? <>Last run <RunStatus status={last.status} /> {when(last.started_at)}</> : 'Never run'}
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label={`${w.is_active ? 'Disable' : 'Enable'} ${w.name}`}
                      checked={w.is_active}
                      disabled={toggling === w.id}
                      onChange={() => void toggle(w)}
                    />
                    {w.is_active ? 'Enabled' : 'Disabled'}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dealId && available && (
        <section aria-label="Recent runs" className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h4 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">Recent runs for this deal</h4>
          {runs.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No workflow runs recorded for this deal yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {runs.map(r => (
                <li key={r.id} className="py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{nameOf(r.workflow_id)}</span>
                    <RunStatus status={r.status} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {when(r.started_at)}{r.trigger_type ? ` · ${r.trigger_type}` : ''}{r.duration !== null && r.duration !== undefined ? ` · ${Math.round(Number(r.duration))} ms` : ''}
                  </p>
                  {r.error_message && <p className="text-xs text-red-600 dark:text-red-400">{r.error_message}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {assignable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <label htmlFor="assign-workflow" className="text-sm font-medium text-gray-700 dark:text-gray-300">Assign workflow to deal</label>
          <select
            id="assign-workflow"
            value={selected}
            onChange={e => { setSelected(e.target.value); setNotice(null); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="">Choose a workflow...</option>
            {assignable.map(w => <option key={w.id} value={w.id}>{w.name}{w.is_active ? '' : ' (inactive)'}</option>)}
          </select>
          <button type="button" onClick={handleAssign} disabled={!selected || !canAssignToDeal} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">Assign</button>
        </div>
      )}

      {showDesigner && <EnhancedWorkflowPanel />}
    </div>
  );
};

export default DealWorkflowsPanel;
