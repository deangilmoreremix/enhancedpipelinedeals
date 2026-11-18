jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

import { autoMapHeaders, importableCustomFields, normalizeRow } from '../components/import/dealImportMapping';
import type { DealFieldDefinition } from '../types/customFields';

const def = (o: Partial<DealFieldDefinition> & Pick<DealFieldDefinition, 'key' | 'type'>): DealFieldDefinition => ({
  id: o.key, label: o.key, options: [], position: 0, groupName: null, isActive: true, ...o,
});
const defs = [
  def({ key: 'tier', label: 'Customer Tier', type: 'select', options: ['Gold', 'Silver'] }),
  def({ key: 'seats', type: 'number' }),
  def({ key: 'topics', type: 'multi_select', options: ['a', 'b'] }),
  def({ key: 'calc', type: 'formula', config: { formula: '1' } }),
  def({ key: 'gone', type: 'text', isActive: false }),
];
const ctx = { stages: [{ key: 's1', name: 'S1', probability: 10 } as any], stageResolution: {}, defaultStage: 's1', customFieldDefs: defs };

describe('import maps unknown headers to custom fields', () => {
  beforeEach(() => localStorage.clear());

  it('matches headers by label or key (formula / inactive excluded)', () => {
    expect(importableCustomFields(defs).map(d => d.key)).toEqual(['tier', 'seats', 'topics']);
    const mapping = autoMapHeaders(['Title', 'Customer Tier', 'SEATS', 'calc', 'gone', 'whatever'], false, defs);
    expect(mapping).toEqual(['title', 'cf:tier', 'cf:seats', '', '', '']);
    // built-in synonyms still win and without defs nothing changes
    expect(autoMapHeaders(['Title', 'Customer Tier'], false)).toEqual(['title', 'company']);
  });

  it('validates and stores custom values on the deal', () => {
    const mapping = ['title', 'cf:tier', 'cf:seats', 'cf:topics'] as const;
    const ok = normalizeRow(['Deal', 'gold', '1,200', 'a; b'], 1, [...mapping], ctx);
    expect(ok.errors).toEqual([]);
    expect(ok.deal?.customFields?.tier).toBe('Gold');
    expect(ok.deal?.customFields?.seats).toBe(1200);
    expect(ok.deal?.customFields?.topics).toEqual(['a', 'b']);
    const bad = normalizeRow(['Deal', 'Platinum', 'abc', ''], 2, [...mapping], ctx);
    expect(bad.deal).toBeUndefined();
    expect(bad.errors).toEqual(expect.arrayContaining(['Customer Tier: unknown option', 'seats must be a number']));
    const blank = normalizeRow(['Deal', '', '', ''], 3, [...mapping], ctx);
    expect(blank.deal?.customFields).toBeUndefined();
  });
});
