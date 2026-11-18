const mockRpc = jest.fn();
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
let demo = true;
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));

import { findDuplicateDeals, findDuplicatesLocal, similarity } from '../services/dealDuplicateService';
import { getConflicts, resolveMergeUpdates, mergeDeals } from '../services/dealMergeService';
import { useDealStore } from '../store/dealStore';
import type { Deal } from '../types';

const mk = (id: string, o: Partial<Deal> = {}): Deal => ({
  id, title: 'Acme renewal', company: 'Acme', contact: '', value: 1, stage: 'proposal', probability: 10, priority: 'low',
  createdAt: new Date(), updatedAt: new Date(), ...o,
});
const UUID = '11111111-1111-4111-8111-111111111111';

describe('duplicate detection', () => {
  beforeEach(() => { mockRpc.mockReset(); demo = true; });

  it('scores token similarity', () => {
    expect(similarity('Acme renewal 2026', 'renewal acme')).toBeGreaterThan(0.7);
    expect(similarity('abc', 'xyz')).toBe(0);
  });

  it('client-side: same title+company first, ignores deleted and excluded', () => {
    const deals = [mk('a'), mk('b', { title: 'Acme Renewal Q3', contactId: 'c1' }), mk('c', { deletedAt: new Date() }), mk('d', { title: 'Other', company: 'Zed' })];
    const out = findDuplicatesLocal({ title: 'acme renewal', company: 'ACME', excludeId: 'x' }, deals);
    expect(out.map(d => d.id)).toEqual(['a', 'b']);
    expect(out[0].reason).toBe('Same title and company');
    expect(findDuplicatesLocal({ title: 'acme renewal', company: 'Acme', excludeId: 'a' }, deals).map(d => d.id)).toEqual(['b']);
  });

  it('demo mode scans the store; remote mode calls find_duplicate_deals', async () => {
    useDealStore.setState({ deals: { a: mk('a') } });
    expect(await findDuplicateDeals({ title: 'Acme renewal', company: 'Acme' })).toHaveLength(1);
    expect(mockRpc).not.toHaveBeenCalled();
    demo = false;
    mockRpc.mockResolvedValue({ data: [{ id: UUID, title: 'T', company: 'C', value: '5', stage: 's', reason: 'same_title_company' }], error: null });
    const out = await findDuplicateDeals({ title: 'T', company: 'C', contactId: UUID });
    expect(mockRpc).toHaveBeenCalledWith('find_duplicate_deals', { p_title: 'T', p_company: 'C', p_contact_id: UUID, p_exclude: null });
    expect(out[0]).toMatchObject({ id: UUID, value: 5, reason: 'Same title and company' });
    mockRpc.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(findDuplicateDeals({ title: 'T' })).rejects.toThrow('boom');
  });
});

describe('per-field merge with custom fields', () => {
  const a = mk('a', { customFields: { tier: 'A', n: 1 }, company: 'Acme', companyId: 'c1', closeDate: new Date(2026, 0, 1) });
  const b = mk('b', { customFields: { tier: 'B', n: 1 }, company: 'Acme Inc', companyId: 'c2', closeDate: new Date(2026, 5, 1) });

  it('detects conflicts across core and custom fields', () => {
    expect(getConflicts([a, b])).toEqual(['company', 'closeDate', 'cf:tier']);
  });

  it('builds updates from choices (company also takes companyId, custom merged)', () => {
    const u = resolveMergeUpdates(a, [a, b], { company: 'b', 'cf:tier': 'b' });
    expect(u).toEqual({ company: 'Acme Inc', companyId: 'c2', customFields: { tier: 'B', n: 1 } });
    expect(resolveMergeUpdates(a, [a, b], {})).toEqual({});
  });

  it('sends chosen fields in p_fields of the single merge_deals call', async () => {
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ error: null });
    await mergeDeals({ keepId: 'a', mergeIds: ['b'], updates: { customFields: { tier: 'B' } } });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls[0][1]).toMatchObject({ keep: 'a', merge_ids: ['b'], p_fields: { custom_fields: { tier: 'B' } } });
  });
});
