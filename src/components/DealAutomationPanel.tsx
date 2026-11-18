import React from 'react';
import { Zap } from 'lucide-react';
import { Deal } from '../types';
import { DealWorkflowsPanel } from './deals/DealWorkflowsPanel';

interface DealAutomationPanelProps {
  deal: Deal;
}

/**
 * Automation tab: the real deal_workflows (enable/disable persisted, last run, run now) and this deal's
 * recent runs. There are no static rules and no simulated runs.
 */
export const DealAutomationPanel: React.FC<DealAutomationPanelProps> = ({ deal }) => (
  <div className="space-y-4">
    <h3 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
      <Zap className="mr-2 h-5 w-5 text-yellow-500" />Automation
    </h3>
    <DealWorkflowsPanel dealId={deal.id} showDesigner={false} />
  </div>
);

export default DealAutomationPanel;
