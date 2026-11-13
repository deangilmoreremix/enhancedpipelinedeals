/** Regression (e2e A): in demo mode workflow services queried the placeholder Supabase URL and logged errors. */
const from = jest.fn(() => { throw new Error('must not query supabase in demo mode'); });
jest.mock('../../services/supabaseService', () => ({ supabase: { from: (...a: any[]) => (from as any)(...a) }, isSupabaseConfigured: false }));
jest.mock('../../services/workflowExecutionEngine', () => ({ workflowExecutionEngine: {} }));

describe('workflow services in demo mode', () => {
  it('getWebhookConfigs returns [] without querying', async () => {
    const { enhancedWorkflowService } = require('../../services/enhancedWorkflowService');
    await expect(enhancedWorkflowService.getWebhookConfigs()).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});
