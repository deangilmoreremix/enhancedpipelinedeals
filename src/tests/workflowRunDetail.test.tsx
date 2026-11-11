import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Workflow, WorkflowStep } from '../types/workflow';
import { mapRunSteps } from '../components/workflows/workflowRunUtils';

jest.mock('@xyflow/react', () => ({}), { virtual: true });
jest.mock('@xyflow/react/dist/style.css', () => ({}), { virtual: true });
jest.mock('../lib/core/supabaseClient', () => ({ supabase: { from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() }, isSupabaseConfigured: false }));
jest.mock('../services/aiClient', () => ({ authedFetch: jest.fn() }));
jest.mock('../services/enhancedWorkflowService', () => ({ enhancedWorkflowService: { getWorkflowById: jest.fn() } }));
jest.mock('../components/workflows/WorkflowBuilder', () => ({
  WorkflowBuilder: (p: { workflow: Workflow; statusByStep?: Record<string, { status: string; durationMs: number | null }>; onSelectStep?: (id: string) => void }) => (
    <div data-testid="diagram">
      {p.workflow.steps.map(s => (
        <button key={s.id} data-testid={`node-${s.id}`} data-status={p.statusByStep?.[s.id]?.status} onClick={() => p.onSelectStep?.(s.id)}>{s.name}</button>
      ))}
    </div>
  )
}));

// eslint-disable-next-line import/first
import { WorkflowRunDetailView, type ExecutionRow } from '../components/workflows/WorkflowRunDetail';

const mk = (id: string, type: WorkflowStep['type'], connections: string[] = [], extra: Partial<WorkflowStep> = {}): WorkflowStep =>
  ({ id, name: id.toUpperCase(), type, position: { x: 0, y: 0 }, connections, isActive: true, ...extra });

const steps = [mk('t', 'trigger', ['c']), mk('c', 'condition', ['a', 'b']), mk('a', 'action', ['d']), mk('b', 'action'), mk('d', 'delay', [], { delay: 10 })];
const workflow = { id: 'w1', name: 'Deal won flow', steps, triggers: [] } as unknown as Workflow;

describe('mapRunSteps', () => {
  it('maps statuses by stepId and marks steps that never ran as pending', () => {
    const map = mapRunSteps([
      { stepId: 't', status: 'completed', duration: 1 },
      { stepId: 'c', status: 'completed', duration: 2, output: { matched: true } },
      { stepId: 'a', status: 'failed', duration: 30, error: 'boom' }
    ], steps, 'failed');
    expect(map.t.status).toBe('completed');
    expect(map.a).toMatchObject({ status: 'failed', error: 'boom', durationMs: 30 });
    expect(map.b.status).toBe('pending');
    expect(map.d.status).toBe('pending');
  });

  it('aggregates repeated executions (iterator): worst status wins, durations add up', () => {
    const map = mapRunSteps([
      { stepId: 'a', status: 'completed', duration: 10 },
      { stepId: 'a', status: 'failed', duration: 5, error: 'x' },
      { stepId: 'a', status: 'completed', duration: 10 }
    ], steps, 'failed');
    expect(map.a).toMatchObject({ status: 'failed', durationMs: 25, executions: 3 });
  });

  it('marks delay steps waiting on a waiting run, and the frontier running on a running run', () => {
    const waiting = mapRunSteps([{ stepId: 'd', status: 'completed', output: { delayMinutes: 10 } }], steps, 'waiting');
    expect(waiting.d.status).toBe('waiting');
    const running = mapRunSteps([{ stepId: 't', status: 'completed' }], steps, 'running');
    expect(running.c.status).toBe('running');
    expect(running.a.status).toBe('pending');
  });

  it('keeps skipped and tolerates non-array input', () => {
    expect(mapRunSteps([{ stepId: 'a', status: 'skipped' }], steps, 'completed').a.status).toBe('skipped');
    expect(mapRunSteps(null, steps).t.status).toBe('pending');
  });
});

describe('WorkflowRunDetailView', () => {
  const run: ExecutionRow = {
    id: 'r1', workflow_id: 'w1', status: 'failed', trigger_type: 'stage_changed', source: 'server', started_at: '2026-08-11T10:00:00Z',
    duration: 1500, attempt: 2, record_id: 'deal-123456789', record_type: 'deal', error_message: 'boom', error_step_id: 'a',
    context: { recordId: 'deal-123456789' },
    steps: [
      { id: 's1', stepId: 't', status: 'completed', duration: 1 },
      { id: 's2', stepId: 'c', status: 'completed', duration: 2 },
      { id: 's3', stepId: 'a', status: 'failed', duration: 30, error: 'boom' }
    ]
  };

  it('shows header, passes the overlay to the diagram and lists the timeline', () => {
    render(<WorkflowRunDetailView run={run} workflow={workflow} onRerun={jest.fn()} />);
    expect(screen.getByRole('heading', { name: 'Deal won flow' })).toBeInTheDocument();
    expect(screen.getByText('failed', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('A: boom');
    expect(screen.getByText('stage_changed')).toBeInTheDocument();
    expect(screen.getByText('1.5 s')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /deal deal-123/ })).toHaveAttribute('href', '/deals/deal-123456789');
    expect(screen.getByTestId('node-a')).toHaveAttribute('data-status', 'failed');
    expect(screen.getByTestId('node-t')).toHaveAttribute('data-status', 'completed');
    expect(screen.getByTestId('node-b')).toHaveAttribute('data-status', 'pending');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('offers Retry for failed runs and Resume for waiting runs', () => {
    const onRerun = jest.fn();
    const { rerender } = render(<WorkflowRunDetailView run={run} workflow={workflow} onRerun={onRerun} />);
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(onRerun).toHaveBeenCalledWith('rerun');
    expect(screen.queryByRole('button', { name: /Resume/ })).not.toBeInTheDocument();
    rerender(<WorkflowRunDetailView run={{ ...run, status: 'waiting', error_message: null }} workflow={workflow} onRerun={onRerun} />);
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    expect(onRerun).toHaveBeenLastCalledWith('resume');
    expect(screen.getByRole('button', { name: /Re-run/ })).toBeInTheDocument();
  });

  it('degrades gracefully when the workflow was deleted', () => {
    render(<WorkflowRunDetailView run={run} workflow={null} />);
    expect(screen.getByText(/no longer available/)).toBeInTheDocument();
    expect(screen.getByText(/Step timeline/)).toBeInTheDocument();
  });
});
