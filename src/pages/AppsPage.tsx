import React, { useState } from 'react';
import { VoiceAgentPanel } from '../components/VoiceAgentPanel';
import { VideoAgentPanel } from '../components/VideoAgentPanel';
import { AutopilotPanel } from '../components/AutopilotPanel';
import { SkillsPanel } from '../components/SkillsPanel';
import { HeatmapPanel } from '../components/HeatmapPanel';
import { PlaybooksPanel } from '../components/PlaybooksPanel';
import { PageContainer, PageHeader, Tabs } from './PageHeader';

const TABS = [
  { id: 'voice', label: 'Voice agent' },
  { id: 'video', label: 'Video agent' },
  { id: 'autopilot', label: 'Autopilot' },
  { id: 'skills', label: 'Skills' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'playbooks', label: 'Playbooks' },
];

const AppsPage: React.FC = () => {
  const [tab, setTab] = useState('voice');
  return (
    <PageContainer>
      <PageHeader title="Apps" subtitle="AI agents and tools" />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'voice' && <VoiceAgentPanel />}
      {tab === 'video' && <VideoAgentPanel />}
      {tab === 'autopilot' && <AutopilotPanel />}
      {tab === 'skills' && <SkillsPanel />}
      {tab === 'heatmap' && <HeatmapPanel />}
      {tab === 'playbooks' && <PlaybooksPanel />}
    </PageContainer>
  );
};

export default AppsPage;
