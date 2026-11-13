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
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));

import { useDealStore } from '../store/dealStore';
import type { Deal } from '../types';

const mk = (id: string, stage: string, position: number): Deal => ({
  id, company: 'Co ' + id, contact: 'X', value: 100, stage, probability: 10, priority: 'medium',
  createdAt: new Date(), updatedAt: new Date(), position,
});

const reset = () =>
  useDealStore.setState({
    deals: { a: mk('a', 'qualification', 1), b: mk('b', 'qualification', 2) },
    trash: {},
    error: null,
    isConnectedToDatabase: true,
  });

describe('dealStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reset();
  });

  it('moveDeal applies optimistically and persists stage + position', async () => {
    mockSync.updateDeal.mockResolvedValue({});
    const p = useDealStore.getState().moveDeal('a', 'proposal', 5);
    expect(useDealStore.getState().deals.a.stage).toBe('proposal');
    expect(useDealStore.getState().deals.a.position).toBe(5);
    await expect(p).resolves.toBe(true);
    expect(mockSync.updateDeal).toHaveBeenCalledWith('a', { stage: 'proposal', position: 5 });
  });

  it('moveDeal rolls back when persistence fails', async () => {
    mockSync.updateDeal.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const ok = await useDealStore.getState().moveDeal('a', 'proposal', 5);
    expect(ok).toBe(false);
    const a = useDealStore.getState().deals.a;
    expect(a.stage).toBe('qualification');
    expect(a.position).toBe(1);
    expect(useDealStore.getState().error).toBeTruthy();
  });

  it('createDeal assigns position = max + 1 within the stage', async () => {
    mockSync.createDeal.mockImplementation(async (d: any) => ({ ...d, id: 'new', createdAt: new Date(), updatedAt: new Date() }));
    const created = await useDealStore.getState().createDeal({
      company: 'Acme', contact: 'Jane', value: 10, stage: 'qualification', probability: 10, priority: 'low',
    });
    expect(created.position).toBe(3);
    expect(useDealStore.getState().deals.new.position).toBe(3);
    const other = await useDealStore.getState().createDeal({
      company: 'Beta', contact: 'Jo', value: 10, stage: 'proposal', probability: 10, priority: 'low',
    });
    expect(other.position).toBe(1);
  });

  it('softDeleteDeal removes from deals and restoreDeal brings it back', async () => {
    mockSync.updateDeal.mockResolvedValue({});
    await useDealStore.getState().softDeleteDeal('a');
    expect(useDealStore.getState().deals.a).toBeUndefined();
    expect(useDealStore.getState().trash.a.deletedAt).toBeInstanceOf(Date);
    expect(mockSync.updateDeal).toHaveBeenCalledWith('a', expect.objectContaining({ deletedAt: expect.any(Date) }));

    await useDealStore.getState().restoreDeal('a');
    expect(useDealStore.getState().deals.a).toBeDefined();
    expect(useDealStore.getState().deals.a.deletedAt).toBeNull();
    expect(useDealStore.getState().trash.a).toBeUndefined();
    expect(mockSync.updateDeal).toHaveBeenLastCalledWith('a', { deletedAt: null });
  });

  it('softDeleteDeal rolls back on failure', async () => {
    mockSync.updateDeal.mockRejectedValue(new Error('nope'));
    await expect(useDealStore.getState().softDeleteDeal('a')).rejects.toThrow();
    expect(useDealStore.getState().deals.a).toBeDefined();
    expect(useDealStore.getState().trash.a).toBeUndefined();
  });
});
