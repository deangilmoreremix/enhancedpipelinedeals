import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

let mockDemo = false;
jest.mock('../config/demoMode', () => ({ isDemoMode: () => mockDemo }));
jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/supabaseService', () => ({ getSupabaseService: () => ({}), supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/pipelineStageService', () => ({
  getStages: jest.fn(() => Promise.resolve([])),
  subscribe: jest.fn(() => () => {}),
  DEFAULT_STAGES: [],
}));
jest.mock('../services/aiClient', () => ({ authedFetch: jest.fn() }));

// Light-weight React Flow stand-in: records the props the builder passes to the canvas.
let lastFlowProps: Record<string, unknown> = {};
jest.mock('@xyflow/react/dist/style.css', () => ({}), { virtual: true });
jest.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ReactFlow: (props: Record<string, unknown>) => { lastFlowProps = props; return <div data-testid="flow" />; },
  Background: () => null, Controls: () => null, MiniMap: () => null,
  BackgroundVariant: { Dots: 'dots' }, MarkerType: { ArrowClosed: 'arrowclosed' },
  applyNodeChanges: (_c: unknown, n: unknown) => n,
  useReactFlow: () => ({ screenToFlowPosition: (p: unknown) => p, fitView: jest.fn() }),
  BaseEdge: () => null, EdgeLabelRenderer: () => null, Handle: () => null, Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  getBezierPath: () => ['', 0, 0],
}));

import { BulkActionBar } from '../components/pipeline/BulkActionBar';
import { TextCell, PriorityCell, OwnerCell, DealEditScope } from '../components/pipeline/cells/DealCells';
import { WorkflowBuilder } from '../components/workflows/WorkflowBuilder';
import { useBoardSelectionStore } from '../store/boardSelectionStore';
import { useDealStore } from '../store/dealStore';
import { usePermissionStore } from '../store/permissionStore';
import { useUserDirectoryStore } from '../store/userDirectoryStore';
import type { Deal, PipelineStage } from '../types';
import type { Workflow } from '../types/workflow';

const mk = (id: string, ownerId?: string): Deal => ({
  id, company: 'Co', contact: 'X', value: 100, stage: 'one', probability: 10, priority: 'medium',
  createdAt: new Date(), updatedAt: new Date(), position: 1, ownerId, title: `Deal ${id}`,
});
const stage = (key: string, position: number): PipelineStage => ({
  id: key, key, name: key.toUpperCase(), color: 'blue', position, visible: true, probability: 0, isWon: false, isLost: false, wipLimit: null,
});
const as = (role: 'admin' | 'member' | 'viewer', mode: 'open' | 'workspace' = 'workspace') =>
  usePermissionStore.setState({ userId: 'me', role, rlsMode: mode, loadedAt: Date.now(), isLoading: false });

beforeEach(() => {
  mockDemo = false;
  lastFlowProps = {};
  usePermissionStore.getState().reset();
  useUserDirectoryStore.setState({ users: [], loaded: true } as never);
});

describe('BulkActionBar permissions', () => {
  const setup = (ids: string[]) => {
    useDealStore.setState({
      deals: { a: mk('a', 'me'), b: mk('b', 'someone') },
      stages: [stage('one', 0), stage('two', 1)],
    });
    useBoardSelectionStore.setState({ selectedIds: ids, anchorId: ids[0], focusedId: null });
  };

  it('viewer: every mutating bulk action is disabled, with a tooltip; export stays enabled', () => {
    as('viewer'); setup(['a', 'b']);
    render(<BulkActionBar />);
    expect(screen.getByLabelText('Move to stage')).toBeDisabled();
    expect(screen.getByLabelText('Set priority')).toBeDisabled();
    expect(screen.getByLabelText('Schedule follow-up')).toBeDisabled();
    expect(screen.getByRole('button', { name: /^favorite/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
    expect(screen.getByLabelText('Move to stage').getAttribute('title')).toMatch(/viewer role/);
    expect(screen.getByRole('button', { name: /export/i })).toBeEnabled();
  });

  it('member: disabled unless ALL selected deals are own / assigned', () => {
    as('member'); setup(['a', 'b']);
    const { unmount } = render(<BulkActionBar />);
    expect(screen.getByLabelText('Move to stage')).toBeDisabled();
    expect(screen.getByLabelText('Move to stage').getAttribute('title')).toMatch(/applies to all selected/);
    unmount();
    useBoardSelectionStore.setState({ selectedIds: ['a'] });
    render(<BulkActionBar />);
    expect(screen.getByLabelText('Move to stage')).toBeEnabled();
    expect(screen.getByRole('button', { name: /delete/i })).toBeEnabled();
  });

  it('open mode / demo: nothing is disabled', () => {
    as('viewer', 'open'); setup(['a', 'b']);
    render(<BulkActionBar />);
    expect(screen.getByLabelText('Move to stage')).toBeEnabled();
    expect(screen.getByRole('button', { name: /delete/i })).toBeEnabled();
  });
});

describe('DealCells permissions', () => {
  it('viewer: inline cells render read-only (disabled, not editable)', () => {
    as('viewer');
    const deal = mk('a', 'me');
    render(
      <DealEditScope deal={deal}>
        <TextCell label="Title" value="Deal a" onCommit={jest.fn()} />
        <PriorityCell label="Priority" value="medium" onCommit={jest.fn()} />
      </DealEditScope>
    );
    expect(screen.getByRole('button', { name: 'Edit Title' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Priority: Medium/ })).toBeDisabled();
  });

  it('member: own deal is editable, someone else\'s is read-only', () => {
    as('member');
    render(
      <>
        <DealEditScope deal={mk('a', 'me')}><TextCell label="Mine" value="x" onCommit={jest.fn()} /></DealEditScope>
        <DealEditScope deal={mk('b', 'other')}><TextCell label="Theirs" value="y" onCommit={jest.fn()} /></DealEditScope>
      </>
    );
    expect(screen.getByRole('button', { name: 'Edit Mine' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Edit Theirs' })).toBeDisabled();
  });

  it('cells outside a scope stay editable', () => {
    as('viewer');
    render(<TextCell label="Free" value="x" onCommit={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Edit Free' })).toBeEnabled();
  });

  it('OwnerCell is disabled for a viewer', () => {
    as('viewer');
    render(<OwnerCell deal={mk('a', 'me')} onSave={jest.fn()} />);
    screen.getAllByRole('button').forEach(b => expect(b).toBeDisabled());
  });
});

describe('WorkflowBuilder permissions', () => {
  const wf = {
    id: 'w1', name: 'Flow', description: '', category: 'sales_automation', triggers: [], conditions: [], actions: [],
    steps: [{ id: 't', name: 'Trigger', type: 'trigger', position: { x: 0, y: 0 }, connections: [], isActive: true, trigger: { type: 'manual' } }],
    settings: { isActive: true }, metadata: {},
  } as unknown as Workflow;
  const renderBuilder = async () => { await act(async () => { render(<WorkflowBuilder workflow={wf} onWorkflowChange={jest.fn()} onSave={jest.fn()} onExecute={jest.fn()} />); }); };

  it('member: canvas is read-only and Save / Run are not offered', async () => {
    as('member');
    await renderBuilder();
    expect(lastFlowProps.nodesDraggable).toBe(false);
    expect(lastFlowProps.nodesConnectable).toBe(false);
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('admin: editable canvas with Save', async () => {
    as('admin');
    await renderBuilder();
    expect(lastFlowProps.nodesDraggable).toBe(true);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('demo mode: editable', async () => {
    mockDemo = true;
    as('viewer');
    await renderBuilder();
    expect(lastFlowProps.nodesDraggable).toBe(true);
  });
});
