const mockRpc = jest.fn();
jest.mock('../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), auth: { getSession: async () => ({ data: { session: null } }) } },
}));
let demo = false;
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));

import { purgeDealsRemote, restoreDealsRemote, isPurgeConfirmed } from '../services/dealTrashService';
import { cloneDealRemote, buildCloneDraft } from '../services/dealCloneService';
import { useDealStore } from '../store/dealStore';
import { listNotes, createNote } from '../services/dealNotesService';
import type { Deal } from '../types';

const U1 = '11111111-1111-4111-8111-111111111111';
const mk = (id: string, o: Partial<Deal> = {}): Deal => ({
  id, title: 'Acme', company: 'Acme', contact: '', value: 5, stage: 'proposal', probability: 10, priority: 'low',
  createdAt: new Date(), updatedAt: new Date(), customFields: { tier: 'A' }, isFavorite: true, ...o,
});

describe('trash / clone services', () => {
  beforeEach(() => { mockRpc.mockReset(); demo = false; });

  it('purge/restore call the RPCs and treat 0 as blocked', async () => {
    mockRpc.mockResolvedValue({ data: 2, error: null });
    expect(await purgeDealsRemote([U1, 'x'])).toBe(2);
    expect(mockRpc).toHaveBeenCalledWith('purge_deals', { p_ids: [U1, 'x'] });
    expect(await restoreDealsRemote([U1])).toBe(2);
    mockRpc.mockResolvedValue({ data: 0, error: null });
    await expect(purgeDealsRemote([U1])).rejects.toThrow(/No rows affected/);
    mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });
    await expect(restoreDealsRemote([U1])).rejects.toMatchObject({ code: '42501' });
  });

  it('typed confirmation', () => {
    expect(isPurgeConfirmed(' delete ')).toBe(true);
    expect(isPurgeConfirmed('del')).toBe(false);
  });

  it('clone_deal returns the new id; draft strips identity', async () => {
    mockRpc.mockResolvedValue({ data: 'new-id', error: null });
    expect(await cloneDealRemote(U1, true)).toBe('new-id');
    expect(mockRpc).toHaveBeenCalledWith('clone_deal', { p_id: U1, p_include_related: true });
    const draft = buildCloneDraft(mk('a', { createdBy: 'u' }));
    expect(draft).toMatchObject({ title: 'Acme (copy)', customFields: { tier: 'A' } });
    expect(draft).not.toHaveProperty('id');
    expect(draft).not.toHaveProperty('isFavorite');
    expect(draft).not.toHaveProperty('createdBy');
  });
});

describe('dealStore actions', () => {
  beforeEach(() => { mockRpc.mockReset(); demo = true; useDealStore.setState({ deals: {}, trash: {} }); });

  it('cloneDeal (demo) copies the deal and optionally its notes', async () => {
    useDealStore.setState({ deals: { 'deal-1': mk('deal-1') } });
    await createNote('deal-1', { body: null, bodyText: 'hello' });
    const id = await useDealStore.getState().cloneDeal('deal-1', { includeRelated: true });
    const copy = useDealStore.getState().deals[id];
    expect(copy.title).toBe('Acme (copy)');
    expect((await listNotes(id)).map(n => n.bodyText)).toEqual(['hello']);
    const id2 = await useDealStore.getState().cloneDeal('deal-1');
    expect(await listNotes(id2)).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('purgeDeals / restoreDeals work on the local trash in demo mode', async () => {
    useDealStore.setState({ trash: { a: mk('a', { deletedAt: new Date() }), b: mk('b', { deletedAt: new Date() }) } });
    expect(await useDealStore.getState().restoreDeals(['a'])).toBe(1);
    expect(useDealStore.getState().deals.a).toBeDefined();
    expect(await useDealStore.getState().purgeDeals(['b'])).toBe(1);
    expect(useDealStore.getState().trash).toEqual({});
  });

  it('remote ids go through the RPCs', async () => {
    demo = false;
    useDealStore.setState({ trash: { [U1]: mk(U1, { deletedAt: new Date() }) } });
    mockRpc.mockResolvedValue({ data: 1, error: null });
    expect(await useDealStore.getState().purgeDeals([U1])).toBe(1);
    expect(mockRpc).toHaveBeenCalledWith('purge_deals', { p_ids: [U1] });
    expect(useDealStore.getState().trash).toEqual({});
  });
});
