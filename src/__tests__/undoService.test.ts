import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/supabaseService', () => ({ getSupabaseService: () => ({}), supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/pipelineStageService', () => ({ getStages: jest.fn(() => Promise.resolve([])), subscribe: jest.fn(() => () => {}), DEFAULT_STAGES: [] }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

import {
  MAX_ENTRIES, UNDO_TTL_MS, __resetUndo, __setUndoAutoHost, captureFields, expireStale, groupByPrevious, hasUndoable, pushUndo, runUndo,
  undoLast, undoableBulkMove, undoableBulkUpdate, undoableDelete, useUndoStore,
} from '../services/undoService';
import { useDealStore } from '../store/dealStore';
import { useDealRecordStore } from '../store/dealRecordStore';
import type { Deal } from '../types';

const mk = (id: string, over: Partial<Deal> = {}): Deal => ({
  id, company: `Co ${id}`, contact: 'X', value: 100, stage: 'one', probability: 10, priority: 'medium',
  createdAt: new Date(), updatedAt: new Date(), position: 1, ...over,
});

describe('undoService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __setUndoAutoHost(false);
    __resetUndo();
    useDealRecordStore.setState({ toasts: [] });
  });
  afterEach(() => { __resetUndo(); jest.useRealTimers(); });

  it('registers an entry, undoes it once and removes it', async () => {
    const undo = jest.fn(async () => {});
    const id = pushUndo({ label: 'Did a thing', undo });
    expect(useUndoStore.getState().entries).toHaveLength(1);
    expect(await runUndo(id)).toBe(true);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(useUndoStore.getState().entries).toHaveLength(0);
    expect(await runUndo(id)).toBe(false);
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('expires after the TTL and clears its timer (no leak)', () => {
    pushUndo({ label: 'x', undo: async () => {} });
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(UNDO_TTL_MS + 1);
    expect(useUndoStore.getState().entries).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('expireStale drops entries past expiry and never runs a stale undo', async () => {
    const undo = jest.fn(async () => {});
    pushUndo({ label: 'old', undo, ttlMs: 1000 });
    jest.setSystemTime(Date.now() + 5000);
    expireStale();
    expect(hasUndoable()).toBe(false);
    expect(await undoLast()).toBe(false);
    expect(undo).not.toHaveBeenCalled();
  });

  it('caps entries and clears the evicted entry timers', () => {
    for (let i = 0; i < MAX_ENTRIES + 3; i++) pushUndo({ label: `e${i}`, undo: async () => {} });
    expect(useUndoStore.getState().entries).toHaveLength(MAX_ENTRIES);
    expect(jest.getTimerCount()).toBe(MAX_ENTRIES);
  });

  it('a failing undo shows an error toast and removes the entry', async () => {
    const id = pushUndo({ label: 'Bad', undo: async () => { throw new Error('boom'); } });
    expect(await runUndo(id)).toBe(false);
    expect(useUndoStore.getState().entries).toHaveLength(0);
    expect(useDealRecordStore.getState().toasts.some(t => t.type === 'error' && /boom/.test(t.message))).toBe(true);
  });

  it('informational entries cannot be undone', async () => {
    pushUndo({ label: 'Merged' });
    expect(hasUndoable()).toBe(false);
    expect(await undoLast()).toBe(false);
  });

  it('undoLast runs the newest undoable entry', async () => {
    const a = jest.fn(async () => {}); const b = jest.fn(async () => {});
    pushUndo({ label: 'a', undo: a }); pushUndo({ label: 'b', undo: b });
    await undoLast();
    expect(b).toHaveBeenCalled();
    expect(a).not.toHaveBeenCalled();
  });

  describe('deal helpers', () => {
    it('captureFields records previous values, using null for missing ones, and groups equal values', () => {
      const deals = { a: mk('a', { priority: 'low' }), b: mk('b', { priority: 'low' }), c: mk('c') };
      const prev = captureFields(['a', 'b', 'c', 'zzz'], ['priority', 'assignedTo'], deals);
      expect(prev).toEqual({ a: { priority: 'low', assignedTo: null }, b: { priority: 'low', assignedTo: null }, c: { priority: 'medium', assignedTo: null } });
      const groups = groupByPrevious(prev);
      expect(groups).toHaveLength(2);
      expect(groups.find(g => g.values.priority === 'low')!.ids.sort()).toEqual(['a', 'b']);
    });

    it('bulk update captures the before-state and Undo restores it via bulkUpdateDeals', async () => {
      const bulkUpdateDeals = jest.fn(async (ids: string[]) => ids);
      useDealStore.setState({ deals: { a: mk('a', { priority: 'low' }), b: mk('b', { priority: 'high' }) }, bulkUpdateDeals } as any);
      await undoableBulkUpdate(['a', 'b'], { priority: 'medium' }, 'Priority changed');
      expect(bulkUpdateDeals).toHaveBeenCalledWith(['a', 'b'], { priority: 'medium' });
      expect(await undoLast()).toBe(true);
      expect(bulkUpdateDeals).toHaveBeenCalledWith(['a'], { priority: 'low' });
      expect(bulkUpdateDeals).toHaveBeenCalledWith(['b'], { priority: 'high' });
    });

    it('undo reports an error when some deals could not be restored', async () => {
      const bulkUpdateDeals = jest.fn(async (ids: string[]) => (ids.length === 1 && ids[0] === 'a' && bulkUpdateDeals.mock.calls.length > 1 ? [] : ids));
      useDealStore.setState({ deals: { a: mk('a', { priority: 'low' }) }, bulkUpdateDeals } as any);
      await undoableBulkUpdate(['a'], { priority: 'high' }, 'Priority changed');
      expect(await undoLast()).toBe(false);
      expect(useDealRecordStore.getState().toasts.some(t => t.type === 'error')).toBe(true);
    });

    it('bulk move restores stage and position', async () => {
      const bulkMoveDeals = jest.fn(async (ids: string[]) => ids);
      const moveDeal = jest.fn(async () => true);
      useDealStore.setState({ deals: { a: mk('a', { stage: 'one', position: 3 }) }, stages: [{ key: 'two', name: 'Two' }] as any, bulkMoveDeals, moveDeal } as any);
      await undoableBulkMove(['a'], 'two');
      await undoLast();
      expect(moveDeal).toHaveBeenCalledWith('a', 'one', 3);
    });

    it('delete -> Undo calls restoreDeals with the deleted ids; nothing is registered when nothing was deleted', async () => {
      const bulkSoftDelete = jest.fn(async (ids: string[]) => ids.filter(i => i !== 'bad'));
      const restoreDeals = jest.fn(async (ids: string[]) => ids.length);
      useDealStore.setState({ deals: { a: mk('a'), b: mk('b') }, bulkSoftDelete, restoreDeals } as any);
      await undoableDelete(['a', 'b', 'bad']);
      expect(useUndoStore.getState().entries).toHaveLength(1);
      await undoLast();
      expect(restoreDeals).toHaveBeenCalledWith(['a', 'b']);
      __resetUndo();
      useDealStore.setState({ bulkSoftDelete: jest.fn(async () => []) } as any);
      await undoableDelete(['a']);
      expect(useUndoStore.getState().entries).toHaveLength(0);
    });
  });
});
