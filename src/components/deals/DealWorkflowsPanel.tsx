import React, { useState, useEffect } from 'react';
import { DealWorkflow, getAllWorkflows, assignWorkflowToDeal } from '../../services/dealWorkflowService';
import { isFeatureEnabled } from '../../services/featureFlagService';
import { EnhancedWorkflowPanel } from '../workflows/EnhancedWorkflowPanel';

/**
 * Deal Workflows Panel - Twenty Feature
 * Allows users to manage and assign automated deal workflows
 * Uses EnhancedWorkflowPanel for Phase 5 features when available
 */
export const DealWorkflowsPanel: React.FC<{
  dealId?: string;
}> = ({ dealId }) => {
  const [workflows, setWorkflows] = useState<DealWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [basicFeatureEnabled, setBasicFeatureEnabled] = useState(false);
  const [enhancedFeatureEnabled, setEnhancedFeatureEnabled] = useState(false);

  useEffect(() => {
    const init = async () => {
      const basicEnabled = await isFeatureEnabled('twenty_workflow_automation');
      const enhancedEnabled = await isFeatureEnabled('twenty_workflow_phase5');

      setBasicFeatureEnabled(basicEnabled);
      setEnhancedFeatureEnabled(enhancedEnabled);

      if (basicEnabled && !enhancedEnabled) {
        const workflowData = await getAllWorkflows();
        setWorkflows(workflowData);
      }
      setLoading(false);
    };

    init();
  }, []);

  const handleAssign = async (workflowId: string) => {
    if (!dealId) {
      alert('No deal selected. Please select a deal to assign a workflow.');
      return;
    }
    try {
      const success = await assignWorkflowToDeal(dealId, workflowId);
      if (success) {
        console.log('Workflow assigned successfully');
      } else {
        alert('Failed to assign workflow');
      }
    } catch (error) {
      console.error('Error assigning workflow:', error);
      alert('Error assigning workflow');
    }
  };

  // Use enhanced workflow panel if Phase 5 features are enabled
  if (enhancedFeatureEnabled) {
    return <EnhancedWorkflowPanel />;
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-4/5"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!basicFeatureEnabled) {
    return (
      <div className="p-4 text-center text-gray-500">
        Deal Workflows feature is not yet available.
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Deal Workflows</h3>

      {workflows.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          No workflows configured yet. Workflows will be added soon.
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {workflow.name}
                  </h4>
                  {workflow.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {workflow.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span>{workflow.stages?.length || 0} stages</span>
                    <span>{workflow.triggers?.length || 0} triggers</span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    workflow.is_active
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                  }`}>
                    {workflow.is_active ? 'Active' : 'Inactive'}
                  </span>
                 <button
                   className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                   onClick={() => handleAssign(workflow.id)}
                 >
                   Assign
                 </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">🚀 Enhanced Workflows Coming Soon</h4>
        <p className="text-sm text-blue-700">
          Phase 5 will bring advanced workflow automation with visual builders, SLA monitoring,
          AI agents, and comprehensive integrations. Stay tuned for the upgrade!
        </p>
      </div>
    </div>
  );
};