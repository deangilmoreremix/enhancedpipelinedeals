import React, { useState } from 'react';
import { SDRAgentsPanel } from '../components/SDRAgentsPanel';
import { SDRAgentsHub } from '../components/sdr/SDRAgentsHub';
import { AgentControlPanel } from '../components/agents/AgentControlPanel';
import { TestSdrPlaygroundPanel } from '../components/TestSdrPlaygroundPanel';
import { SdrRunPanel } from '../components/sdr/SdrRunPanel';
import { PageContainer, PageHeader, Tabs } from './PageHeader';

const TABS = [
  { id: 'run', label: 'Live run' },
  { id: 'hub', label: 'Agents hub' },
  { id: 'panel', label: 'Run & results' },
  { id: 'controls', label: 'Controls' },
  { id: 'playground', label: 'Playground' },
];

const AgentsPage: React.FC = () => {
  const [tab, setTab] = useState('run');
  return (
    <PageContainer>
      <PageHeader title="Agents" subtitle="SDR agents for outreach, follow-up and research" />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'run' && <SdrRunPanel />}
      {tab === 'hub' && <SDRAgentsHub />}
      {tab === 'panel' && <SDRAgentsPanel />}
      {tab === 'controls' && <AgentControlPanel />}
      {tab === 'playground' && <TestSdrPlaygroundPanel />}
    </PageContainer>
  );
};

export default AgentsPage;
