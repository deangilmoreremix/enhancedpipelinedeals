/**
 * Comprehensive tests for GPT-5 enhanced features
 * Tests web search, citations, caching, and AI enhancements
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { getWebSearchService } from '../services/webSearchService';
import { getCitationService } from '../services/citationService';
import { getCacheService } from '../services/cacheService';
import { getEnhancedIntelligentAI } from '../services/enhancedIntelligentAIService';

// Mock external dependencies
jest.mock('../config/apiConfig', () => ({
  getAPIConfig: () => ({
    webSearch: {
      enabled: true,
      provider: 'serpapi',
      apiKey: 'test-api-key'
    }
  })
}));

describe('GPT-5 Enhanced Features', () => {
  let webSearchService: any;
  let citationService: any;
  let cacheService: any;
  let aiService: any;

  beforeEach(() => {
    webSearchService = getWebSearchService();
    citationService = getCitationService();
    cacheService = getCacheService();
    aiService = getEnhancedIntelligentAI();

    // Clear all caches before each test
    cacheService.clear();
    citationService.clearCitationsForEntity('contact', 'test');
    citationService.clearCitationsForEntity('deal', 'test');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Web Search Service', () => {
    it('should perform basic web search', async () => {
      const mockResults = [
        {
          title: 'Test Company Overview',
          url: 'https://example.com',
          snippet: 'Test company description',
          domain: 'example.com',
          sourceType: 'company',
          credibilityScore: 85,
          timestamp: new Date().toISOString()
        }
      ];

      // Mock the fetch call
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ organic_results: mockResults })
        } as Response)
      );

      const results = await webSearchService.searchWithCitation('test query');
      expect(results.results).toBeDefined();
      expect(Array.isArray(results.results)).toBe(true);
    });

    it('should handle industry-specific search', async () => {
      const results = await webSearchService.searchByIndustry('test company', 'technology');
      expect(results).toBeDefined();
      expect(typeof results).toBe('object');
    });

    it('should extract citations from AI responses', async () => {
      const mockResponse = 'According to https://example.com/article, the company reported strong growth.';
      const mockResults = [
        {
          title: 'Test Article',
          url: 'https://example.com/article',
          snippet: 'Company growth data',
          domain: 'example.com',
          sourceType: 'news',
          credibilityScore: 90,
          timestamp: new Date().toISOString()
        }
      ];

      const citations = webSearchService.extractCitationsFromResponse(mockResponse, mockResults);
      expect(citations).toBeDefined();
      expect(Array.isArray(citations)).toBe(true);
    });
  });

  describe('Citation Service', () => {
    const mockCitation = {
      url: 'https://example.com',
      title: 'Test Article',
      domain: 'example.com',
      sourceType: 'news',
      credibilityScore: 90,
      timestamp: new Date().toISOString(),
      snippet: 'Test content'
    };

    it('should track citations for entities', async () => {
      await citationService.trackCitations('contact', 'test-contact', [mockCitation]);

      const citations = await citationService.getCitations('contact', 'test-contact');
      expect(citations.citations).toHaveLength(1);
      expect(citations.citations[0].url).toBe(mockCitation.url);
    });

    it('should calculate citation statistics', async () => {
      await citationService.trackCitations('contact', 'test-contact', [mockCitation]);

      const stats = citationService.getCitationStats();
      expect(stats.totalCitations).toBeGreaterThan(0);
      expect(stats.averageCredibility).toBeGreaterThan(0);
    });

    it('should update citation credibility', async () => {
      await citationService.trackCitations('contact', 'test-contact', [mockCitation]);

      const success = await citationService.updateCitationCredibility(
        'contact:test-contact:0',
        95
      );
      expect(success).toBe(true);
    });
  });

  describe('Cache Service', () => {
    it('should cache and retrieve data', async () => {
      const testData = { message: 'test data' };
      const key = 'test:key';

      await cacheService.set(key, testData);
      const retrieved = await cacheService.get(key);

      expect(retrieved).toEqual(testData);
    });

    it('should handle cache expiration', async () => {
      const testData = { message: 'expiring data' };
      const key = 'test:expiring';

      await cacheService.set(key, testData, 100); // 100ms TTL
      await new Promise(resolve => setTimeout(resolve, 150));

      const retrieved = await cacheService.get(key);
      expect(retrieved).toBeNull();
    });

    it('should generate consistent cache keys', () => {
      const params1 = { query: 'test', limit: 10 };
      const params2 = { query: 'test', limit: 10 };

      const key1 = cacheService.generateKey('service', 'method', params1);
      const key2 = cacheService.generateKey('service', 'method', params2);

      expect(key1).toBe(key2);
    });

    it('should provide cache statistics', () => {
      const stats = cacheService.getStats();
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('cacheEfficiency');
    });
  });

  describe('Enhanced AI Service', () => {
    it('should analyze contact with research', async () => {
      const mockContact = {
        id: 'test-contact',
        name: 'John Doe',
        company: 'Test Company',
        title: 'CEO'
      };

      const result = await aiService.analyzeContact(mockContact);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should research company with citations', async () => {
      const result = await aiService.researchCompanyWithCitations('Test Company', 'technology');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('citations');
    });

    it('should generate email with personalization', async () => {
      const mockContact = {
        id: 'test-contact',
        name: 'John Doe',
        company: 'Test Company',
        title: 'CEO'
      };

      const result = await aiService.generateEmail(mockContact, 'Follow-up on our discussion');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should get citations for entity', async () => {
      const result = await aiService.getCitationsForEntity('contact', 'test-contact');
      expect(result).toHaveProperty('citations');
      expect(result).toHaveProperty('totalCount');
    });
  });

  describe('Integration Tests', () => {
    it('should perform end-to-end contact analysis with research', async () => {
      const mockContact = {
        id: 'test-contact',
        name: 'Jane Smith',
        company: 'Tech Innovations Inc',
        title: 'CTO',
        industry: 'technology'
      };

      // Mock web search
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            organic_results: [{
              title: 'Jane Smith - CTO at Tech Innovations',
              url: 'https://linkedin.com/in/jane-smith',
              snippet: 'Experienced CTO with 10+ years in AI and machine learning',
              domain: 'linkedin.com',
              sourceType: 'social',
              credibilityScore: 75,
              timestamp: new Date().toISOString()
            }]
          })
        } as Response)
      );

      const result = await aiService.analyzeContactWithResearch(mockContact, true);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('insights');
    });

    it('should handle cache integration', async () => {
      const testData = { result: 'cached response' };
      const key = cacheService.generateKey('ai', 'analyzeContact', { contactId: 'test' });

      await cacheService.set(key, testData);

      // Verify cache hit
      const cached = await cacheService.get(key);
      expect(cached).toEqual(testData);

      // Verify cache stats
      const stats = cacheService.getStats();
      expect(stats.totalEntries).toBeGreaterThan(0);
    });

    it('should handle citation tracking in research workflow', async () => {
      const mockCitations = [
        {
          url: 'https://example.com/article1',
          title: 'Company Analysis',
          domain: 'example.com',
          sourceType: 'news',
          credibilityScore: 90,
          timestamp: new Date().toISOString()
        }
      ];

      await citationService.trackCitations('deal', 'test-deal', mockCitations);

      const citations = await citationService.getCitations('deal', 'test-deal');
      expect(citations.citations).toHaveLength(1);
      expect(citations.averageCredibility).toBe(90);
    });
  });

  describe('Error Handling', () => {
    it('should handle web search API failures gracefully', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new Error('Network error'))
      );

      await expect(webSearchService.searchWithCitation('test')).rejects.toThrow();
    });

    it('should handle citation service failures gracefully', async () => {
      const result = await citationService.getCitations('nonexistent', 'entity');
      expect(result.citations).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should handle cache service failures gracefully', async () => {
      const result = await cacheService.get('nonexistent-key');
      expect(result).toBeNull();
    });
  });

  describe('Performance Tests', () => {
    it('should demonstrate cache performance improvements', async () => {
      const testData = { largeDataset: 'x'.repeat(1000) };
      const key = 'performance:test';

      // First call - cache miss
      await cacheService.set(key, testData);
      const startTime = Date.now();
      const result1 = await cacheService.get(key);
      const firstCallTime = Date.now() - startTime;

      // Second call - cache hit
      const startTime2 = Date.now();
      const result2 = await cacheService.get(key);
      const secondCallTime = Date.now() - startTime2;

      expect(result1).toEqual(testData);
      expect(result2).toEqual(testData);
      // Cache hit should be faster (though this is a rough test)
      expect(secondCallTime).toBeLessThanOrEqual(firstCallTime);
    });

    it('should handle concurrent cache operations', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(cacheService.set(`concurrent:${i}`, { data: i }));
      }

      await Promise.all(promises);

      const stats = cacheService.getStats();
      expect(stats.totalEntries).toBeGreaterThanOrEqual(10);
    });
  });
});

// Performance benchmarks
describe('Performance Benchmarks', () => {
  it('should meet response time requirements', async () => {
    const cacheService = getCacheService();
    const startTime = Date.now();

    // Perform multiple cache operations
    for (let i = 0; i < 100; i++) {
      await cacheService.set(`bench:${i}`, { data: `value${i}` });
      await cacheService.get(`bench:${i}`);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTimePerOperation = totalTime / 200; // 100 sets + 100 gets

    // Should complete within reasonable time (adjust threshold as needed)
    expect(avgTimePerOperation).toBeLessThan(10); // Less than 10ms per operation
  });
});

export {};