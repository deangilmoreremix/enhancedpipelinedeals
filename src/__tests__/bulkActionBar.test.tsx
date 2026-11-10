import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/supabaseService', () => ({ getSupabaseService: () => ({}), supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/pipelineStageService', () => ({
  getStages: jest.fn(() => Promise.resolve([])),
  subscribe: jest.fn(() => () => {}),
  DEFAULT_STAGES: [],
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

import { BulkActionBar } from '../components/pipeline/BulkActionBar';
import { useBoardSelectionStore } from '../store/boardSelectionStore';
import { useDealStore } from '../store/dealStore';
import type { Deal, PipelineStage } from '../types';

const mk = (id: string, stage: string): Deal => ({
  id, company: 'Co', contact: 'X', value: 100, stage, probability: 10, priority: 'medium',
  createdAt: new Date(), updatedAt: new Date(), position: 1,
});
const stage = (key: string, position: number, wipLimit: number | null = null): PipelineStage => ({
  id: key, key, name: key.toUpperCase(), color: 'blue', position, visible: true, probability: 0, isWon: false, isLost: false, wipLimit,
});

describe('BulkActionBar', () => {
  const bulkMoveDeals = jest.fn(async (ids: string[]) => ids);
  const bulkUpdateDeals = jest.fn(async (ids: string[]) => ids);
  const bulkSoftDelete = jest.fn(async (ids: string[]) => ids);

  beforeEach(() => {
    jest.clearAllMocks();
    useDealStore.setState({
      deals: { a: mk('a', 'one'), b: mk('b', 'one'), c: mk('c', 'two') },
      stages: [stage('one', 0), stage('two', 1), stage('full', 2, 1)],
      bulkMoveDeals, bulkUpdateDeals, bulkSoftDelete,
    });
    useBoardSelectionStore.setState({ selectedIds: ['a', 'b'], anchorId: 'a', focusedId: null });
  });

  it('renders nothing without a selection', () => {
    useBoardSelectionStore.setState({ selectedIds: [] });
    const { container } = render(<BulkActionBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it('moves the selected deals to the chosen stage', async () => {
    render(<BulkActionBar />);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    await act(async () => { fireEvent.change(screen.getByLabelText('Move to stage'), { target: { value: 'two' } }); });
    expect(bulkMoveDeals).toHaveBeenCalledWith(['a', 'b'], 'two');
  });

  it('blocks a move that would exceed the WIP limit', async () => {
    const onNotify = jest.fn();
    render(<BulkActionBar onNotify={onNotify} />);
    await act(async () => { fireEvent.change(screen.getByLabelText('Move to stage'), { target: { value: 'full' } }); });
    expect(bulkMoveDeals).not.toHaveBeenCalled();
    expect(onNotify).toHaveBeenCalledWith(expect.stringContaining('WIP limit'), 'warning');
  });

  it('sets priority and requires confirmation to delete', async () => {
    render(<BulkActionBar />);
    await act(async () => { fireEvent.change(screen.getByLabelText('Set priority'), { target: { value: 'high' } }); });
    expect(bulkUpdateDeals).toHaveBeenCalledWith(['a', 'b'], { priority: 'high' });

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(bulkSoftDelete).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete' })); });
    expect(bulkSoftDelete).toHaveBeenCalledWith(['a', 'b']);
  });

  it('clears the selection', () => {
    render(<BulkActionBar />);
    fireEvent.click(screen.getByLabelText('Clear selection'));
    expect(useBoardSelectionStore.getState().selectedIds).toEqual([]);
  });
});
