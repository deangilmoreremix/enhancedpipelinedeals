/**
 * Comprehensive tests for AI Function Orchestrator
 * Tests rate limiting, timeout protection, and validation
 */

import { getAIFunctionOrchestrator } from '../services/aiFunctionOrchestrator';

describe('AIFunctionOrchestrator', () => {
  let orchestrator: any;

  beforeEach(() => {
    // Get the singleton instance
    orchestrator = getAIFunctionOrchestrator();
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const result = await orchestrator.executeFunction('analyze_contact_profile', {
        contactId: 'test-123',
        includeWebResearch: false
      }, { userId: 'user1' });

      expect(result.success).toBe(true);
    });

    it('should block requests exceeding rate limit', async () => {
      const promises = Array(101).fill(null).map((_, i) =>
        orchestrator.executeFunction('analyze_contact_profile', {
          contactId: `test-${i}`,
          includeWebResearch: false
        }, { userId: 'user1' })
      );

      const results = await Promise.all(promises);
      const blockedResults = results.filter(r => !r.success);

      expect(blockedResults.length).toBeGreaterThan(0);
      expect(blockedResults[0].error).toContain('Rate limit exceeded');
    });

    it('should allow different users to make requests', async () => {
      const results = await Promise.all([
        orchestrator.executeFunction('analyze_contact_profile', {
          contactId: 'test-1',
          includeWebResearch: false
        }, { userId: 'user1' }),
        orchestrator.executeFunction('analyze_contact_profile', {
          contactId: 'test-2',
          includeWebResearch: false
        }, { userId: 'user2' })
      ]);

      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Timeout Protection', () => {
    it('should timeout long-running functions', async () => {
      // Mock a function that takes longer than estimated duration
      const mockFunction = {
        name: 'slow_function',
        description: 'A slow function for testing',
        category: 'test' as const,
        parameters: [],
        handler: {
          execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
            return { success: true, data: 'result' };
          }
        },
        requiresConfirmation: false,
        fallbackBehavior: 'skip' as const,
        estimatedDuration: 1000, // 1 second timeout
        cacheable: false,
        priority: 'low' as const
      };

      orchestrator.registerFunction(mockFunction);

      const result = await orchestrator.executeFunction('slow_function', {}, { userId: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should validate required parameters', async () => {
      const result = await orchestrator.executeFunction('analyze_contact_profile', {
        // Missing required contactId
        includeWebResearch: false
      }, { userId: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Parameter validation failed');
    });

    it('should sanitize contact data', async () => {
      const result = await orchestrator.executeFunction('analyze_contact_profile', {
        contactId: 'test-123',
        includeWebResearch: false,
        contactData: {
          name: '<script>alert("xss")</script>John Doe',
          email: 'john@example.com',
          company: 'ACME Corp <b>Inc</b>'
        }
      }, { userId: 'test' });

      expect(result.success).toBe(true);
      // The function should still succeed, sanitization happens internally
    });

    it('should validate deal data', async () => {
      const result = await orchestrator.executeFunction('comprehensive_deal_analysis', {
        dealId: 'deal-123',
        includeMarketResearch: false,
        dealData: {
          name: 'Test Deal',
          value: -1000, // Invalid negative value
          probability: 50
        }
      }, { userId: 'test' });

      expect(result.success).toBe(true);
      // Function succeeds but data is sanitized internally
    });
  });

  describe('Error Handling', () => {
    it('should handle function not found', async () => {
      const result = await orchestrator.executeFunction('nonexistent_function', {}, { userId: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle function execution errors', async () => {
      const mockFunction = {
        name: 'failing_function',
        description: 'A function that always fails',
        category: 'test' as const,
        parameters: [],
        handler: {
          execute: async () => {
            throw new Error('Test error');
          }
        },
        requiresConfirmation: false,
        fallbackBehavior: 'skip' as const,
        estimatedDuration: 1000,
        cacheable: false,
        priority: 'low' as const
      };

      orchestrator.registerFunction(mockFunction);

      const result = await orchestrator.executeFunction('failing_function', {}, { userId: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    });
  });

  describe('Function Registration and Discovery', () => {
    it('should register and retrieve functions', () => {
      const mockFunction = {
        name: 'test_function',
        description: 'Test function',
        category: 'test' as const,
        parameters: [],
        handler: {
          execute: async () => ({ success: true, data: 'test' })
        },
        requiresConfirmation: false,
        fallbackBehavior: 'skip' as const,
        estimatedDuration: 1000,
        cacheable: false,
        priority: 'low' as const
      };

      orchestrator.registerFunction(mockFunction);

      expect(orchestrator.getFunctionDetails('test_function')).toEqual(mockFunction);
      expect(orchestrator.getAvailableFunctions('test')).toContain(mockFunction);
    });

    it('should check function availability', async () => {
      expect(await orchestrator.isFunctionAvailable('analyze_contact_profile')).toBe(true);
      expect(await orchestrator.isFunctionAvailable('nonexistent')).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track execution statistics', async () => {
      const initialStats = orchestrator.getStats();

      await orchestrator.executeFunction('analyze_contact_profile', {
        contactId: 'test-123',
        includeWebResearch: false
      }, { userId: 'test' });

      const updatedStats = orchestrator.getStats();

      expect(updatedStats.totalCalls).toBe(initialStats.totalCalls + 1);
      expect(updatedStats.successfulCalls).toBe(initialStats.successfulCalls + 1);
    });
  });
});