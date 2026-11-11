import React, { useEffect, useState } from 'react';
import { DealWorkflow, getAllWorkflows, assignWorkflowToDeal } from '../../services/dealWorkflowService';
import { EnhancedWorkflowPanel } from '../workflows/EnhancedWorkflowPanel';

/**
 * Deal workflows: assign an existing workflow to a deal, and design/run workflows on the canvas
 * (EnhancedWorkflowPanel). The canvas is no longer gated by `twenty_workflow_phase5`.
 */
export const DealWorkflowsPanel: React.FC<{
  dealId?: string;
}> = ({ dealId }) => {
  const [workflows, setWorkflows] = useState<DealWorkflow[]>([]);
  const [selected, setSelected] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAllWorkflows()
      .then(list => { if (!cancelled) setWorkflows(list); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const handleAssign = async () => {
    if (!selected) return;
    if (!dealId) {
      setNotice({ ok: false, text: 'Select a deal first to assign a workflow.' });
      return;
    }
    try {
      const ok = await assignWorkflowToDeal(dealId, selected);
      setNotice(ok ? { ok: true, text: 'Workflow assigned to the deal.' } : { ok: false, text: 'Failed to assign workflow.' });
    } catch (error) {
      console.error('Error assigning workflow:', error);
      setNotice({ ok: false, text: 'Error assigning workflow.' });
    }
  };

  return (
    <div className="space-y-4">
      {workflows.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex flex-wrap items-center gap-2">
          <label htmlFor="assign-workflow" className="text-sm font-medium text-gray-700 dark:text-gray-300">Assign workflow to deal</label>
          <select
            id="assign-workflow"
            value={selected}
            onChange={e => { setSelected(e.target.value); setNotice(null); }}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          >
            <option value="">Choose a workflow…</option>
            {workflows.map(w => <option key={w.id} value={w.id}>{w.name}{w.is_active ? '' : ' (inactive)'}</option>)}
          </select>
          <button
            type="button"
            onClick={handleAssign}
            disabled={!selected}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            Assign
          </button>
          {notice && (
            <span role="status" className={`text-sm ${notice.ok ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>{notice.text}</span>
          )}
        </div>
      )}
      <EnhancedWorkflowPanel />
    </div>
  );
};
