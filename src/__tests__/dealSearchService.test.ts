const rpc = jest.fn();
let configured = false;
let demo = true;
jest.mock('../services/supabaseService', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
  get isSupabaseConfigured() { return configured; }
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));
jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({}) }));
jest.mock('../services/pipelineStageService', () => ({ getStages: jest.fn(), subscribe: jest.fn(() => () => undefined), DEFAULT_STAGES: [] }));

import type { Deal } from '../types';
import { fuzzySearchDeals, searchDeals } from '../services/dealSearchService';
import { useDealStore } from '../store/dealStore';

const mk = (id: string, over: Partial<Deal>): Deal => ({
  id, company: '', contact: '', value: 1, stage: 'lead', probability: 10, priority: 'medium',
  createdAt: new Date(), updatedAt: new Date(), ...over
});
const DEALS = [
  mk('a', { title: 'Website redesign', company: 'Globex Corporation', contact: 'Hank Scorpio', tags: ['web'] }),
  mk('b', { title: 'Annual support plan', company: 'Initech', contact: 'Bill Lumbergh', notes: 'Renewal in March' }),
  mk('c', { title: 'Data migration', company: 'Acme Inc', contact: 'Wile Coyote' })
];

describe('dealSearchService', () => {
  beforeEach(() => {
    rpc.mockReset();
    configured = false;
    demo = true;
    useDealStore.setState({ deals: Object.fromEntries(DEALS.map(d => [d.id, d])) });
  });

  it('falls back to Fuse.js over store deals when Supabase is not configured', async () => {
    const hits = await searchDeals('globex');
    expect(hits.map(d => d.id)).toEqual(['a']);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('is typo tolerant and searches title, company, contact, notes and tags', () => {
    expect(fuzzySearchDeals('globx', DEALS).map(d => d.id)).toEqual(['a']);
    expect(fuzzySearchDeals('Lumbergh', DEALS).map(d => d.id)).toEqual(['b']);
    expect(fuzzySearchDeals('renewal', DEALS).map(d => d.id)).toEqual(['b']);
    expect(fuzzySearchDeals('web', DEALS)[0].id).toBe('a');
    expect(fuzzySearchDeals('zzzzqq', DEALS)).toEqual([]);
    expect(fuzzySearchDeals('   ', DEALS)).toEqual([]);
  });

  it('weights title above notes', () => {
    const pool = [mk('n', { title: 'Other', notes: 'migration plan' }), mk('t', { title: 'Migration', notes: '' })];
    expect(fuzzySearchDeals('migration', pool)[0].id).toBe('t');
  });

  it('uses a provided pool instead of the store', async () => {
    const hits = await searchDeals('initech', 10, [DEALS[1]]);
    expect(hits.map(d => d.id)).toEqual(['b']);
    expect(await searchDeals('globex', 10, [DEALS[1]])).toEqual([]);
  });

  it('calls the search_deals RPC with a live database and maps rows', async () => {
    configured = true;
    demo = false;
    rpc.mockResolvedValue({ data: [{ id: 'row-1', title: 'From DB', company: 'DB Co', contact: 'X', value: 5, stage: 'lead', probability: 10, priority: 'high', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }], error: null });
    const hits = await searchDeals('db', 15);
    expect(rpc).toHaveBeenCalledWith('search_deals', { q: 'db', lim: 15 });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ id: 'row-1', title: 'From DB', company: 'DB Co' });
  });

  it('falls back to Fuse when the RPC errors or finds nothing', async () => {
    configured = true;
    demo = false;
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect((await searchDeals('acme')).map(d => d.id)).toEqual(['c']);
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect((await searchDeals('acm')).map(d => d.id)).toEqual(['c']);
    rpc.mockRejectedValueOnce(new Error('network'));
    expect((await searchDeals('initech')).map(d => d.id)).toEqual(['b']);
  });
});
