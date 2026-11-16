import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const DEAL_ID = '11111111-1111-4111-8111-111111111111';
jest.mock('../store/dealStore', () => ({ useDealStore: (sel: any) => sel({ deals: {}, stages: [] }) }));
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: {} }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));
jest.mock('../services/aiClient', () => ({ authedFetch: jest.fn(), callAI: jest.fn() }));
jest.mock('../hooks/usePermissions', () => ({ usePermissions: () => ({ allowed: () => true }) }));
jest.mock('../components/workflows/EnhancedWorkflowPanel', () => ({ EnhancedWorkflowPanel: () => <div>DESIGNER</div> }));
jest.mock('../services/dealWorkflowService', () => ({ getAllWorkflows: jest.fn().mockResolvedValue([]), assignWorkflowToDeal: jest.fn() }));
jest.mock('recharts', () => {
  const Box = ({ children }: any) => <div>{children}</div>;
  return { ResponsiveContainer: Box, BarChart: Box, Bar: () => null, LineChart: Box, Line: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null, Legend: () => null };
});

const mockSvc = {
  listDealWorkflows: jest.fn(), lastRunByWorkflow: jest.fn(), listDealRuns: jest.fn(), setWorkflowActive: jest.fn(), runWorkflowsNow: jest.fn(),
};
let available = true;
jest.mock('../services/dealWorkflowRunService', () => {
  const actual = jest.requireActual('../services/dealWorkflowRunService');
  return {
    ...actual,
    workflowsAvailable: () => available,
    listDealWorkflows: (...a: any[]) => mockSvc.listDealWorkflows(...a),
    lastRunByWorkflow: (...a: any[]) => mockSvc.lastRunByWorkflow(...a),
    listDealRuns: (...a: any[]) => mockSvc.listDealRuns(...a),
    setWorkflowActive: (...a: any[]) => mockSvc.setWorkflowActive(...a),
    runWorkflowsNow: (...a: any[]) => mockSvc.runWorkflowsNow(...a),
    subscribeDealRuns: () => () => undefined,
  };
});
const mockAnalytics = jest.fn();
jest.mock('../services/dealAnalyticsService', () => ({ loadDealAnalytics: (...a: any[]) => mockAnalytics(...a) }));

import { DealWorkflowsPanel } from '../components/deals/DealWorkflowsPanel';
import { DealAutomationPanel } from '../components/DealAutomationPanel';
import { DealAnalyticsDashboard } from '../components/DealAnalyticsDashboard';
import { RunNowError } from '../services/dealWorkflowRunService';

const wf = [{ id: 'w1', name: 'Stale deal alert', is_active: true, description: 'Pings owner', triggers: [] }, { id: 'w2', name: 'Escalate', is_active: false, triggers: [] }];

describe('DealWorkflowsPanel', () => {
  beforeEach(() => {
    available = true;
    Object.values(mockSvc).forEach(m => m.mockReset());
    mockSvc.listDealWorkflows.mockResolvedValue(wf);
    mockSvc.lastRunByWorkflow.mockResolvedValue({ w1: { id: 'r1', workflow_id: 'w1', status: 'completed', started_at: '2026-01-02T00:00:00Z' } });
    mockSvc.listDealRuns.mockResolvedValue([{ id: 'r1', workflow_id: 'w1', status: 'failed', started_at: '2026-01-02T00:00:00Z', trigger_type: 'stage_changed', duration: 120, error_message: 'Step 2 failed' }]);
  });

  it('lists workflows with last run, and this deal\'s runs with status/errors', async () => {
    render(<DealWorkflowsPanel dealId={DEAL_ID} showDesigner={false} />);
    await screen.findByRole('switch', { name: 'Disable Stale deal alert' });
    expect(screen.getByText('Escalate')).toBeInTheDocument();
    expect(screen.getByText('Never run')).toBeInTheDocument();
    expect(await screen.findByText('Step 2 failed')).toBeInTheDocument();
    expect(screen.queryByText('DESIGNER')).toBeNull();
    expect(mockSvc.listDealRuns).toHaveBeenCalledWith(DEAL_ID, 10);
  });

  it('persists the toggle', async () => {
    mockSvc.setWorkflowActive.mockResolvedValue(undefined);
    render(<DealWorkflowsPanel dealId={DEAL_ID} showDesigner={false} />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Disable Stale deal alert' }));
    await waitFor(() => expect(mockSvc.setWorkflowActive).toHaveBeenCalledWith('w1', false));
    expect(await screen.findByRole('switch', { name: 'Enable Stale deal alert' })).toBeInTheDocument();
  });

  it('shows the error and leaves the toggle unchanged on failure', async () => {
    mockSvc.setWorkflowActive.mockRejectedValue(new Error('You do not have permission to change this workflow'));
    render(<DealWorkflowsPanel dealId={DEAL_ID} showDesigner={false} />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Disable Stale deal alert' }));
    expect(await screen.findByText(/do not have permission/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Disable Stale deal alert' })).toBeChecked();
  });

  it('Run now reports the summary, and maps 403 / 429 to permission and rate-limit messages', async () => {
    mockSvc.runWorkflowsNow.mockResolvedValueOnce({ events: 2, executions: 3, skipped: 0, failed: 0, resumed: 1, errors: [] });
    render(<DealWorkflowsPanel dealId={DEAL_ID} showDesigner={false} />);
    await screen.findByRole('switch', { name: 'Disable Stale deal alert' });
    fireEvent.click(screen.getByRole('button', { name: /Run now/ }));
    expect(await screen.findByText(/Processed 2 event\(s\): 3 run\(s\) started/)).toBeInTheDocument();

    mockSvc.runWorkflowsNow.mockRejectedValueOnce(new RunNowError('forbidden', 'You do not have permission to run workflows. An admin or manager role is required.', 403));
    fireEvent.click(screen.getByRole('button', { name: /Run now/ }));
    expect(await screen.findByText(/do not have permission to run workflows/)).toBeInTheDocument();

    mockSvc.runWorkflowsNow.mockRejectedValueOnce(new RunNowError('rate_limited', 'Rate limit reached. Please wait a minute before running workflows again.', 429));
    fireEvent.click(screen.getByRole('button', { name: /Run now/ }));
    expect(await screen.findByText(/Rate limit reached/)).toBeInTheDocument();
  });

  it('empty and unavailable states', async () => {
    mockSvc.listDealWorkflows.mockResolvedValue([]);
    mockSvc.listDealRuns.mockResolvedValue([]);
    const { unmount } = render(<DealWorkflowsPanel dealId={DEAL_ID} showDesigner={false} />);
    expect(await screen.findByText(/No workflows apply to deals yet/)).toBeInTheDocument();
    expect(await screen.findByText(/No workflow runs recorded for this deal yet/)).toBeInTheDocument();
    unmount();
    available = false;
    render(<DealWorkflowsPanel dealId={DEAL_ID} showDesigner={false} />);
    expect(screen.getByText(/need a connected database/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run now/ })).toBeDisabled();
  });

  it('DealAutomationPanel is the real panel (no static rules)', async () => {
    render(<DealAutomationPanel deal={{ id: DEAL_ID } as any} />);
    await screen.findByRole('switch', { name: 'Disable Stale deal alert' });
    expect(screen.queryByText('Follow-up Email Sequence')).toBeNull();
    expect(screen.queryByText('DESIGNER')).toBeNull();
  });
});

describe('DealAnalyticsDashboard', () => {
  const base = { stageDurations: [], stageChangeCount: 0, weeks: [], activityTypes: [], totalActivities: 0, lastActivityAt: null, daysSinceLastActivity: null, probabilityTrend: [], source: 'database', errors: [], hasData: false };
  beforeEach(() => mockAnalytics.mockReset());

  it('shows an empty state when there is no data', async () => {
    mockAnalytics.mockResolvedValue(base);
    render(<DealAnalyticsDashboard deal={{ id: DEAL_ID, stage: 'lead', createdAt: new Date() } as any} />);
    expect(await screen.findByText(/nothing to analyze/)).toBeInTheDocument();
  });

  it('renders computed values only', async () => {
    mockAnalytics.mockResolvedValue({
      ...base, hasData: true, stageChangeCount: 3, daysSinceLastActivity: 4, lastActivityAt: '2026-01-01T00:00:00Z', totalActivities: 2,
      stageDurations: [{ stage: 'lead', days: 5, current: false }, { stage: 'proposal', days: 2.5, current: true }],
      weeks: [{ weekStart: '2026-01-05', label: 'Jan 5', total: 2, byType: { note: 2 } }], activityTypes: ['note'],
      probabilityTrend: [{ at: '2026-01-02T00:00:00Z', value: 35 }],
    });
    render(<DealAnalyticsDashboard deal={{ id: DEAL_ID, stage: 'proposal', createdAt: new Date() } as any} />);
    await screen.findByText('Stage changes');
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Lead: 5 days')).toBeInTheDocument();
    expect(screen.getByText('Proposal (current): 2.5 days')).toBeInTheDocument();
    expect(screen.getByText(/Latest: 35%/)).toBeInTheDocument();
  });

  it('shows per-chart empty states and load errors', async () => {
    mockAnalytics.mockResolvedValue({ ...base, hasData: true, daysSinceLastActivity: 1, lastActivityAt: '2026-01-01T00:00:00Z' });
    const { unmount } = render(<DealAnalyticsDashboard deal={{ id: DEAL_ID, stage: 'lead', createdAt: new Date() } as any} />);
    expect(await screen.findByText(/No stage history recorded yet/)).toBeInTheDocument();
    expect(screen.getByText(/No probability changes recorded/)).toBeInTheDocument();
    unmount();
    mockAnalytics.mockRejectedValue(new Error('boom'));
    render(<DealAnalyticsDashboard deal={{ id: DEAL_ID, stage: 'lead', createdAt: new Date() } as any} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });
});
