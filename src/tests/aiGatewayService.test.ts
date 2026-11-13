import { getAIGatewayService } from '../services/aiGatewayService';
import { callAI } from '../services/aiClient';

jest.mock('../services/aiClient', () => {
  class AIGatewayError extends Error {
    constructor(message: string, public status?: number) {
      super(message);
    }
  }
  return { callAI: jest.fn(), AIGatewayError };
});

const mockCall = callAI as jest.Mock;

describe('AIGatewayService (Responses gateway client)', () => {
  beforeEach(() => mockCall.mockReset());

  it('is a singleton', () => {
    expect(getAIGatewayService()).toBe(getAIGatewayService());
  });

  it('routes requests through callAI and returns text + choices shim', async () => {
    mockCall.mockResolvedValue({ ok: true, text: 'hello', data: null, model: 'gpt-6.1-sol' });
    const svc = getAIGatewayService();
    const res = await svc.makeRequest(
      svc.createOpenAIRequest([{ role: 'user', content: 'hi' }], 'gpt-6.1-sol', 'chat'),
    );
    expect(mockCall).toHaveBeenCalledWith('chat', expect.objectContaining({ tier: 'default' }));
    expect(res.output_text).toBe('hello');
    expect(res.choices?.[0].message.content).toBe('hello');
  });

  it('returns a fallback error instead of throwing', async () => {
    mockCall.mockRejectedValue(new Error('boom'));
    const res = await getAIGatewayService().makeRequest({
      provider: 'openai', model: 'x', taskType: 'chat', aiRequestData: { messages: [] },
    });
    expect(res.fallbackMode).toBe(true);
    expect(res.error).toContain('boom');
  });

  it('health check reports healthy when gateway responds', async () => {
    mockCall.mockResolvedValue({ ok: true, text: 'pong' });
    expect((await getAIGatewayService().healthCheck()).status).toBe('healthy');
  });
});
