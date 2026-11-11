const supa: any = { isConnectedToDatabase: jest.fn(() => true), createDeal: jest.fn(), updateDeal: jest.fn() };
jest.mock('../../services/supabaseService', () => ({ getSupabaseService: () => supa }));
jest.mock('../../config/demoMode', () => ({ isDemoMode: () => false }));

import { DataSyncService } from '../../services/dataSyncService';

const deal: any = { title: 'T', company: 'C', contact: 'x', value: 1, stage: 'qualification', probability: 1, priority: 'low' };

describe('DataSyncService.createDeal/updateDeal', () => {
  beforeEach(() => { jest.clearAllMocks(); supa.isConnectedToDatabase.mockReturnValue(true); });

  it('connected: DB failure is thrown, never a fake local deal', async () => {
    supa.createDeal.mockRejectedValue(new Error('boom'));
    await expect(new DataSyncService().createDeal(deal)).rejects.toThrow('boom');
  });

  it('connected: RLS 42501 maps to a permission message', async () => {
    supa.createDeal.mockRejectedValue({ code: '42501', message: 'new row violates row-level security policy' });
    await expect(new DataSyncService().createDeal(deal)).rejects.toThrow(/permission to create this deal/);
  });

  it('connected: update failure propagates', async () => {
    supa.updateDeal.mockRejectedValue({ code: '42501', message: 'x' });
    await expect(new DataSyncService().updateDeal('id', { title: 'n' })).rejects.toThrow(/permission to edit this deal/);
  });

  it('unconfigured: stores locally', async () => {
    supa.isConnectedToDatabase.mockReturnValue(false);
    const d = await new DataSyncService().createDeal(deal);
    expect(d.id).toMatch(/^deal-/);
    expect(supa.createDeal).not.toHaveBeenCalled();
  });
});
