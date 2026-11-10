jest.mock('../services/supabaseService', () => ({ supabase: {}, isSupabaseConfigured: false }));

import { assignBulkPositions, bulkImportDeals, BulkImportItem } from '../services/dealBulkService';
import { SavedPipelineViewService, normalizeSavedFilters } from '../services/savedPipelineViewService';
import { ViewsReportingService } from '../services/viewsReportingService';
import type { Deal } from '../types';

const item = (row: number, over: Partial<BulkImportItem> = {}): BulkImportItem => ({
  row, action: 'create', data: { title: `T${row}`, company: '', contact: '', value: 1, stage: 'lead', probability: 0, priority: 'medium' }, ...over
});

describe('bulkImportDeals', () => {
  it('writes in chunks of 50, reports progress and collects failures without aborting', async () => {
    const items = Array.from({ length: 120 }, (_, i) => item(i + 1));
    const inflight: number[] = [];
    let active = 0;
    const createDeal = jest.fn(async (d: { title?: string }) => {
      active++; inflight.push(active);
      await Promise.resolve();
      active--;
      if (d.title === 'T7') throw new Error('boom');
    });
    const progress: number[] = [];
    const result = await bulkImportDeals(items, { createDeal, updateDeal: jest.fn() }, { onProgress: done => progress.push(done) });
    expect(result.created).toBe(119);
    expect(result.failed).toEqual([{ row: 7, message: 'boom' }]);
    expect(progress).toEqual([0, 50, 100, 120]);
    expect(Math.max(...inflight)).toBe(50);
  });

  it('routes updates and honours cancellation', async () => {
    const updateDeal = jest.fn(async () => undefined);
    const createDeal = jest.fn(async () => undefined);
    let cancelled = false;
    const result = await bulkImportDeals(
      [item(1, { action: 'update', existingId: 'x', data: { value: 9 } }), item(2), item(3)],
      { createDeal, updateDeal },
      { chunkSize: 1, isCancelled: () => cancelled, onProgress: done => { if (done === 2) cancelled = true; } }
    );
    expect(updateDeal).toHaveBeenCalledWith('x', { value: 9 });
    expect(result).toMatchObject({ created: 1, updated: 1 });
    expect(createDeal).toHaveBeenCalledTimes(1);
  });

  it('assigns increasing positions after the existing max per stage', () => {
    const existing = [{ id: 'a', stage: 'lead', position: 7 }] as Deal[];
    const planned = assignBulkPositions([item(1), item(2), item(3, { data: { ...item(3).data, stage: 'won' } as never })], existing);
    expect(planned.map(p => (p.data as { position: number }).position)).toEqual([8, 9, 1]);
  });
});

describe('saved views (local fallback) and the viewsReporting facade', () => {
  beforeEach(() => { localStorage.clear?.(); try { localStorage.removeItem('pipeline_saved_views_v1'); } catch { /* ignore */ } });

  it('saves, renames, defaults, shares and deletes views in one canonical store', async () => {
    const created = await SavedPipelineViewService.saveCurrentView('Hot', 'board', { conditions: [{ field: 'priority', operator: 'equals', value: 'high' }], groups: [], search: '', favoritesOnly: false }, [{ field: 'value', direction: 'desc', priority: 0 }], [], { groupBy: 'owner', isPublic: true });
    expect(created).toMatchObject({ name: 'Hot', group_by: 'owner', is_public: true, user_id: null });
    expect(await SavedPipelineViewService.saveCurrentView('hot', 'board', {}, [], [])).toBeNull(); // duplicate name

    expect(await SavedPipelineViewService.renameView(created!.id, 'Hotter')).toBe(true);
    expect(await SavedPipelineViewService.setDefaultView(created!.id)).toBe(true);
    expect((await SavedPipelineViewService.getDefaultView())?.name).toBe('Hotter');

    // the same row is visible through viewsReportingService (camelCase facade)
    const shared = await ViewsReportingService.getSavedViews();
    expect(shared).toHaveLength(1);
    expect(shared[0]).toMatchObject({ name: 'Hotter', viewType: 'kanban', isDefault: true, isPublic: true, groupBy: ['owner'] });
    expect(shared[0].filters).toHaveLength(1);

    expect(await ViewsReportingService.shareView(created!.id, false)).toBe(true);
    expect((await SavedPipelineViewService.getViewById(created!.id))?.is_public).toBe(false);
    expect(await ViewsReportingService.deleteSavedView(created!.id)).toBe(true);
    expect(await SavedPipelineViewService.getAllViews()).toEqual([]);
  });

  it('normalises legacy filter shapes', () => {
    expect(normalizeSavedFilters(undefined)).toMatchObject({ conditions: [], groups: [] });
    expect(normalizeSavedFilters([{ field: 'a' }]).conditions).toHaveLength(1);
    expect(normalizeSavedFilters({ filters: [{ field: 'a' }], favoritesOnly: true })).toMatchObject({ favoritesOnly: true });
  });
});
