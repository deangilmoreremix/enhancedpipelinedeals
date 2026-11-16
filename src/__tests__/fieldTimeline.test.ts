jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

import {
  __resetLocalFieldChanges, diffDealUpdates, fieldChangeToEvent, formatFieldChange, loadFieldChangeEvents,
  mergeFieldChangeEvents, recordLocalFieldChanges,
} from '../services/timelineAdapter';
import type { Deal } from '../types';

const deal = (o: Partial<Deal> = {}): Deal => ({
  id: 'deal-1', company: 'Acme', contact: '', value: 40000, stage: 'proposal', probability: 10, priority: 'low',
  createdAt: new Date(), updatedAt: new Date(), ...o,
});

describe('field history formatting', () => {
  it('formats currency, dates, stages and owners', () => {
    expect(formatFieldChange({ field: 'value', from: 40000, to: 55000 })).toBe('Value: $40,000 → $55,000');
    expect(formatFieldChange({ field: 'value', from: 1, to: 2 }, { currencyCode: 'EUR' })).toContain('€');
    expect(formatFieldChange({ field: 'close_date', from: null, to: '2026-03-05' })).toMatch(/^Close date: empty → .*2026|3\/5/);
    expect(formatFieldChange({ field: 'stage', from: 'proposal', to: 'won' }, { stageName: k => k.toUpperCase() })).toBe('Stage: PROPOSAL → WON');
    expect(formatFieldChange({ field: 'owner_id', from: 'u1', to: 'u2' }, { ownerName: id => ({ u1: 'Ann', u2: 'Bo' } as any)[id] })).toBe('Owner: Ann → Bo');
  });

  it('renders DB rows incl. custom-field rows (bare key + custom:true + label) with the actor', () => {
    const e = fieldChangeToEvent(
      { id: '1', type: 'field_changed', created_by: 'u1', created_at: '2026-01-01T10:00:00Z', metadata: { field: 'tier', custom: true, label: 'Tier', from: 'A', to: 'B' } },
      {}, id => (id === 'u1' ? 'Ann' : undefined),
    );
    expect(e).toMatchObject({ type: 'field_changed', title: 'Tier: A → B', actor: 'Ann' });
  });

  it('drops generic updated rows that coincide with a field event', () => {
    const fe = fieldChangeToEvent({ id: '1', created_at: '2026-01-01T10:00:00Z', metadata: { field: 'title', from: 'a', to: 'b' } });
    const base = [
      { id: 'a-9', kind: 'activity' as const, type: 'updated', title: 'Deal updated', at: new Date('2026-01-01T10:00:01Z') },
      { id: 'a-8', kind: 'activity' as const, type: 'created', title: 'Deal created', at: new Date('2025-12-01T10:00:00Z') },
      { id: 'a-1', kind: 'activity' as const, type: 'field_changed', title: 'Title changed', at: new Date('2026-01-01T10:00:00Z') },
    ];
    expect(mergeFieldChangeEvents(base, [fe]).map(e => e.id)).toEqual(['a-1', 'a-8']);
  });
});

describe('local (demo) recording', () => {
  beforeEach(() => __resetLocalFieldChanges());

  it('diffs updates, skipping unchanged values and stage', () => {
    const d = diffDealUpdates(deal({ customFields: { a: 1 } }), { value: 55000, stage: 'won', title: undefined, customFields: { a: 2, b: 'x' } } as any);
    expect(d.map(c => c.field)).toEqual(['value', 'custom_fields.a', 'custom_fields.b']);
    expect(diffDealUpdates(deal(), { value: 40000 })).toEqual([]);
  });

  it('turns local field edits into timeline events', async () => {
    await recordLocalFieldChanges('deal-1', diffDealUpdates(deal(), { value: 55000 }), 'Me');
    const events = await loadFieldChangeEvents('deal-1');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ title: 'Value: $40,000 → $55,000', actor: 'Me', type: 'field_changed' });
    expect(await loadFieldChangeEvents('other')).toEqual([]);
  });
});
