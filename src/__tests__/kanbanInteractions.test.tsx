import React from 'react';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';

let mockOnDragEnd: ((r: unknown) => void) | undefined;
jest.mock('@hello-pangea/dnd', () => {
  const R = require('react');
  return {
    DragDropContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: (r: unknown) => void }) => { mockOnDragEnd = onDragEnd; return R.createElement('div', null, children); },
    Droppable: ({ children }: { children: (p: unknown, s: unknown) => React.ReactNode }) => children({ innerRef: () => undefined, droppableProps: {}, placeholder: null }, { isDraggingOver: false }),
    Draggable: ({ children }: { children: (p: unknown, s: unknown) => React.ReactNode }) => children({ innerRef: () => undefined, draggableProps: {}, dragHandleProps: {} }, { isDragging: false }),
    useMouseSensor: () => undefined,
    useTouchSensor: () => undefined,
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

import { KanbanBoard } from '../components/pipeline/KanbanBoard';
import { DealCardMetadata } from '../components/ui/DealCardMetadata';
import { PriorityDotCell } from '../components/pipeline/cells/DealCells';
import { useDealStore } from '../store/dealStore';
import { useBoardSelectionStore } from '../store/boardSelectionStore';
import { useUserDirectoryStore } from '../store/userDirectoryStore';
import type { Deal, PipelineStage } from '../types';

const st = (key: string, position: number, extra: Partial<PipelineStage> = {}): PipelineStage => ({
  id: key, key, name: key.toUpperCase(), color: 'blue', position, visible: true, probability: 0, isWon: false, isLost: false, wipLimit: null, ...extra,
});
const deal = (id: string, stage: string, position = 1): Deal => ({
  id, title: `T${id}`, company: 'Co', contact: 'X', value: 100, stage, probability: 0, priority: 'medium',
  createdAt: new Date(2024, 0, position), updatedAt: new Date(), position,
});

const STAGES = [st('lead', 0), st('mid', 1, { wipLimit: 2 }), st('won', 2, { isWon: true })];
const DEALS = [deal('a', 'lead', 1), deal('b', 'lead', 2), deal('c', 'lead', 3), deal('m1', 'mid', 1), deal('w1', 'won', 1)];

const moveDeal = jest.fn(async () => true);
const bulkMoveDeals = jest.fn(async (ids: string[]) => ids);

const Board: React.FC = () => (
  <KanbanBoard
    deals={DEALS}
    stages={STAGES}
    sortBy="manual"
    isLoading={false}
    indicators={{}}
    onOpenDeal={jest.fn()}
    renderCard={(d) => <div data-deal-id={d.id} style={{ height: 50 }}>{d.title}</div>}
  />
);

const dropResult = (id: string, from: string, to: string) => ({
  draggableId: id, type: 'DEFAULT', reason: 'DROP', mode: 'FLUID', combine: null,
  source: { droppableId: from, index: 0 }, destination: { droppableId: to, index: 0 },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockOnDragEnd = undefined;
  useUserDirectoryStore.setState({ users: [], loadedAt: Date.now() });
  useDealStore.setState({ stages: STAGES, deals: Object.fromEntries(DEALS.map(d => [d.id, d])), moveDeal, bulkMoveDeals });
  useBoardSelectionStore.setState({ selectedIds: [], anchorId: null, focusedId: null });
});

describe('multi-card drag', () => {
  it('dragging a selected card moves the whole selection to the target stage', () => {
    useBoardSelectionStore.setState({ selectedIds: ['a', 'b'] });
    render(<Board />);
    act(() => { mockOnDragEnd!(dropResult('a', 'lead', 'won')); });
    expect(bulkMoveDeals).toHaveBeenCalledWith(['a', 'b'], 'won');
    expect(moveDeal).not.toHaveBeenCalled();
  });

  it('dragging a card that is not selected moves only that card', () => {
    useBoardSelectionStore.setState({ selectedIds: ['a', 'b'] });
    render(<Board />);
    act(() => { mockOnDragEnd!(dropResult('c', 'lead', 'won')); });
    expect(moveDeal).toHaveBeenCalledWith('c', 'won', expect.any(Number));
    expect(bulkMoveDeals).not.toHaveBeenCalled();
  });

  it('a single selected card is a plain drag', () => {
    useBoardSelectionStore.setState({ selectedIds: ['a'] });
    render(<Board />);
    act(() => { mockOnDragEnd!(dropResult('a', 'lead', 'won')); });
    expect(moveDeal).toHaveBeenCalledTimes(1);
    expect(bulkMoveDeals).not.toHaveBeenCalled();
  });

  it('respects the WIP limit for the whole selection (blocked, with a toast)', () => {
    useBoardSelectionStore.setState({ selectedIds: ['a', 'b'] });
    render(<Board />);
    // "mid" holds 1 of 2: two more would reach 3
    act(() => { mockOnDragEnd!(dropResult('a', 'lead', 'mid')); });
    expect(bulkMoveDeals).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/WIP limit \(2\)/);
  });

  it('Shift overrides the WIP limit', () => {
    useBoardSelectionStore.setState({ selectedIds: ['a', 'b'] });
    render(<Board />);
    act(() => { fireEvent.keyDown(window, { key: 'Shift', shiftKey: true }); });
    act(() => { mockOnDragEnd!(dropResult('a', 'lead', 'mid')); });
    expect(bulkMoveDeals).toHaveBeenCalledWith(['a', 'b'], 'mid');
  });
});

describe('marquee selection', () => {
  let spy: jest.SpyInstance;
  const rects: Record<string, [number, number, number, number]> = {
    a: [10, 10, 110, 60], b: [10, 70, 110, 120], c: [10, 130, 110, 180], m1: [300, 10, 400, 60],
  };
  beforeEach(() => {
    spy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const r = this.dataset?.dealId ? rects[this.dataset.dealId] : undefined;
      const [left, top, right, bottom] = r ?? [0, 0, 0, 0];
      return { left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) } as DOMRect;
    });
  });
  afterEach(() => spy.mockRestore());

  const scroll = () => screen.getByTestId('kanban-scroll');
  const drag = (to: { x: number; y: number }, from = { x: 5, y: 5 }, init: MouseEventInit = {}) => {
    fireEvent.mouseDown(scroll(), { button: 0, clientX: from.x, clientY: from.y, ...init });
    fireEvent.mouseMove(document, { clientX: to.x, clientY: to.y });
  };

  it('draws a rectangle on the empty board background and selects the cards it touches', () => {
    render(<Board />);
    drag({ x: 150, y: 100 });
    expect(screen.getByTestId('marquee-rect')).toBeInTheDocument();
    expect(useBoardSelectionStore.getState().selectedIds.sort()).toEqual(['a', 'b']);
    // growing the rectangle selects more, shrinking deselects
    fireEvent.mouseMove(document, { clientX: 420, clientY: 100 });
    expect(useBoardSelectionStore.getState().selectedIds.sort()).toEqual(['a', 'b', 'm1']);
    fireEvent.mouseMove(document, { clientX: 150, clientY: 40 });
    expect(useBoardSelectionStore.getState().selectedIds).toEqual(['a']);
    fireEvent.mouseUp(document);
    expect(screen.queryByTestId('marquee-rect')).not.toBeInTheDocument();
    expect(useBoardSelectionStore.getState().selectedIds).toEqual(['a']);
  });

  it('Shift adds to the existing selection', () => {
    useBoardSelectionStore.setState({ selectedIds: ['c'] });
    render(<Board />);
    drag({ x: 150, y: 100 }, { x: 5, y: 5 }, { shiftKey: true });
    fireEvent.mouseUp(document);
    expect(useBoardSelectionStore.getState().selectedIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('a plain click on empty space clears the selection', () => {
    useBoardSelectionStore.setState({ selectedIds: ['a', 'b'] });
    render(<Board />);
    fireEvent.mouseDown(scroll(), { button: 0, clientX: 5, clientY: 5 });
    fireEvent.mouseUp(document);
    expect(useBoardSelectionStore.getState().selectedIds).toEqual([]);
  });

  it('ignores presses that start on a card or a button, and non-primary buttons', () => {
    useBoardSelectionStore.setState({ selectedIds: ['c'] });
    render(<Board />);
    fireEvent.mouseDown(screen.getByText('Ta'), { button: 0, clientX: 20, clientY: 20 });
    fireEvent.mouseMove(document, { clientX: 150, clientY: 100 });
    fireEvent.mouseUp(document);
    expect(screen.queryByTestId('marquee-rect')).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: /Add stage/ }), { button: 0, clientX: 5, clientY: 5 });
    fireEvent.mouseUp(document);
    fireEvent.mouseDown(scroll(), { button: 2, clientX: 5, clientY: 5 });
    fireEvent.mouseMove(document, { clientX: 150, clientY: 100 });
    fireEvent.mouseUp(document);
    expect(useBoardSelectionStore.getState().selectedIds).toEqual(['c']);
  });

  it('does not start a marquee for tiny pointer jitter', () => {
    render(<Board />);
    drag({ x: 7, y: 7 });
    expect(screen.queryByTestId('marquee-rect')).not.toBeInTheDocument();
    fireEvent.mouseUp(document);
  });
});

describe('card quick edit', () => {
  const deal1 = deal('q', 'lead');

  it('clicking the value edits it in place without triggering the card click', async () => {
    const onCardClick = jest.fn();
    const onQuickUpdate = jest.fn(async () => undefined);
    render(<div onClick={onCardClick}><DealCardMetadata deal={deal1} onQuickUpdate={onQuickUpdate} /></div>);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Value' }));
    expect(onCardClick).not.toHaveBeenCalled();
    const input = screen.getByLabelText('Value');
    fireEvent.change(input, { target: { value: '4200' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    expect(onQuickUpdate).toHaveBeenCalledWith({ value: 4200 });
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('keeps the plain read-only value when no quick-update handler is given', () => {
    render(<DealCardMetadata deal={deal1} />);
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Value' })).not.toBeInTheDocument();
  });

  it('shows the stage name from the stage metadata', () => {
    render(<DealCardMetadata deal={deal('s', 'won')} />);
    expect(screen.getByText('WON')).toBeInTheDocument();
  });

  it('the priority chip opens a menu and saves the chosen priority', async () => {
    const onCommit = jest.fn(async () => undefined);
    const onCardClick = jest.fn();
    render(<div onClick={onCardClick}><PriorityDotCell label="Priority" value="medium" onCommit={onCommit} /></div>);
    fireEvent.click(screen.getByRole('button', { name: /Priority: Medium Priority/ }));
    await act(async () => { fireEvent.click(within(screen.getByRole('listbox', { name: 'Priority' })).getByRole('button', { name: 'High Priority' })); });
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith('high'));
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
