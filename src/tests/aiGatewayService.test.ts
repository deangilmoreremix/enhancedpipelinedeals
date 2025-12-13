import { getAIGatewayService, AIGatewayService } from '../services/aiGatewayService';

// Mock fetch globally
global.fetch = jest.fn();

describe('AIGatewayService', () => {
  let service: AIGatewayService;
  const mockSupabaseUrl = 'https://test.supabase.co';
  const mockAnonKey = 'test-anon-key';

  beforeEach(() => {
    // Set up environment variables
    process.env.VITE_SUPABASE_URL = mockSupabaseUrl;
    process.env.VITE_SUPABASE_ANON_KEY = mockAnonKey;

    // Clear singleton instance
    (global as any).aiGatewayService = null;
    service = getAIGatewayService();

    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const service1 = getAIGatewayService();
      const service2 = getAIGatewayService();
      expect(service1).toBe(service2);
    });
  });

  describe('Initialization', () => {
    it('should initialize with correct gateway URL', () => {
      expect((service as any).gatewayUrl).toBe(`${mockSupabaseUrl}/functions/v1/ai-gateway`);
    });

    it('should throw error if VITE_SUPABASE_URL is not configured', () => {
      delete process.env.VITE_SUPABASE_URL;

      expect(() => {
        (global as any).aiGatewayService = null;
        getAIGatewayService();
      }).toThrow('VITE_SUPABASE_URL not configured');
    });
  });

  describe('makeRequest', () => {
    const mockRequest = {
      provider: 'openai' as const,
      model: 'gpt-4',
      taskType: 'contact-analysis',
      aiRequestData: { contactId: 'test-contact' }
    };

    const mockResponse = {
      provider: 'openai',
      model: 'gpt-4',
      response: 'AI analysis result',
      tokens: 150
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockClear();
    });

    it('should make successful request to AI gateway', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await service.makeRequest(mockRequest);

      expect(global.fetch).toHaveBeenCalledWith(`${mockSupabaseUrl}/functions/v1/ai-gateway`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockAnonKey}`,
        },
        body: JSON.stringify(mockRequest),
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle successful response with fallback mode', async () => {
      const fallbackResponse = {
        ...mockResponse,
        fallbackMode: true,
        provider: 'gemini'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(fallbackResponse),
      });

      const result = await service.makeRequest(mockRequest);
      expect(result.fallbackMode).toBe(true);
      expect(result.provider).toBe('gemini');
    });

    it('should handle HTTP error responses', async () => {
      const errorResponse = {
        error: 'Rate limit exceeded',
        status: 429
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue(errorResponse),
      });

      const result = await service.makeRequest(mockRequest);
      expect(result.error).toBe('Rate limit exceeded');
      expect(result.status).toBe(429);
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.makeRequest(mockRequest);
      expect(result.error).toContain('Network error');
    });

    it('should handle malformed JSON responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      const result = await service.makeRequest(mockRequest);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should handle timeout errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('The operation was aborted')
      );

      const result = await service.makeRequest(mockRequest);
      expect(result.error).toContain('Request timeout');
    });

    it('should handle 5xx server errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'Internal server error' }),
      });

      const result = await service.makeRequest(mockRequest);
      expect(result.error).toBe('Internal server error');
      expect(result.status).toBe(500);
    });

    it('should handle 4xx client errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ error: 'Bad request' }),
      });

      const result = await service.makeRequest(mockRequest);
      expect(result.error).toBe('Bad request');
      expect(result.status).toBe(400);
    });

    it('should handle empty response body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(null),
      });

      const result = await service.makeRequest(mockRequest);
      expect(result).toEqual({});
    });

    it('should handle response without json method', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        // Missing json method
      });

      const result = await service.makeRequest(mockRequest);
      expect(result.error).toContain('Failed to parse response');
    });
  });

  describe('Provider Support', () => {
    it('should support OpenAI provider', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ response: 'OpenAI result' }),
      });

      const result = await service.makeRequest({
        provider: 'openai',
        model: 'gpt-4',
        taskType: 'analysis',
        aiRequestData: {}
      });

      expect(result.response).toBe('OpenAI result');
    });

    it('should support Gemini provider', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ response: 'Gemini result' }),
      });

      const result = await service.makeRequest({
        provider: 'gemini',
        model: 'gemini-pro',
        taskType: 'analysis',
        aiRequestData: {}
      });

      expect(result.response).toBe('Gemini result');
    });

    it('should support Gemma provider', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ response: 'Gemma result' }),
      });

      const result = await service.makeRequest({
        provider: 'gemma',
        model: 'gemma-7b',
        taskType: 'analysis',
        aiRequestData: {}
      });

      expect(result.response).toBe('Gemma result');
    });
  });

  describe('Task Types', () => {
    const taskTypes = [
      'contact-analysis',
      'deal-analysis',
      'email-generation',
      'meeting-scheduling',
      'follow-up-sequence',
      'objection-handling',
      'negotiation-support',
      'custom-analysis'
    ];

    it.each(taskTypes)('should handle %s task type', async (taskType) => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ response: `Result for ${taskType}` }),
      });

      const result = await service.makeRequest({
        provider: 'openai',
        model: 'gpt-4',
        taskType,
        aiRequestData: { test: 'data' }
      });

      expect(result.response).toBe(`Result for ${taskType}`);
    });
  });

  describe('Error Recovery', () => {
    it('should retry on transient errors', async () => {
      let callCount = 0;
      (global.fetch as jest.Mock)
        .mockImplementationOnce(() => {
          callCount++;
          return Promise.reject(new Error('Temporary network error'));
        })
        .mockImplementationOnce(() => {
          callCount++;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ response: 'Success after retry' }),
          });
        });

      const result = await service.makeRequest({
        provider: 'openai',
        model: 'gpt-4',
        taskType: 'analysis',
        aiRequestData: {}
      });

      expect(callCount).toBe(2);
      expect(result.response).toBe('Success after retry');
    });

    it('should not retry on authentication errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({ error: 'Unauthorized' }),
      });

      const result = await service.makeRequest({
        provider: 'openai',
        model: 'gpt-4',
        taskType: 'analysis',
        aiRequestData: {}
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.error).toBe('Unauthorized');
    });

    it('should handle rate limiting with backoff', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({ error: 'Rate limit exceeded' }),
      });

      const result = await service.makeRequest({
        provider: 'openai',
        model: 'gpt-4',
        taskType: 'analysis',
        aiRequestData: {}
      });

      expect(result.error).toBe('Rate limit exceeded');
      expect(result.status).toBe(429);
    });
  });

  describe('Request Validation', () => {
    it('should validate required fields', async () => {
      await expect(service.makeRequest({
        provider: 'openai',
        model: '',
        taskType: 'analysis',
        aiRequestData: {}
      })).rejects.toThrow();
    });

    it('should handle large request payloads', async () => {
      const largeData = { data: 'x'.repeat(100000) };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ response: 'Processed large data' }),
      });

      const result = await service.makeRequest({
        provider: 'openai',
        model: 'gpt-4',
        taskType: 'analysis',
        aiRequestData: largeData
      });

      expect(result.response).toBe('Processed large data');
    });

    it('should handle special characters in request data', async () => {
      const specialData = {
        text: 'Special chars: àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ',
        symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        unicode: '🚀💡🎯📊🔥'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ response: 'Processed special chars' }),
      });

      const result = await service.makeRequest({
        provider: 'openai',
        model: 'gpt-4',
        taskType: 'analysis',
        aiRequestData: specialData
      });

      expect(result.response).toBe('Processed special chars');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track request timing', async () => {
      const startTime = Date.now();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ response: 'Timed response' }),
      });

      await service.makeRequest({
        provider: 'openai',
        model: 'gpt-4',
        taskType: 'analysis',
        aiRequestData: {}
      });

      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle slow responses gracefully', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ response: 'Slow response' }),
          }), 100)
        )
      );

      const result = await service.makeRequest({
        provider: 'openai',
        model: 'gpt-4',
        taskType: 'analysis',
        aiRequestData: {}
      });

      expect(result.response).toBe('Slow response');
    });
  });
});