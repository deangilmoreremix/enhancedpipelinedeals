import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const state = { demo: true };
jest.mock('../config/demoMode', () => ({ isDemoMode: () => state.demo }));

type Result = { data: any; error: any };
const calls: Array<{ op: string; args: any[] }> = [];
let result: Result = { data: [], error: null };
const queue: Result[] = []; // sequential responses (falls back to `result`)
const builder: any = new Proxy({}, {
  get: (_t, prop: string) => {
    if (prop === 'then') return (res: any, rej: any) => Promise.resolve(queue.length ? queue.shift() : result).then(res, rej);
    return (...args: any[]) => { calls.push({ op: prop, args }); return builder; };
  },
});
jest.mock('../services/supabaseService', () => ({
  getSupabaseService: () => ({}),
  isSupabaseConfigured: true,
  supabase: { from: (t: string) => { calls.push({ op: 'from', args: [t] }); return builder; } },
}));
jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/pipelineStageService', () => ({ getStages: jest.fn(() => Promise.resolve([])), subscribe: jest.fn(() => () => {}), DEFAULT_STAGES: [] }));

import * as svc from '../services/companyService';
import { useDealStore } from '../store/dealStore';
import { useContactStore } from '../store/contactStore';
import type { Deal } from '../types';

const deal = (id: string, company: string, extra: Partial<Deal> = {}): Deal => ({
  id, company, contact: '', value: 100, stage: 'a', probability: 50, priority: 'medium', createdAt: new Date(), updatedAt: new Date(), ...extra,
});

describe('companyService (local / demo)', () => {
  beforeEach(() => {
    state.demo = true;
    calls.length = 0;
    localStorage.clear();
    svc.__resetLocalCompanies();
    useDealStore.setState({ deals: { d1: deal('d1', 'Acme Inc'), d2: deal('d2', 'acme inc'), d3: deal('d3', 'Globex') } });
    useContactStore.setState({ contacts: [{ id: 'c1', name: 'Jane', company: 'Initech' } as any] });
  });

  it('derives companies from deal/contact names (case-insensitive, deduped)', async () => {
    const all = await svc.search('');
    expect(all.map(c => c.name).sort()).toEqual(['Acme Inc', 'Globex', 'Initech']);
    expect((await svc.search('glo')).map(c => c.name)).toEqual(['Globex']);
  });

  it('create persists to localStorage, reuses same-named companies and rejects blanks', async () => {
    const c = await svc.create('  NewCo ', { industry: 'SaaS' });
    expect(c.name).toBe('NewCo');
    expect(JSON.parse(localStorage.getItem('crm_companies_v1') as string)[0].industry).toBe('SaaS');
    expect((await svc.create('newco')).id).toBe(c.id);
    await expect(svc.create('   ')).rejects.toThrow(/required/);
  });

  it('update changes a stored company and getById finds it', async () => {
    const c = await svc.create('Foo');
    const u = await svc.update(c.id, { website: 'foo.com' });
    expect(u.website).toBe('foo.com');
    expect((await svc.getById(c.id))?.website).toBe('foo.com');
    expect(await svc.getById('nope')).toBeNull();
  });

  it('update of a derived company materialises it', async () => {
    const [globex] = await svc.search('globex');
    await svc.update(globex.id, { industry: 'Logistics' });
    expect((await svc.getById(globex.id))?.industry).toBe('Logistics');
  });

  it('listRelated matches deals by id or name and contacts by name', async () => {
    const [acme] = await svc.search('acme');
    const rel = await svc.listRelated(acme.id);
    expect(rel.deals.map(d => d.id).sort()).toEqual(['d1', 'd2']);
    const [initech] = await svc.search('initech');
    expect((await svc.listRelated(initech.id)).contacts.map(c => c.id)).toEqual(['c1']);
  });

  it('companyTotals uses stage flags, not literals', () => {
    const stages = [
      { key: 'a', isWon: false, isLost: false }, { key: 'w', isWon: true, isLost: false }, { key: 'l', isWon: false, isLost: true },
    ];
    const t = svc.companyTotals([
      deal('1', 'x', { stage: 'a', value: 100, probability: 50 }),
      deal('2', 'x', { stage: 'w', value: 300 }),
      deal('3', 'x', { stage: 'l', value: 900 }),
    ], stages);
    expect(t).toEqual({ deals: 3, openValue: 100, weightedValue: 50, wonValue: 300 });
  });

  it('row mapping round-trips', () => {
    const c = svc.companyFromRow({ id: '1', name: 'A', logo_url: 'u', revenue: '5', owner_id: 'o' });
    expect(c).toMatchObject({ logoUrl: 'u', revenue: 5, ownerId: 'o' });
    expect(svc.companyToRow({ name: 'A', logoUrl: 'u' })).toEqual({ name: 'A', logo_url: 'u' });
  });
});

describe('companyService (supabase)', () => {
  beforeEach(() => { state.demo = false; calls.length = 0; queue.length = 0; svc.__resetLocalCompanies(); localStorage.clear(); });

  it('searches with ilike and maps rows', async () => {
    result = { data: [{ id: 'u1', name: 'Acme', created_at: '2026-01-01T00:00:00Z' }], error: null };
    const list = await svc.search('ac');
    expect(list[0]).toMatchObject({ id: 'u1', name: 'Acme' });
    expect(calls.find(c => c.op === 'ilike')?.args).toEqual(['name', '%ac%']);
  });

  it('creates through insert after a duplicate check', async () => {
    queue.push({ data: [], error: null }, { data: { id: 'new', name: 'Zed' }, error: null });
    const c = await svc.create('Zed', { industry: 'X' });
    expect(c).toMatchObject({ id: 'new', name: 'Zed' });
    expect(calls.find(x => x.op === 'insert')?.args[0]).toEqual({ name: 'Zed', industry: 'X' });
  });

  it('falls back to the local list when the query errors', async () => {
    result = { data: null, error: { message: 'boom' } };
    useDealStore.setState({ deals: { d: deal('d', 'Fallback Co') } });
    const list = await svc.search('fall');
    expect(list.map(c => c.name)).toEqual(['Fallback Co']);
  });
});
