import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const rpc = jest.fn<(fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>();
const from = jest.fn();
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));
jest.mock('../services/supabaseService', () => ({ supabase: { rpc: (...a: [string, Record<string, unknown>]) => rpc(...a), from: (...a: unknown[]) => from(...a) }, isSupabaseConfigured: true }));

import { getLiveMeta, getWebhook, listWorkflowWebhooks, setWebhook } from '../services/workflowVersionService';

const chain = (data: unknown) => {
  const c: any = { select: jest.fn(() => c), eq: jest.fn(() => c), order: jest.fn(() => Promise.resolve({ data, error: null })), maybeSingle: jest.fn(() => Promise.resolve({ data, error: null })) };
  return c;
};

describe('workflow webhook token handling (remote mode)', () => {
  beforeEach(() => { rpc.mockReset(); from.mockReset(); });

  it('never selects webhook_token from deal_workflows', async () => {
    const c1 = chain({ name: 'W', webhook_enabled: true });
    from.mockReturnValueOnce(c1);
    await getLiveMeta('w1');
    const c2 = chain([{ id: 'w1', name: 'W', webhook_enabled: true }]);
    from.mockReturnValueOnce(c2);
    const rows = await listWorkflowWebhooks();
    expect(rows).toEqual([{ id: 'w1', name: 'W', webhook_enabled: true }]);
    for (const c of [c1, c2]) for (const [cols] of c.select.mock.calls) expect(String(cols)).not.toMatch(/token/);
  });

  it('getWebhook reads through the get_workflow_webhook RPC', async () => {
    rpc.mockResolvedValueOnce({ data: [{ token: 'abc', enabled: true }], error: null });
    expect(await getWebhook('w1')).toEqual({ token: 'abc', enabled: true });
    expect(rpc).toHaveBeenCalledWith('get_workflow_webhook', { p_workflow_id: 'w1' });
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await getWebhook('w1')).toEqual({ token: null, enabled: false });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'denied', code: '42501' } });
    await expect(getWebhook('w1')).rejects.toBeTruthy();
  });

  it('setWebhook uses the rotate RPC: token when enabling, null when disabling', async () => {
    rpc.mockResolvedValueOnce({ data: 'newtok', error: null });
    expect(await setWebhook('w1', true)).toBe('newtok');
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await setWebhook('w1', false)).toBeNull();
    expect(rpc).toHaveBeenLastCalledWith('rotate_workflow_webhook_token', { p_workflow_id: 'w1', p_enable: false });
  });
});
