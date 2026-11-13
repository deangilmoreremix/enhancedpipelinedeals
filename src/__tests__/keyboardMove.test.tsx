import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';

jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/supabaseService', () => ({ getSupabaseService: () => ({}), supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/pipelineStageService', () => ({
  getStages: jest.fn(() => Promise.resolve([])),
  subscribe: jest.fn(() => () => {}),
  DEFAULT_STAGES: [],
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

import { useBoardHotkeys, BOARD_HOTKEYS } from '../hooks/useBoardHotkeys';
import { useStageKeyboardMove } from '../hooks/useStageKeyboardMove';
import { useBoardSelectionStore } from '../store/boardSelectionStore';
import { useDealStore } from '../store/dealStore';
import type { Deal, PipelineStage } from '../types';

const st = (key: string, position: number, extra: Partial<PipelineStage> = {}): PipelineStage => ({
  id: key, key, name: key.toUpperCase(), color: 'blue', position, visible: true, probability: 0, isWon: false, isLost: false, wipLimit: null, ...extra,
});
const deal = (id: string, stage: string, position = 1): Deal => ({
  id, company: 'Co', contact: 'X', value: 1, stage, probability: 0, priority: 'medium', createdAt: new Date(), updatedAt: new Date(), position,
});

const moveDeal = jest.fn(async () => true);
const bulkMoveDeals = jest.fn(async (ids: string[]) => ids);
const notify = jest.fn();

const Harness: React.FC = () => {
  const move = useStageKeyboardMove(notify);
  useBoardHotkeys({
    getColumns: () => [{ key: 'x', ids: ['a', 'b', 'c'] }],
    onOpen: jest.fn(),
    onMoveStage: (dir, ids) => void move(dir, ids),
  });
  return <input aria-label="typing" />;
};

const press = async (init: KeyboardEventInit, target: EventTarget = document) => {
  await act(async () => { fireEvent.keyDown(target, init); });
};

beforeEach(() => {
  jest.clearAllMocks();
  useDealStore.setState({
    stages: [st('lead', 0), st('mid', 1, { wipLimit: 2 }), st('won', 2), st('hidden', 3, { visible: false })],
    deals: { a: deal('a', 'lead', 1), b: deal('b', 'lead', 2), c: deal('c', 'mid', 5), d: deal('d', 'mid', 9) },
    moveDeal, bulkMoveDeals,
  });
  useBoardSelectionStore.setState({ selectedIds: [], anchorId: null, focusedId: null });
});

describe('Alt+Arrow keyboard stage move', () => {
  it('moves the focused card to the next stage via moveDeal and toasts', async () => {
    useBoardSelectionStore.setState({ focusedId: 'c' });
    render(<Harness />);
    await press({ key: 'ArrowRight', altKey: true });
    // c is in "mid" (limit 2, full with c+d) but moving out to "won" is fine
    expect(moveDeal).toHaveBeenCalledWith('c', 'won', 1);
    expect(notify).toHaveBeenCalledWith('Moved to WON', 'success');
  });

  it('moves to the previous stage with Alt+ArrowLeft', async () => {
    useBoardSelectionStore.setState({ focusedId: 'c' });
    render(<Harness />);
    await press({ key: 'ArrowLeft', altKey: true });
    expect(moveDeal).toHaveBeenCalledWith('c', 'lead', 3); // appended after the last card of "lead"
    expect(notify).toHaveBeenCalledWith('Moved to LEAD', 'success');
  });

  it('moves the whole selection through bulkMoveDeals when there is one', async () => {
    useBoardSelectionStore.setState({ selectedIds: ['a', 'b'], focusedId: 'c' });
    render(<Harness />);
    await press({ key: 'ArrowRight', altKey: true });
    // lead -> mid would reach 4 of 2: blocked
    expect(bulkMoveDeals).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('WIP limit (2)'), 'warning');
  });

  it('overrides the WIP limit when Shift is held as well', async () => {
    useBoardSelectionStore.setState({ selectedIds: ['a', 'b'] });
    render(<Harness />);
    await act(async () => { fireEvent.keyDown(window, { key: 'Shift', shiftKey: true }); });
    await press({ key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(bulkMoveDeals).toHaveBeenCalledWith(['a', 'b'], 'mid');
    expect(notify).toHaveBeenCalledWith('Moved 2 deals to MID', 'success');
  });

  it('tells the user when the card is already at the edge, and never targets hidden stages', async () => {
    useBoardSelectionStore.setState({ focusedId: 'a' });
    render(<Harness />);
    await press({ key: 'ArrowLeft', altKey: true });
    expect(moveDeal).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('Already in the first stage', 'info');
    useDealStore.setState({ deals: { ...useDealStore.getState().deals, a: deal('a', 'won') } });
    await press({ key: 'ArrowRight', altKey: true });
    expect(moveDeal).not.toHaveBeenCalled(); // next stage is hidden
    expect(notify).toHaveBeenCalledWith('Already in the last stage', 'info');
  });

  it('does nothing without a focused card or selection, or while typing in an input', async () => {
    const { getByLabelText } = render(<Harness />);
    await press({ key: 'ArrowRight', altKey: true });
    expect(moveDeal).not.toHaveBeenCalled();
    useBoardSelectionStore.setState({ focusedId: 'a' });
    await press({ key: 'ArrowRight', altKey: true }, getByLabelText('typing'));
    expect(moveDeal).not.toHaveBeenCalled();
  });

  it('plain arrows still move focus (Alt is not swallowed by navigation)', async () => {
    useBoardSelectionStore.setState({ focusedId: 'a' });
    render(<Harness />);
    await press({ key: 'ArrowDown' });
    expect(useBoardSelectionStore.getState().focusedId).toBe('b');
    expect(moveDeal).not.toHaveBeenCalled();
  });

  it('is documented in the hotkeys help', () => {
    expect(BOARD_HOTKEYS.some(h => /Alt/.test(h.keys) && /stage/i.test(h.description))).toBe(true);
  });
});
