import { chain } from '../../test-utils/chain';
jest.mock('../../lib/core/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: {} }));
jest.mock('../../services/supabaseService', () => ({ isSupabaseConfigured: true, supabase: {} }));
jest.mock('../../store/dealStore', () => ({ useDealStore: { getState: () => ({ deals: {} }) } }));

import { dealFromRow } from '../../services/dealMapper';
import { isOwnRecord, can } from '../../services/permissionService';
import { unionDeals } from '../../services/dealSearchService';

describe('Deal ownership fields', () => {
  it('maps created_by / workspace_id', () => {
    const d = dealFromRow({ id: '1', created_by: 'u1', workspace_id: 'w1' });
    expect(d.createdBy).toBe('u1');
    expect(d.workspaceId).toBe('w1');
  });
  it('isOwnRecord uses createdBy and the workspace', () => {
    const d = dealFromRow({ id: '1', created_by: 'u1', workspace_id: 'w1' });
    expect(isOwnRecord('u1', d)).toBe(true);
    expect(isOwnRecord('u1', d, 'w1')).toBe(true);
    expect(isOwnRecord('u1', d, 'w2')).toBe(false);
    const ctx = { user: { id: 'u2', role: 'member' as const }, rlsMode: 'workspace' as const, demo: false };
    expect(can(ctx, 'edit', 'deal', d).allowed).toBe(false);
  });
});

describe('searchDeals union', () => {
  it('keeps RPC hits first, adds Fuse hits, de-duplicates', () => {
    const mk = (id: string) => ({ id } as any);
    expect(unionDeals([mk('a'), mk('b')], [mk('b'), mk('c')], 10).map(d => d.id)).toEqual(['a', 'b', 'c']);
    expect(unionDeals([mk('a')], [mk('b'), mk('c')], 2).map(d => d.id)).toEqual(['a', 'b']);
  });
});

describe('workflowTriggerService realtime', () => {
  it('only subscribes in demo/local mode', () => {
    jest.resetModules();
    const channel = jest.fn();
    jest.doMock('../../services/supabaseService', () => ({ isSupabaseConfigured: true, supabase: { channel } }));
    jest.doMock('../../services/enhancedWorkflowService', () => ({ enhancedWorkflowService: {} }));
    jest.doMock('../../config/demoMode', () => ({ isDemoMode: () => false }));
    const { WorkflowTriggerService } = require('../../services/workflowTriggerService');
    WorkflowTriggerService.getInstance().startRealtimeEvents();
    expect(channel).not.toHaveBeenCalled();
  });
});

describe('authHeader anon fallback', () => {
  it('does not fall back to the anon key in connected mode', async () => {
    jest.resetModules();
    jest.doMock('../../lib/core/supabaseClient', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
    jest.doMock('../../config/demoMode', () => ({ isDemoMode: () => false }));
    const { authHeader } = require('../../services/aiClient');
    expect(await authHeader()).toEqual({});
  });
});

describe('enhancedActivityService', () => {
  it('writes deal activities to deal_activities and never calls the get_deal_activities RPC', async () => {
    jest.resetModules();
    const tables: string[] = [];
    const rpc = jest.fn();
    jest.doMock('../../services/supabaseService', () => ({
      isSupabaseConfigured: true,
      supabase: {
        rpc,
        from: (t: string) => { tables.push(t); return chain({ data: [{ id: 'a', deal_id: 'd', type: 'call', title: 'T', metadata: {}, created_at: 'x' }], error: null }); },
      },
    }));
    jest.doMock('../../services/dealRecordShared', () => ({ getCurrentUserId: async () => null, isUuid: () => false }));
    const { enhancedActivityService } = require('../../services/enhancedActivityService');
    const a = await enhancedActivityService.createActivity({ dealId: 'd', activityType: 'call', title: 'T' });
    expect(a.activityType).toBe('call');
    await enhancedActivityService.getActivitiesForDeal('d');
    expect(tables[0]).toBe('deal_activities');
    expect(rpc).not.toHaveBeenCalled();
  });
});
