import React from 'react';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';

let mockOnDragEnd: ((r: unknown) => void) | undefined;
jest.mock('@hello-pangea/dnd', () => {
  const R = require('react');
  return {
    DragDropContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: (r: unknown) => void }) => { mockOnDragEnd = onDragEnd; return R.createElement('div', null, children); },
    Droppable: ({ children }: { children: (p: unknown) => React.ReactNode }) => children({ innerRef: () => undefined, droppableProps: {}, placeholder: null }),
    Draggable: ({ children }: { children: (p: unknown, s: unknown) => React.ReactNode }) => children({ innerRef: () => undefined, draggableProps: {}, dragHandleProps: {} }, { isDragging: false }),
  };
});
jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/supabaseService', () => ({ getSupabaseService: () => ({}), supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/pipelineStageService', () => ({
  getStages: jest.fn(() => Promise.resolve([])),
  subscribe: jest.fn(() => () => {}),
  DEFAULT_STAGES: [],
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

import { CustomColumnManager, StageManagerModal, reorderKeys } from '../components/pipeline/kanban/CustomColumnManager';
import { StageMenu } from '../components/pipeline/StageMenu';
import { useDealStore } from '../store/dealStore';
import type { Deal, PipelineStage } from '../types';

const st = (key: string, name: string, position: number, extra: Partial<PipelineStage> = {}): PipelineStage => ({
  id: key, key, name, color: 'blue', position, visible: true, probability: 0, isWon: false, isLost: false, wipLimit: null, ...extra,
});
const deal = (id: string, stage: string): Deal => ({
  id, company: 'Co', contact: 'X', value: 1, stage, probability: 0, priority: 'medium', createdAt: new Date(), updatedAt: new Date(), position: 1,
});
const stage = (key: string) => useDealStore.getState().stages.find(s => s.key === key) as PipelineStage;

beforeEach(() => {
  mockOnDragEnd = undefined;
  useDealStore.setState({
    stages: [
      st('lead', 'Lead', 0, { probability: 10, wipLimit: 5 }),
      st('demo', 'Demo', 1, { probability: 45, color: 'orange' }),
      st('signed', 'Signed', 2, { probability: 100, isWon: true, color: 'green' }),
      st('dead', 'Dead', 3, { probability: 0, isLost: true, color: 'red' }),
    ],
    deals: { d1: deal('d1', 'demo'), d2: deal('d2', 'demo'), d3: deal('d3', 'lead') },
    isConnectedToDatabase: false,
  });
});

describe('stage manager (CustomColumnManager)', () => {
  it('renders every stage with its probability, WIP limit and won/lost flags', () => {
    render(<CustomColumnManager onClose={jest.fn()} />);
    expect(screen.getByLabelText('Probability of Demo')).toHaveValue('45');
    expect(screen.getByLabelText('WIP limit of Lead')).toHaveValue('5');
    expect(screen.getByLabelText('Signed is a won stage')).toBeChecked();
    expect(screen.getByLabelText('Dead is a lost stage')).toBeChecked();
    expect(screen.getByLabelText('Demo is a won stage')).not.toBeChecked();
  });

  it('works without any feature flag (no "not yet available" gate)', () => {
    render(<StageManagerModal isOpen onClose={jest.fn()} />);
    expect(screen.queryByText(/not yet available/i)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Manage pipeline stages' })).toBeInTheDocument();
  });

  it('editing the probability changes only the probability (flags and others untouched)', async () => {
    render(<CustomColumnManager />);
    const input = screen.getByLabelText('Probability of Signed');
    fireEvent.change(input, { target: { value: '90' } });
    await act(async () => { fireEvent.blur(input); });
    expect(stage('signed')).toMatchObject({ probability: 90, isWon: true, isLost: false, name: 'Signed', color: 'green' });
    expect(stage('demo').probability).toBe(45);
  });

  it('clamps the probability to 0-100 and ignores empty input', async () => {
    render(<CustomColumnManager />);
    const input = screen.getByLabelText('Probability of Demo');
    fireEvent.change(input, { target: { value: '250' } });
    await act(async () => { fireEvent.blur(input); });
    expect(stage('demo').probability).toBe(100);
    fireEvent.change(input, { target: { value: '' } });
    await act(async () => { fireEvent.blur(input); });
    expect(stage('demo').probability).toBe(100);
    expect(input).toHaveValue('100');
  });

  it('renaming, recolouring and setting the WIP limit never zero the probability', async () => {
    render(<CustomColumnManager />);
    const name = screen.getByLabelText('Name of stage Demo');
    fireEvent.change(name, { target: { value: 'Product demo' } });
    await act(async () => { fireEvent.blur(name); });
    await act(async () => { fireEvent.click(screen.getByLabelText('Colour teal for Product demo')); });
    const wip = screen.getByLabelText('WIP limit of Product demo');
    fireEvent.change(wip, { target: { value: '7' } });
    await act(async () => { fireEvent.blur(wip); });
    expect(stage('demo')).toMatchObject({ name: 'Product demo', color: 'teal', wipLimit: 7, probability: 45, isWon: false, isLost: false });
  });

  it('won and lost are mutually exclusive', async () => {
    render(<CustomColumnManager />);
    await act(async () => { fireEvent.click(screen.getByLabelText('Dead is a won stage')); });
    expect(stage('dead')).toMatchObject({ isWon: true, isLost: false });
    await act(async () => { fireEvent.click(screen.getByLabelText('Signed is a lost stage')); });
    expect(stage('signed')).toMatchObject({ isWon: false, isLost: true });
    await act(async () => { fireEvent.click(screen.getByLabelText('Signed is a lost stage')); });
    expect(stage('signed')).toMatchObject({ isWon: false, isLost: false });
  });

  it('hides and shows a stage', async () => {
    render(<CustomColumnManager />);
    await act(async () => { fireEvent.click(screen.getByLabelText('Hide Demo')); });
    expect(stage('demo').visible).toBe(false);
    await act(async () => { fireEvent.click(screen.getByLabelText('Show Demo')); });
    expect(stage('demo').visible).toBe(true);
  });

  it('reorders by drag and keeps every stage property', async () => {
    render(<CustomColumnManager />);
    expect(mockOnDragEnd).toBeDefined();
    await act(async () => { mockOnDragEnd!({ source: { index: 0 }, destination: { index: 2 }, draggableId: 'stage:lead' }); });
    const order = [...useDealStore.getState().stages].sort((a, b) => a.position - b.position).map(s => s.key);
    expect(order).toEqual(['demo', 'signed', 'lead', 'dead']);
    expect(stage('lead')).toMatchObject({ probability: 10, wipLimit: 5, position: 2 });
    expect(stage('signed')).toMatchObject({ probability: 100, isWon: true });
    // no-op drops change nothing
    await act(async () => { mockOnDragEnd!({ source: { index: 1 }, destination: { index: 1 } }); });
    await act(async () => { mockOnDragEnd!({ source: { index: 1 }, destination: null }); });
    expect([...useDealStore.getState().stages].sort((a, b) => a.position - b.position).map(s => s.key)).toEqual(order);
  });

  it('reorderKeys moves one key', () => {
    expect(reorderKeys(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(reorderKeys(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('adds a stage', async () => {
    render(<CustomColumnManager />);
    fireEvent.change(screen.getByLabelText('New stage name'), { target: { value: 'Contract review' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /add stage/i })); });
    const added = stage('contract-review');
    expect(added).toMatchObject({ name: 'Contract review', visible: true, probability: 0, isWon: false, isLost: false, position: 4 });
    expect(screen.getByTestId('stage-row-contract-review')).toBeInTheDocument();
  });

  it('deletes a stage after choosing where its deals go', async () => {
    render(<CustomColumnManager />);
    fireEvent.click(screen.getByLabelText('Delete Demo'));
    expect(screen.getByText('Move 2 deals to')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Move deals from Demo to'), { target: { value: 'signed' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete stage' })); });
    expect(useDealStore.getState().stages.some(s => s.key === 'demo')).toBe(false);
    expect(useDealStore.getState().deals.d1.stage).toBe('signed');
    expect(useDealStore.getState().deals.d2.stage).toBe('signed');
    expect(useDealStore.getState().deals.d3.stage).toBe('lead');
  });

  it('reports a failed change', async () => {
    useDealStore.setState({ updateStage: jest.fn(async () => false) });
    render(<CustomColumnManager />);
    const input = screen.getByLabelText('Probability of Demo');
    fireEvent.change(input, { target: { value: '60' } });
    await act(async () => { fireEvent.blur(input); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  });
});

describe('StageMenu additions', () => {
  const base = {
    otherStages: [st('b', 'B', 1)], canMoveLeft: false, canMoveRight: true, dealCount: 0,
    onRename: jest.fn(), onColor: jest.fn(), onWipLimit: jest.fn(), onHide: jest.fn(), onMove: jest.fn(), onDelete: jest.fn(),
  };

  it('edits probability and the won/lost outcome, and opens the full manager', () => {
    const onProbability = jest.fn(); const onOutcome = jest.fn(); const onEditAll = jest.fn();
    render(<StageMenu stage={st('a', 'A', 0, { probability: 20 })} {...base} onProbability={onProbability} onOutcome={onOutcome} onEditAll={onEditAll} />);
    fireEvent.click(screen.getByRole('button', { name: /Manage stage A/ }));
    const prob = screen.getByLabelText('Win probability');
    expect(prob).toHaveValue('20');
    fireEvent.change(prob, { target: { value: '65' } });
    fireEvent.blur(prob);
    expect(onProbability).toHaveBeenCalledWith(65);
    fireEvent.change(screen.getByLabelText('Stage outcome'), { target: { value: 'won' } });
    expect(onOutcome).toHaveBeenCalledWith('won');
    fireEvent.click(screen.getByRole('button', { name: /Edit all stages/ }));
    expect(onEditAll).toHaveBeenCalled();
  });

  it('shows the current outcome and does not call back when probability is unchanged', () => {
    const onProbability = jest.fn();
    render(<StageMenu stage={st('a', 'A', 0, { isLost: true })} {...base} onProbability={onProbability} onOutcome={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Manage stage A/ }));
    expect(screen.getByLabelText('Stage outcome')).toHaveValue('lost');
    fireEvent.blur(screen.getByLabelText('Win probability'));
    expect(onProbability).not.toHaveBeenCalled();
    expect(within(screen.getByLabelText('Stage outcome')).getAllByRole('option')).toHaveLength(3);
  });
});
