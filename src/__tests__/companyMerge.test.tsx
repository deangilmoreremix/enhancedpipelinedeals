import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
let demo = false;
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { from: (...a: unknown[]) => mockFrom(...a), rpc: (...a: unknown[]) => mockRpc(...a), auth: { getSession: async () => ({ data: { session: null } }) } } }));
jest.mock('../services/supabaseService', () => ({
  getSupabaseService: () => ({}), isSupabaseConfigured: true,
  supabase: { from: (...a: unknown[]) => mockFrom(...a), rpc: (...a: unknown[]) => mockRpc(...a), auth: { getSession: async () => ({ data: { session: null } }) } },
}));
jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/pipelineStageService', () => ({ getStages: jest.fn(() => Promise.resolve([])), subscribe: jest.fn(() => () => {}), DEFAULT_STAGES: [] }));

import {
  MergeError, findDuplicateCompanies, mergeCompanies, normalizeDomain, planMerge, scanDuplicateCompanies,
} from '../services/companyMergeService';
import DuplicateCompaniesDialog, { DuplicateCompaniesDialog as Named } from '../components/companies/DuplicateCompaniesDialog';
import { __resetLocalCompanies, create as createCompany } from '../services/companyService';
import { useDealStore } from '../store/dealStore';
import type { Company } from '../types';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

const co = (o: Partial<Company> & { id: string; name: string }): Company => ({ createdAt: new Date(), updatedAt: new Date(), ...o });

/** Table-aware PostgREST double: records every call and answers by (table, first op). */
function mockTables(answer: (table: string, ops: Array<[string, unknown[]]>) => { data?: any; error?: any }) {
  const calls: Array<{ table: string; ops: Array<[string, unknown[]]> }> = [];
  mockFrom.mockImplementation((table: string) => {
    const rec = { table, ops: [] as Array<[string, unknown[]]> };
    calls.push(rec);
    const b: any = new Proxy({}, {
      get(_t, p: string) {
        if (p === 'then') return (res: any, rej: any) => Promise.resolve(answer(rec.table, rec.ops)).then(res, rej);
        return (...a: unknown[]) => { rec.ops.push([p, a]); return b; };
      },
    });
    return b;
  });
  return calls;
}
const op = (c: { ops: Array<[string, unknown[]]> }, name: string) => c.ops.find(o => o[0] === name)?.[1];

beforeEach(() => { demo = false; localStorage.clear(); mockFrom.mockReset(); mockRpc.mockReset(); __resetLocalCompanies(); });

describe('planMerge', () => {
  it('copies only missing fields (first donor wins) and merges custom values without overwriting', () => {
    const survivor = co({ id: A, name: 'Acme', industry: 'SaaS', customFields: { tier: 'A' } });
    const l1 = co({ id: B, name: 'ACME Inc', industry: 'Other', website: 'acme.com', phone: '', customFields: { tier: 'B', region: 'EU' } });
    const l2 = co({ id: C, name: 'Acme Co', website: 'acme.io', phone: '555', size: '50' });
    const { patch, filled } = planMerge(survivor, [l1, l2]);
    expect(patch).toEqual({ website: 'acme.com', phone: '555', size: '50', customFields: { tier: 'A', region: 'EU' } });
    expect(filled.sort()).toEqual(['customFields', 'phone', 'size', 'website']);
    expect(planMerge(co({ id: A, name: 'x', industry: 'i' }), [co({ id: B, name: 'y', industry: 'j' })]).patch).toEqual({});
  });
});

describe('duplicate detection (remote RPCs)', () => {
  it('find_duplicate_companies passes p_name / p_domain / p_exclude', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ id: B, name: 'Acme', domain: 'acme.com', reason: 'name' }], error: null });
    const hits = await findDuplicateCompanies('Acme', 'acme.com', A);
    expect(mockRpc).toHaveBeenCalledWith('find_duplicate_companies', { p_name: 'Acme', p_domain: 'acme.com', p_exclude: A });
    expect(hits).toEqual([{ id: B, name: 'Acme', domain: 'acme.com', reason: 'name' }]);
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    await findDuplicateCompanies('Acme', undefined, 'local-co-acme');
    expect(mockRpc).toHaveBeenLastCalledWith('find_duplicate_companies', { p_name: 'Acme', p_domain: null, p_exclude: null });
    expect(await findDuplicateCompanies('  ', '')).toEqual([]);
  });

  it('scan_duplicate_companies maps groups', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ group_key: 'name:acme', ids: [A, B], names: ['Acme', 'ACME'], reason: 'name' }], error: null });
    expect(await scanDuplicateCompanies()).toEqual([{ key: 'name:acme', ids: [A, B], names: ['Acme', 'ACME'], reason: 'name' }]);
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('rpc down') });
    await expect(scanDuplicateCompanies()).rejects.toThrow('rpc down');
  });

  it('normalises domains like SQL norm_domain', () => {
    expect(normalizeDomain('https://www.Acme.com/path?x=1')).toBe('acme.com');
    expect(normalizeDomain(null)).toBe('');
  });
});

describe('mergeCompanies (remote, client-side)', () => {
  const rows = [
    { id: A, name: 'Acme', industry: 'SaaS' },
    { id: B, name: 'Acme Inc', website: 'acme.com', custom_fields: { region: 'EU' } },
  ];

  it('repoints deals + contacts, fills missing fields, then soft-deletes the duplicates', async () => {
    const calls = mockTables((table, ops) => {
      const first = ops[0][0];
      if (table === 'companies' && first === 'select') return { data: rows, error: null };
      if (table === 'deals') return { data: [{ id: 'd1' }, { id: 'd2' }], error: null };
      if (table === 'contacts') return { data: [{ id: 'k1' }], error: null };
      if (table === 'companies' && first === 'update') return { data: [{ id: A }], error: null };
      return { data: [], error: null };
    });
    const res = await mergeCompanies(A, [B]);
    expect(res).toMatchObject({ survivorId: A, mergedIds: [B], relinkedDeals: 4, relinkedContacts: 2 }); // by id + by name
    expect(res.filled.sort()).toEqual(['customFields', 'website']);

    const dealUpdates = calls.filter(c => c.table === 'deals');
    expect(op(dealUpdates[0], 'update')).toEqual([{ company_id: A, company: 'Acme' }]);
    expect(op(dealUpdates[0], 'in')).toEqual(['company_id', [B]]);
    expect(op(dealUpdates[1], 'is')).toEqual(['company_id', null]);
    expect(calls.filter(c => c.table === 'contacts')).toHaveLength(2);

    const companyUpdates = calls.filter(c => c.table === 'companies' && c.ops[0][0] === 'update');
    expect(op(companyUpdates[0], 'update')![0]).toMatchObject({ website: 'acme.com', custom_fields: { region: 'EU' } });
    expect(op(companyUpdates[0], 'eq')).toEqual(['id', A]);
    const del = op(companyUpdates[1], 'update')![0] as any;
    expect(typeof del.deleted_at).toBe('string');
    expect(op(companyUpdates[1], 'in')).toEqual(['id', [B]]);
    // order: relink -> survivor patch -> soft delete
    const order = calls.map(c => `${c.table}:${c.ops[0][0]}`);
    expect(order.indexOf('deals:update')).toBeLessThan(order.lastIndexOf('companies:update'));
  });

  it('surfaces a zero-row soft delete (RLS) as a MergeError that explains the partial state', async () => {
    mockTables((table, ops) => {
      if (table === 'companies' && ops[0][0] === 'select') return { data: rows, error: null };
      if (table === 'companies' && ops[0][0] === 'update' && ops.some(o => o[0] === 'in')) return { data: [], error: null };
      return { data: [{ id: 'x' }], error: null };
    });
    const err = await mergeCompanies(A, [B]).catch(e => e);
    expect(err).toBeInstanceOf(MergeError);
    expect(err.message).toMatch(/No rows affected/);
    expect(err.message).toMatch(/run the merge again/);
  });

  it('propagates database errors and validates input', async () => {
    mockTables(() => ({ data: null, error: new Error('db down') }));
    await expect(mergeCompanies(A, [B])).rejects.toThrow('db down');
    await expect(mergeCompanies(A, [A])).rejects.toThrow('Pick at least one company');
    mockTables(() => ({ data: [{ id: B, name: 'Acme Inc' }], error: null }));
    await expect(mergeCompanies(A, [B])).rejects.toThrow('no longer exists');
  });
});

describe('local (demo) duplicates', () => {
  beforeEach(() => { demo = true; });

  it('scans by name / domain and merges: deals repointed, fields copied, duplicate removed', async () => {
    const keep = await createCompany('Acme Inc', { domain: 'acme.com' });
    const dupe = await createCompany('Acme Corp', { domain: 'www.acme.com', phone: '555' });
    await createCompany('Unrelated');
    const updateDeal = jest.fn(async () => ({}));
    useDealStore.setState({
      deals: { d1: { id: 'd1', company: 'Acme Corp', companyId: dupe.id, title: 'x', contact: '', value: 1, stage: 's', probability: 1, priority: 'low', createdAt: new Date(), updatedAt: new Date() } as any },
      updateDeal,
    } as any);
    const groups = await scanDuplicateCompanies();
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ reason: 'domain', names: expect.arrayContaining(['Acme Inc', 'Acme Corp']) });
    const res = await mergeCompanies(keep.id, [dupe.id]);
    expect(res).toMatchObject({ relinkedDeals: 1, filled: ['phone'] });
    expect(updateDeal).toHaveBeenCalledWith('d1', expect.objectContaining({ company: 'Acme Inc' }));
    expect(await scanDuplicateCompanies()).toEqual([]);
    expect(await findDuplicateCompanies('acme inc', null, 'nope')).toHaveLength(1);
  });
});

describe('DuplicateCompaniesDialog', () => {
  it('has named + default exports', () => { expect(Named).toBe(DuplicateCompaniesDialog); });

  it('lists groups, lets the user pick the survivor and merges after a confirm step', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ group_key: 'name:acme', ids: [A, B], names: ['Acme', 'ACME Inc'], reason: 'name' }], error: null });
    mockRpc.mockResolvedValue({ data: [], error: null }); // rescan after merge
    const calls = mockTables((table, ops) => {
      if (table === 'companies' && ops[0][0] === 'select') return { data: [{ id: A, name: 'Acme' }, { id: B, name: 'ACME Inc' }], error: null };
      return { data: [{ id: 'x' }], error: null };
    });
    const onMerged = jest.fn();
    render(<MemoryRouter><DuplicateCompaniesDialog isOpen onClose={jest.fn()} onMerged={onMerged} /></MemoryRouter>);
    const group = await screen.findByTestId('duplicate-group');
    expect(within(group).getByText('Same name')).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('radio', { name: 'Keep ACME Inc' }));
    fireEvent.click(within(group).getByRole('button', { name: /Merge into selected/ }));
    // nothing happens until confirmed
    expect(calls.filter(c => c.table === 'deals')).toHaveLength(0);
    expect(within(group).getByRole('alert')).toHaveTextContent(/Merge 1 duplicate into ACME Inc/);
    fireEvent.click(within(group).getByRole('button', { name: 'Confirm merge' }));
    await waitFor(() => expect(onMerged).toHaveBeenCalledWith(expect.objectContaining({ survivorId: B, mergedIds: [A] })));
    expect(op(calls.find(c => c.table === 'deals')!, 'update')).toEqual([{ company_id: B, company: 'ACME Inc' }]);
    expect(await screen.findByText(/No duplicate companies found/)).toBeInTheDocument();
  });

  it('shows scan failures', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('scan broke') });
    render(<MemoryRouter><DuplicateCompaniesDialog isOpen onClose={jest.fn()} /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('scan broke');
  });
});
