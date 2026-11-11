import { describe, it, expect, beforeEach, jest } from '@jest/globals';

/** deal_audit() already writes created / stage_changed / updated rows: the client must not add duplicates. */
const inserts: Array<{ table: string; row: any }> = [];
let demo = false;
let dealRow: any = { id: DEAL_ID(), tags: [], stage: 'qualification' };
function DEAL_ID() { return '11111111-1111-4111-8111-111111111111'; }

const builder = (table: string): any => {
  const b: any = {};
  ['select', 'update', 'delete', 'eq', 'single'].forEach(m => { b[m] = () => b; });
  b.insert = (row: any) => { inserts.push({ table, row }); return b; };
  b.then = (res: any, rej: any) => Promise.resolve({ data: table === 'deals' ? dealRow : null, error: null }).then(res, rej);
  b.single = () => Promise.resolve({ data: table === 'deals' ? dealRow : null, error: null });
  return b;
};
jest.mock('../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from: (t: string) => builder(t), auth: { getSession: () => Promise.resolve({ data: { session: null } }) } },
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));

import { BulkDealActionsService, shouldLogBulkActivity } from '../services/bulkDealActionsService';
import { DealTimelineService } from '../services/dealTimelineService';

const DEAL = DEAL_ID();
const activityInserts = () => inserts.filter(i => i.table === 'deal_activities').map(i => i.row);

describe('timeline de-duplication with the deal_audit trigger', () => {
  beforeEach(() => { inserts.length = 0; demo = false; dealRow = { id: DEAL, tags: [], stage: 'qualification' }; });

  it('does not log created / stage_changed / updated from the client for remote deals', async () => {
    await DealTimelineService.logDealCreated(DEAL, { company: 'Acme', value: 1 });
    await DealTimelineService.logStageChanged(DEAL, 'a', 'b');
    await DealTimelineService.logDealUpdated(DEAL, { value: 1 }, { value: 2 });
    expect(activityInserts()).toEqual([]);
  });

  it('keeps event types the trigger does not write (e.g. note_added, bulk_action)', async () => {
    await DealTimelineService.logNoteAdded(DEAL, 'hello');
    await DealTimelineService.logBulkAction(DEAL, 'Tag', 'x');
    expect(activityInserts().map(r => r.type)).toEqual(['note_added', 'bulk_action']);
  });

  it('bulk change_stage on a remote deal adds no duplicate row; add_tag still logs a bulk_action', async () => {
    const stage = await BulkDealActionsService.executeBulkAction([DEAL], { id: 's', name: 'Change Stage', description: '', actionType: 'change_stage', targetStage: 'proposal', isDestructive: false } as any, 'u1');
    expect(stage[0].success).toBe(true);
    expect(activityInserts()).toEqual([]);
    await BulkDealActionsService.executeBulkAction([DEAL], { id: 't', name: 'Add Tag', description: '', actionType: 'add_tag', tagsToAdd: ['vip'], isDestructive: false } as any, 'u1');
    expect(activityInserts()).toHaveLength(1);
    expect(activityInserts()[0]).toMatchObject({ type: 'bulk_action', title: 'Add Tag' });
  });

  it('bulk delete writes no activity row for the vanished deal', async () => {
    await BulkDealActionsService.executeBulkAction([DEAL], { id: 'd', name: 'Delete', description: '', actionType: 'delete', isDestructive: true } as any, 'u1');
    expect(activityInserts()).toEqual([]);
  });

  it('shouldLogBulkActivity: local deals (no trigger) always log; remote only for non-audited columns', () => {
    expect(shouldLogBulkActivity('local-deal-1', ['stage'])).toBe(true);
    expect(shouldLogBulkActivity(DEAL, ['stage', 'value'])).toBe(false);
    expect(shouldLogBulkActivity(DEAL, ['tags'])).toBe(true);
    demo = true;
    expect(shouldLogBulkActivity(DEAL, ['stage'])).toBe(true);
  });
});
