/**
 * Web Search Service with GPT-5 Integration
 * Advanced web search capabilities with citation extraction and source validation
 */

import { getAIGatewayService } from './aiGatewayService';

interface SearchParameters {
  query?: string;
  contextSize?: 'low' | 'medium' | 'high';
  userLocation?: string;
  domainFilter?: string[];
  maxResults?: number;
  includeSources?: boolean;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  sourceType: 'news' | 'company' | 'social' | 'academic' | 'government' | 'other';
  credibilityScore: number;
  timestamp: string;
}

interface CitationData {
  url: string;
  title: string;
  domain: string;
  sourceType: 'news' | 'company' | 'social' | 'academic' | 'government' | 'other';
  credibilityScore: number;
  timestamp: string;
  snippet?: string;
}

interface WebSearchResponse {
  results: SearchResult[];
  citations: CitationData[];
  totalResults: number;
  searchTime: number;
  query: string;
}

class WebSearchService {
  private baseUrl: string;
  private apiKey: string;
  private provider: 'serpapi' | 'google' | 'bing';

  // Industry-specific domain mappings
  private industryDomains: Record<string, string[]> = {
    technology: [
      'techcrunch.com', 'venturebeat.com', 'wired.com', 'arstechnica.com',
      'theverge.com', 'cnet.com', 'zdnet.com', 'techrepublic.com',
      'siliconangle.com', 'computerworld.com'
    ],
    healthcare: [
      'medscape.com', 'healthcarefinancenews.com', 'modernhealthcare.com',
      'fiercehealthcare.com', 'biopharmadive.com', 'medtechdive.com',
      'statnews.com', 'nejm.org', 'thelancet.com'
    ],
    finance: [
      'bloomberg.com', 'reuters.com', 'wsj.com', 'ft.com', 'cnbc.com',
      'marketwatch.com', 'seekingalpha.com', 'investopedia.com', 'forbes.com'
    ],
    manufacturing: [
      'industryweek.com', 'manufacturing.net', 'automationworld.com',
      'assemblymag.com', 'mmsonline.com', 'plasticsnews.com'
    ],
    retail: [
      'retaildive.com', 'chainstoreage.com', 'stores.org', 'nrn.com',
      'supermarketnews.com', 'fashiondive.com'
    ],
    education: [
      'edtechmagazine.com', 'universitybusiness.com', 'insidehighered.com',
      'chronicle.com', 'edweek.org'
    ],
    real_estate: [
      'realtor.org', 'bisnow.com', 'commercialobserver.com',
      'therealdeal.com', 'globest.com'
    ],
    consulting: [
      'consulting.us', 'strategy-business.com', 'mckinsey.com',
      'deloitte.com', 'accenture.com', 'pwc.com'
    ],
    media: [
      'adage.com', 'digiday.com', 'mediapost.com', 'variety.com',
      'hollywoodreporter.com'
    ],
    transportation: [
      'transportdive.com', 'aircargoworld.com', 'joc.com', 'truckinginfo.com'
    ]
  };

  constructor() {
    const config = getAPIConfigHelper();
    this.provider = config.webSearch?.provider || 'serpapi';
    this.apiKey = config.webSearch?.apiKey || '';
    this.baseUrl = this.getProviderBaseUrl();
  }

  private getProviderBaseUrl(): string {
    switch (this.provider) {
      case 'serpapi':
        return 'https://serpapi.com/search.json';
      case 'google':
        return 'https://www.googleapis.com/customsearch/v1';
      case 'bing':
        return 'https://api.bing.microsoft.com/v7.0/search';
      default:
        return 'https://serpapi.com/search.json';
    }
  }

  private getDomainCredibilityScore(domain: string): { score: number; type: string } {
    const domainLower = domain.toLowerCase();

    // News sources - High credibility
    if (domainLower.includes('bbc.com') || domainLower.includes('reuters.com') ||
        domainLower.includes('apnews.com') || domainLower.includes('nytimes.com') ||
        domainLower.includes('wsj.com') || domainLower.includes('bloomberg.com') ||
        domainLower.includes('ft.com') || domainLower.includes('economist.com')) {
      return { score: 95, type: 'news' };
    }

    // Company sources - Medium-high credibility
    if (domainLower.includes('.com') && !domainLower.includes('news') &&
        !domainLower.includes('blog') && !domainLower.includes('medium.com')) {
      return { score: 85, type: 'company' };
    }

    // Academic sources - High credibility
    if (domainLower.includes('.edu') || domainLower.includes('scholar.google') ||
        domainLower.includes('researchgate') || domainLower.includes('arxiv.org') ||
        domainLower.includes('nature.com') || domainLower.includes('science.org')) {
      return { score: 90, type: 'academic' };
    }

    // Government sources - Very high credibility
    if (domainLower.includes('.gov') || domainLower.includes('who.int') ||
        domainLower.includes('un.org') || domainLower.includes('europa.eu')) {
      return { score: 95, type: 'government' };
    }

    // Industry associations and trade publications
    if (domainLower.includes('ieee.org') || domainLower.includes('acm.org') ||
        domainLower.includes('forrester.com') || domainLower.includes('gartner.com') ||
        domainLower.includes('idc.com')) {
      return { score: 88, type: 'industry' };
    }

    // Social media - Lower credibility but useful for sentiment
    if (domainLower.includes('linkedin.com') || domainLower.includes('twitter.com') ||
        domainLower.includes('facebook.com') || domainLower.includes('instagram.com')) {
      return { score: 70, type: 'social' };
    }

    // Blog and opinion sources - Variable credibility
    if (domainLower.includes('medium.com') || domainLower.includes('substack.com') ||
        domainLower.includes('blog')) {
      return { score: 65, type: 'blog' };
    }

    return { score: 60, type: 'other' };
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  async searchWithAI(
    query: string,
    systemPrompt: string,
    userPrompt: string,
    options: SearchParameters = {}
  ): Promise<WebSearchResponse> {
    const startTime = Date.now();

    try {
      // Perform web search
      const searchResults = await this.performWebSearch({
        query,
        contextSize: options.contextSize || 'medium',
        userLocation: options.userLocation,
        domainFilter: options.domainFilter,
        maxResults: options.maxResults || 10,
        includeSources: options.includeSources || true,
      });

      // Process results with GPT-5 for enhanced analysis
      const enhancedResults = await this.enhanceResultsWithAI(
        searchResults,
        systemPrompt,
        userPrompt
      );

      return {
        ...enhancedResults,
        searchTime: Date.now() - startTime,
        query,
      };
    } catch (error) {
      console.error('Web search with AI failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Web search failed: ${errorMessage}`);
    }
  }

  private async performWebSearch(params: SearchParameters): Promise<SearchResult[]> {
    if (!this.apiKey) {
      throw new Error('Web search API key not configured');
    }

    if (!params.query) {
      throw new Error('Search query is required');
    }

    // Build search query with industry filtering
    let searchQuery = params.query;
    if (params.domainFilter && params.domainFilter.length > 0) {
      // Add site-specific search terms for better targeting
      const siteQueries = params.domainFilter.map(domain => `site:${domain}`).join(' OR ');
      searchQuery = `${params.query} (${siteQueries})`;
    }

    const searchParams = new URLSearchParams({
      q: searchQuery,
      api_key: this.apiKey,
      num: (params.maxResults || 10).toString(),
    });

    if (params.userLocation) {
      searchParams.append('location', params.userLocation);
    }

    // Add context size parameter for different search depths
    if (params.contextSize) {
      switch (params.contextSize) {
        case 'low':
          searchParams.append('num', '5');
          break;
        case 'high':
          searchParams.append('num', '20');
          break;
        default: // medium
          searchParams.append('num', '10');
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}?${searchParams}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Search API error: ${data.error || response.statusText}`);
      }

      return this.parseSearchResults(data);
    } catch (error) {
      console.error('Web search request failed:', error);
      throw error;
    }
  }

  private parseSearchResults(data: any): SearchResult[] {
    const results: SearchResult[] = [];

    // Handle different provider response formats
    const organicResults = data.organic_results || data.items || data.webPages?.value || [];

    organicResults.forEach((result: any) => {
      const url = result.link || result.url;
      const domain = this.extractDomain(url);
      const credibility = this.getDomainCredibilityScore(domain);

      results.push({
        title: result.title,
        url,
        snippet: result.snippet || result.description || '',
        domain,
        sourceType: credibility.type as any,
        credibilityScore: credibility.score,
        timestamp: new Date().toISOString(),
      });
    });

    return results;
  }

  private async enhanceResultsWithAI(
    results: SearchResult[],
    systemPrompt: string,
    userPrompt: string
  ): Promise<WebSearchResponse> {
    // Use GPT-5 to analyze and enhance search results
    const enhancedPrompt = `
${systemPrompt}

Analyze these web search results and provide enhanced insights:

${results.map((r, i) => `${i + 1}. ${r.title} (${r.url})
   ${r.snippet}`).join('\n\n')}

${userPrompt}
`;

    try {
      const aiGateway = getAIGatewayService();
      const response = await aiGateway.makeRequest(
        aiGateway.createOpenAIRequest(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: enhancedPrompt }
          ],
          'gpt-4o',
          'web-search-analysis'
        )
      );

      // Extract citations from AI response
      const citations = this.extractCitationsFromResponse(response, results);

      return {
        results,
        citations,
        totalResults: results.length,
        searchTime: 0, // Will be set by caller
        query: '',
      };
    } catch (error) {
      console.warn('AI enhancement failed, returning raw results:', error);
      return {
        results,
        citations: [],
        totalResults: results.length,
        searchTime: 0,
        query: '',
      };
    }
  }

  private extractCitationsFromResponse(response: any, searchResults: SearchResult[]): CitationData[] {
    const citations: CitationData[] = [];
    const responseText = typeof response === 'string' ? response : JSON.stringify(response);

    // Extract URLs from response text
    const urlRegex = /https?:\/\/[^\s<>"']+/g;
    const urls = responseText.match(urlRegex) || [];

    urls.forEach(url => {
      const matchingResult = searchResults.find(r => r.url === url);
      if (matchingResult) {
        citations.push({
          url: matchingResult.url,
          title: matchingResult.title,
          domain: matchingResult.domain,
          sourceType: matchingResult.sourceType,
          credibilityScore: matchingResult.credibilityScore,
          timestamp: matchingResult.timestamp,
          snippet: matchingResult.snippet,
        });
      }
    });

    return citations;
  }

  getIndustryDomains(industry: string): string[] {
    return this.industryDomains[industry] || [];
  }

  getAvailableIndustries(): string[] {
    return Object.keys(this.industryDomains);
  }

  async searchWithCitation(
    query: string,
    options: SearchParameters = {}
  ): Promise<WebSearchResponse> {
    return this.searchWithAI(
      query,
      'You are a research assistant. Analyze web search results and provide citations for key information.',
      `Research this query and provide detailed analysis with proper citations: ${query}`,
      options
    );
  }

  async searchByIndustry(
    query: string,
    industry: string,
    options: Omit<SearchParameters, 'domainFilter'> = {}
  ): Promise<WebSearchResponse> {
    const industryDomains = this.getIndustryDomains(industry);
    if (industryDomains.length === 0) {
      throw new Error(`Industry '${industry}' not found. Available industries: ${this.getAvailableIndustries().join(', ')}`);
    }

    return this.searchWithCitation(query, {
      ...options,
      domainFilter: industryDomains
    });
  }
}

import { getAPIConfig } from '../config/apiConfig';

// Helper function to get API config
function getAPIConfigHelper() {
  return getAPIConfig();
}

// Singleton instance
let webSearchService: WebSearchService | null = null;

export const getWebSearchService = (): WebSearchService => {
  if (!webSearchService) {
    webSearchService = new WebSearchService();
  }
  return webSearchService;
};

export { WebSearchService };
export type { SearchParameters, SearchResult, CitationData, WebSearchResponse };