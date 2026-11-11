import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
jest.mock('../services/supabaseService', () => ({ getSupabaseService: () => ({}), supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/pipelineStageService', () => ({ getStages: jest.fn(() => Promise.resolve([])), subscribe: jest.fn(() => () => {}), DEFAULT_STAGES: [] }));

import { useCompanyStore } from '../store/companyStore';
import { __resetLocalCompanies } from '../services/companyService';
import { useDealStore } from '../store/dealStore';
import { useContactStore } from '../store/contactStore';

describe('companyStore', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetLocalCompanies();
    useCompanyStore.setState({ companies: {} });
    useDealStore.setState({ deals: {} });
    useContactStore.setState({ contacts: [] });
  });

  it('create-on-type stores the company and makes it searchable', async () => {
    const c = await useCompanyStore.getState().create('Brand New Co');
    expect(useCompanyStore.getState().companies[c.id].name).toBe('Brand New Co');
    const found = await useCompanyStore.getState().search('brand');
    expect(found.map(x => x.id)).toEqual([c.id]);
  });

  it('getById caches and update is optimistic and persisted', async () => {
    const c = await useCompanyStore.getState().create('Foo');
    useCompanyStore.setState({ companies: {} });
    expect((await useCompanyStore.getState().getById(c.id))?.name).toBe('Foo');
    const p = useCompanyStore.getState().update(c.id, { industry: 'Energy' });
    expect(useCompanyStore.getState().companies[c.id].industry).toBe('Energy');
    await p;
    expect((await useCompanyStore.getState().getById(c.id))?.industry).toBe('Energy');
  });

  it('update of an unknown company rejects', async () => {
    await expect(useCompanyStore.getState().update('missing', { industry: 'x' })).rejects.toThrow();
  });

  it('listRelated returns the company deals and contacts', async () => {
    const c = await useCompanyStore.getState().create('Acme');
    useDealStore.setState({ deals: { d: { id: 'd', company: 'Acme', companyId: c.id, contact: '', value: 1, stage: 's', probability: 0, priority: 'low', createdAt: new Date(), updatedAt: new Date() } } });
    useContactStore.setState({ contacts: [{ id: 'k', name: 'K', company: 'acme' } as any] });
    const rel = await useCompanyStore.getState().listRelated(c.id);
    expect(rel.deals.map(d => d.id)).toEqual(['d']);
    expect(rel.contacts.map(x => x.id)).toEqual(['k']);
  });
});
