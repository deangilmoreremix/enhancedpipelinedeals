jest.mock('../services/supabaseService', () => ({
  isSupabaseConfigured: false,
  getSupabaseService: () => ({ isConnectedToDatabase: () => false }),
}));

import { getDataSyncService } from '../services/dataSyncService';
import { mockDeals } from '../data/mockDeals';

describe('delete / restore demo data', () => {
  beforeEach(() => { localStorage.clear(); getDataSyncService().restoreDemoData(); });

  it('serves the bundled demo deals by default', async () => {
    const r = await getDataSyncService().getDeals();
    expect(Object.keys(r.data).length).toBe(Object.keys(mockDeals).length);
  });

  it('hides the demo deals and contacts without touching the bundled mock data, then restores them', async () => {
    const svc = getDataSyncService();
    const before = Object.keys(mockDeals).length;
    svc.hideDemoData();
    expect(svc.isDemoDataHidden()).toBe(true);
    expect(Object.keys((await svc.getDeals()).data)).toHaveLength(0);
    expect((await svc.getContacts()).data).toHaveLength(0);
    expect(Object.keys(mockDeals)).toHaveLength(before); // bundled data untouched

    svc.restoreDemoData();
    expect(svc.isDemoDataHidden()).toBe(false);
    expect(Object.keys((await svc.getDeals()).data)).toHaveLength(before);
  });
});
