import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockSync = {
  getDeals: jest.fn<() => Promise<any>>(),
  createDeal: jest.fn<(d: any) => Promise<any>>(),
  updateDeal: jest.fn<(id: string, u: any) => Promise<any>>(),
  deleteDeal: jest.fn<(id: string) => Promise<void>>(),
  isDatabaseConnected: jest.fn(() => true),
};

jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => mockSync }));
jest.mock('../services/supabaseService', () => ({
  getSupabaseService: () => ({ subscribeToDeals: jest.fn(() => ({ unsubscribe: jest.fn() })), deleteDeal: jest.fn(), createDeal: jest.fn() }),
  supabase: {},
  isSupabaseConfigured: true,
}));
jest.mock('../services/pipelineStageService', () => ({
  getStages: jest.fn(() => Promise.resolve([])),
  subscribe: jest.fn(() => () => {}),
  createStage: jest.fn(),
  updateStage: jest.fn(),
  reorderStages: jest.fn(),
  deleteStage: jest.fn(),
  DEFAULT_STAGES: [],
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));

import { useBoardSelectionStore } from '../store/boardSelectionStore';
import { useDealStore } from '../store/dealStore';
import type { Deal } from '../types';

const mk = (id: string, stage: string, position: number): Deal => ({
  id, company: 'Co ' + id, contact: 'X', value: 100, stage, probability: 10, priority: 'medium',
  createdAt: new Date(), updatedAt: new Date(), position,
});

describe('boardSelectionStore', () => {
  beforeEach(() => useBoardSelectionStore.setState({ selectedIds: [], anchorId: null, focusedId: null }));

  it('toggles and clears', () => {
    const s = useBoardSelectionStore.getState();
    s.toggleSelect('a');
    s.toggleSelect('b');
    expect(useBoardSelectionStore.getState().selectedIds).toEqual(['a', 'b']);
    useBoardSelectionStore.getState().toggleSelect('a');
    expect(useBoardSelectionStore.getState().selectedIds).toEqual(['b']);
    useBoardSelectionStore.getState().clearSelection();
    expect(useBoardSelectionStore.getState().selectedIds).toEqual([]);
  });

  it('selects a range from the anchor', () => {
    const order = ['a', 'b', 'c', 'd', 'e'];
    useBoardSelectionStore.getState().toggleSelect('b');
    useBoardSelectionStore.getState().selectRange('d', order);
    expect(useBoardSelectionStore.getState().selectedIds.sort()).toEqual(['b', 'c', 'd']);
  });

  it('selects all in a stage without duplicates', () => {
    useBoardSelectionStore.getState().toggleSelect('a');
    useBoardSelectionStore.getState().selectAllInStage(['a', 'b', 'c']);
    expect(useBoardSelectionStore.getState().selectedIds.sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('dealStore bulk operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSync.updateDeal.mockResolvedValue({});
    useDealStore.setState({
      deals: { a: mk('a', 'qualification', 1), b: mk('b', 'qualification', 2), c: mk('c', 'proposal', 1) },
      trash: {}, error: null, isConnectedToDatabase: true,
    });
  });

  it('bulkMoveDeals appends moved deals to the destination stage and persists', async () => {
    const moved = await useDealStore.getState().bulkMoveDeals(['a', 'b'], 'proposal');
    expect(moved.sort()).toEqual(['a', 'b']);
    const { deals } = useDealStore.getState();
    expect(deals.a.stage).toBe('proposal');
    expect(deals.b.stage).toBe('proposal');
    expect(deals.a.position).toBeGreaterThan(deals.c.position as number);
    expect(mockSync.updateDeal).toHaveBeenCalledTimes(2);
  });

  it('bulkUpdateDeals applies fields to every deal', async () => {
    const done = await useDealStore.getState().bulkUpdateDeals(['a', 'c'], { priority: 'high' });
    expect(done.sort()).toEqual(['a', 'c']);
    expect(useDealStore.getState().deals.a.priority).toBe('high');
  });

  it('bulkSoftDelete moves deals to trash', async () => {
    await useDealStore.getState().bulkSoftDelete(['a', 'b']);
    const st = useDealStore.getState();
    expect(st.deals.a).toBeUndefined();
    expect(st.trash.a.deletedAt).toBeTruthy();
  });

  it('rebalanceStage re-spaces collapsed positions in one batch', async () => {
    useDealStore.setState({
      deals: { a: mk('a', 'qualification', 1), b: mk('b', 'qualification', 1 + 1e-9) },
    });
    await useDealStore.getState().rebalanceStage('qualification');
    const { deals } = useDealStore.getState();
    expect(deals.a.position).toBe(1);
    expect(deals.b.position).toBe(2);
    expect(mockSync.updateDeal).toHaveBeenCalledTimes(2);
  });
});
