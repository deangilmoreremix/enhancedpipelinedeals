import React from 'react';
import { act, renderHook } from '@testing-library/react';

const mockRpc = jest.fn();
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: jest.fn(), auth: { getSession: async () => ({ data: { session: null } }) } } }));
jest.mock('../services/supabaseService', () => ({
  getSupabaseService: () => ({}), isSupabaseConfigured: true,
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: jest.fn(), auth: { getSession: async () => ({ data: { session: null } }) } },
}));
jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({}) }));
jest.mock('../services/pipelineStageService', () => ({ getStages: jest.fn(() => Promise.resolve([])), subscribe: jest.fn(() => () => {}), DEFAULT_STAGES: [] }));
const mockSave = jest.fn();
jest.mock('../services/customFieldService', () => ({
  ...jest.requireActual<object>('../services/customFieldService'),
  saveRecordValues: (...a: unknown[]) => mockSave(...a),
}));

import { fetchCompanyRollups, localRollup, rollupForCompany, rollupFromRow, rollupValuesForDefs, metricValue } from '../services/companyRollupService';
import { useRecordCustomValues } from '../components/deals/fields/useRecordCustomValues';

const A = '11111111-1111-4111-8111-111111111111';

describe('company rollups', () => {
  beforeEach(() => mockRpc.mockReset());

  it('calls company_rollups with p_company_ids and maps every metric', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ company_id: A, open_deal_count: 2, open_deal_value: '7500.5', won_deal_value: 100, contact_count: 3, last_activity: '2026-05-01T00:00:00Z' }], error: null });
    const map = await fetchCompanyRollups([A]);
    expect(mockRpc).toHaveBeenCalledWith('company_rollups', { p_company_ids: [A] });
    expect(map.get(A)).toEqual({ companyId: A, openDealCount: 2, openDealValue: 7500.5, wonDealValue: 100, contactCount: 3, lastActivity: '2026-05-01T00:00:00Z' });
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('rpc failed') });
    await expect(fetchCompanyRollups(null)).rejects.toThrow('rpc failed');
    expect(mockRpc).toHaveBeenLastCalledWith('company_rollups', { p_company_ids: null });
  });

  it('rollupForCompany uses the RPC for remote companies and the local numbers otherwise', async () => {
    const local = () => localRollup('x', [], [], []);
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await rollupForCompany(A, local, true)).toMatchObject({ companyId: A === A ? 'x' : '', openDealCount: 0, contactCount: 0 });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    mockRpc.mockClear();
    await rollupForCompany('local-co-acme', local, true);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('metricValue / rollupValuesForDefs pick the configured metric', () => {
    const r = rollupFromRow({ company_id: A, open_deal_count: 1, open_deal_value: 10, won_deal_value: 20, contact_count: 4, last_activity: null });
    expect(metricValue(r, 'contact_count')).toBe(4);
    expect(metricValue(r, 'last_activity')).toBeNull();
    expect(rollupValuesForDefs([
      { key: 'w', type: 'rollup', config: { metric: 'won_deal_value' } }, { key: 'plain', type: 'text' },
    ], r)).toEqual({ w: 20 });
  });
});

describe('useRecordCustomValues (optimistic with rollback)', () => {
  beforeEach(() => mockSave.mockReset());

  it('applies the value immediately, persists, then reports to the store', async () => {
    mockSave.mockResolvedValue(undefined);
    const onPersisted = jest.fn();
    const { result } = renderHook(() => useRecordCustomValues('contact', A, { customFields: { a: 1 } }, onPersisted));
    expect(result.current.values).toEqual({ a: 1 });
    await act(async () => { await result.current.save({ a: 1, b: 'x' }); });
    expect(result.current.values).toEqual({ a: 1, b: 'x' });
    expect(mockSave).toHaveBeenCalledWith('contact', A, { a: 1, b: 'x' });
    expect(onPersisted).toHaveBeenCalledWith({ a: 1, b: 'x' });
  });

  it('rolls back and rethrows when the write fails', async () => {
    mockSave.mockRejectedValue(new Error('No rows affected'));
    const onPersisted = jest.fn();
    const { result } = renderHook(() => useRecordCustomValues('company', A, { customFields: { a: 1 } }, onPersisted));
    let thrown: unknown;
    await act(async () => { try { await result.current.save({ a: 2 }); } catch (e) { thrown = e; } });
    expect((thrown as Error).message).toBe('No rows affected');
    expect(result.current.values).toEqual({ a: 1 });
    expect(onPersisted).not.toHaveBeenCalled();
  });
});
