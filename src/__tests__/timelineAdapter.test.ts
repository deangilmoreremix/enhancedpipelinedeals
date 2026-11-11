import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('../services/supabaseService', () => ({ supabase: {}, isSupabaseConfigured: false }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

import {
  adaptEnhancedActivities, buildTimelineEvents, getDealTimeline, logManualActivity, getContactTimeline,
} from '../services/dealTimelineService';

const act = (id: string, title: string, at: string, type = 'updated') => ({ id, type, title, created_at: at });
const enh = (id: string, title: string, at: string) => ({ id, activity_type: 'call', title, description: 'd', created_at: at });

describe('enhanced_activities read adapter', () => {
  it('maps enhanced rows to timeline activity rows', () => {
    const out = adaptEnhancedActivities([enh('e1', 'Called Jane', '2026-01-01T10:00:00Z')]);
    expect(out).toEqual([expect.objectContaining({ id: 'e1', type: 'call', title: 'Called Jane', description: 'd' })]);
    const events = buildTimelineEvents({ activities: out });
    expect(events[0]).toMatchObject({ id: 'a-e1', type: 'call', title: 'Called Jane' });
  });

  it('dedupes by id and by same title within the time window', () => {
    const existing = [act('a1', 'Stage changed', '2026-01-01T10:00:00Z', 'stage_changed')];
    const out = adaptEnhancedActivities([
      enh('a1', 'Whatever', '2026-02-01T00:00:00Z'),            // same id
      enh('e2', 'stage changed', '2026-01-01T10:00:01Z'),         // same title (case-insens.) within 2s
      enh('e3', 'Stage changed', '2026-01-01T11:00:00Z'),         // same title, far apart -> kept
      enh('e3', 'Stage changed', '2026-01-01T11:00:00Z'),         // duplicate of previous enhanced row
    ], existing);
    expect(out.map(r => r.id)).toEqual(['e3']);
  });
});

describe('manual activity logging (local deals)', () => {
  it('requires a title, then shows up in the merged deal timeline', async () => {
    await expect(logManualActivity('deal-local-1', { type: 'note_added', title: '  ' })).rejects.toThrow(/title/i);
    await logManualActivity('deal-local-1', { type: 'call', title: 'Intro call', description: 'went well' });
    const tl = await getDealTimeline('deal-local-1');
    expect(tl.some(e => e.title === 'Intro call' && e.type === 'call' && e.description === 'went well')).toBe(true);
  });

  it('contact timeline merges activities of the contact deals', async () => {
    await logManualActivity('deal-local-2', { type: 'email_sent', title: 'Sent proposal' });
    const tl = await getContactTimeline('contact-1', ['deal-local-2']);
    expect(tl.map(e => e.title)).toContain('Sent proposal');
  });
});
