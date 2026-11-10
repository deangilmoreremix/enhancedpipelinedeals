import React, { useState } from 'react';
import { DealWorkflowsPanel } from '../components/deals/DealWorkflowsPanel';
import { PageContainer, PageHeader } from './PageHeader';
import { useDeals } from './hooks';

const WorkflowsPage: React.FC = () => {
  const { deals } = useDeals();
  const [dealId, setDealId] = useState('');

  return (
    <PageContainer>
      <PageHeader
        title="Workflows"
        subtitle="Automated deal progression"
        actions={
          <select
            aria-label="Assign to deal"
            value={dealId}
            onChange={e => setDealId(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-sm"
          >
            <option value="">No deal selected</option>
            {Object.values(deals).map(d => (
              <option key={d.id} value={d.id}>{d.title || d.company}</option>
            ))}
          </select>
        }
      />
      <DealWorkflowsPanel dealId={dealId || undefined} />
    </PageContainer>
  );
};

export default WorkflowsPage;
