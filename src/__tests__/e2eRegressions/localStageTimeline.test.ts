import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('../../services/supabaseService', () => ({ supabase: {}, isSupabaseConfigured: false }));
jest.mock('../../config/demoMode', () => ({ isDemoMode: () => true }));

import { getDealTimeline, recordLocalStageChange } from '../../services/dealTimelineService';

/** Regression (e2e E): in demo/local mode moving a deal left no stage-change entry in the merged timeline. */
describe('local stage change timeline entries', () => {
  it('shows a stage change after recordLocalStageChange', async () => {
    recordLocalStageChange('deal-x', 'Qualification', 'Negotiation');
    const events = await getDealTimeline('deal-x');
    expect(events[0]).toMatchObject({ type: 'stage_changed', title: 'Stage changed' });
    expect(events[0].description).toContain('Qualification');
    expect(events[0].description).toContain('Negotiation');
  });
  it('ignores a no-op change', async () => {
    recordLocalStageChange('deal-y', 'Same', 'Same');
    expect(await getDealTimeline('deal-y')).toEqual([]);
  });
});
