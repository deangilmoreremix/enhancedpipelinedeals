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
  DEFAULT_STAGES: [],
  updateStage: jest.fn<() => Promise<void>>(),
  createStage: jest.fn(),
  reorderStages: jest.fn(),
  deleteStage: jest.fn(),
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));

import { useDealStore } from '../store/dealStore';
import { useDealRecordStore } from '../store/dealRecordStore';
import { updateStage as updateStageRow } from '../services/pipelineStageService';
import type { Deal } from '../types';

const mk = (id: string, stage: string, position: number): Deal => ({
  id, company: 'Co ' + id, contact: 'X', value: 100, stage, probability: 10, priority: 'medium',
  createdAt: new Date(), updatedAt: new Date(), position,
});
const toasts = () => useDealRecordStore.getState().toasts.map(t => t.message);

describe('dealStore RLS denials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    useDealRecordStore.setState({ toasts: [] });
    useDealStore.setState({
      deals: { a: mk('a', 'qualification', 1), b: mk('b', 'qualification', 2) },
      trash: {},
      stages: [{ id: 's', key: 'qualification', name: 'Q', color: 'gray', position: 0, visible: true, probability: 0, isWon: false, isLost: false, wipLimit: null }],
      error: null,
      isConnectedToDatabase: true,
    });
  });

  it('moveDeal: 42501 rolls back and toasts the permission message', async () => {
    mockSync.updateDeal.mockRejectedValue({ code: '42501', message: 'new row violates row-level security policy' });
    const ok = await useDealStore.getState().moveDeal('a', 'proposal', 5);
    expect(ok).toBe(false);
    expect(useDealStore.getState().deals.a.stage).toBe('qualification');
    expect(useDealStore.getState().deals.a.position).toBe(1);
    expect(useDealStore.getState().error).toBe("You don't have permission to move this deal");
    expect(toasts()).toContain("You don't have permission to move this deal");
  });

  it('updateDeal: 0 rows (PGRST116 from .single()) rolls back, rethrows and toasts', async () => {
    mockSync.updateDeal.mockRejectedValue({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
    await expect(useDealStore.getState().updateDeal('a', { title: 'Hacked' })).rejects.toBeTruthy();
    expect(useDealStore.getState().deals.a.title).toBeUndefined();
    expect(toasts()).toContain("You don't have permission to edit this deal");
  });

  it('updateDeal: a plain failure keeps the generic message and does not toast a permission error', async () => {
    mockSync.updateDeal.mockRejectedValue(new Error('network down'));
    await expect(useDealStore.getState().updateDeal('a', { title: 'x' })).rejects.toThrow('network down');
    expect(useDealStore.getState().error).toBe('Failed to update deal');
    expect(toasts()).toHaveLength(0);
  });

  it('softDeleteDeal: denial puts the deal back and toasts', async () => {
    mockSync.updateDeal.mockRejectedValue({ status: 403 });
    await expect(useDealStore.getState().softDeleteDeal('a')).rejects.toBeTruthy();
    expect(useDealStore.getState().deals.a).toBeDefined();
    expect(useDealStore.getState().trash.a).toBeUndefined();
    expect(toasts()).toContain("You don't have permission to delete this deal");
  });

  it('restoreDeal: denial puts the deal back in the trash', async () => {
    const trashed = { ...mk('t', 'qualification', 3), deletedAt: new Date() };
    useDealStore.setState({ trash: { t: trashed } });
    mockSync.updateDeal.mockRejectedValue({ code: '42501' });
    await expect(useDealStore.getState().restoreDeal('t')).rejects.toBeTruthy();
    expect(useDealStore.getState().trash.t).toBeDefined();
    expect(useDealStore.getState().deals.t).toBeUndefined();
    expect(toasts()).toContain("You don't have permission to restore this deal");
  });

  it('bulkUpdateDeals: denied deals roll back and are not reported as updated; one toast', async () => {
    mockSync.updateDeal.mockImplementation(async (id: string) => {
      if (id === 'b') throw { code: '42501' };
      return {};
    });
    const done = await useDealStore.getState().bulkUpdateDeals(['a', 'b'], { priority: 'high' });
    expect(done).toEqual(['a']);
    expect(useDealStore.getState().deals.b.priority).toBe('medium');
    expect(toasts().filter(m => m.includes('permission'))).toHaveLength(1);
  });

  it('bulkMoveDeals: denial reported per deal', async () => {
    mockSync.updateDeal.mockRejectedValue({ code: '42501' });
    const moved = await useDealStore.getState().bulkMoveDeals(['a', 'b'], 'proposal');
    expect(moved).toEqual([]);
    expect(useDealStore.getState().deals.a.stage).toBe('qualification');
  });

  it('updateStage: denial rolls back the stage and toasts the stage message', async () => {
    (updateStageRow as jest.Mock<() => Promise<void>>).mockRejectedValue({ code: '42501' });
    const ok = await useDealStore.getState().updateStage('qualification', { name: 'Renamed' });
    expect(ok).toBe(false);
    expect(useDealStore.getState().stages[0].name).toBe('Q');
    expect(toasts()).toContain("You don't have permission to manage stages");
  });
});
