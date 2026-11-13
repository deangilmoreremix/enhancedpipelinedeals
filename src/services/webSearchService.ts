/**
 * Web Search Service — OpenAI Responses API hosted `web_search` tool (via the Netlify gateway)
 * Citation extraction and source credibility scoring
 */

import { callAI } from './aiClient';

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
  findings?: string[];
  recommendations?: string[];
}

class WebSearchService {
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
    if (!query) throw new Error('Search query is required');

    try {
      const domainHint = options.domainFilter?.length
        ? `Prefer these sources: ${options.domainFilter.join(', ')}.`
        : '';
      const depth = options.contextSize === 'high' ? 'comprehensive' : options.contextSize === 'low' ? 'brief' : 'balanced';

      // OpenAI hosted web_search tool runs inside the Responses API call on the server.
      const result = await callAI<{
        findings: string[];
        citations: Array<{ url: string; title: string }>;
        recommendations: string[];
      }>('web_research', {
        instructions: systemPrompt,
        input: `${userPrompt}\n\nSearch query: ${query}\n${domainHint}\nDepth: ${depth}. Return up to ${options.maxResults || 10} cited sources.`,
        context: options.userLocation ? { userLocation: options.userLocation } : undefined,
      });
      if (!result.data) throw new Error('Search returned no structured result');

      const timestamp = new Date().toISOString();
      const results: SearchResult[] = (result.data.citations || []).map(c => {
        const domain = this.extractDomain(c.url);
        const cred = this.getDomainCredibilityScore(domain);
        return {
          title: c.title,
          url: c.url,
          snippet: '',
          domain,
          sourceType: cred.type as SearchResult['sourceType'],
          credibilityScore: cred.score,
          timestamp,
        };
      });
      const citations: CitationData[] = results.map(r => ({
        url: r.url,
        title: r.title,
        domain: r.domain,
        sourceType: r.sourceType,
        credibilityScore: r.credibilityScore,
        timestamp: r.timestamp,
      }));

      return {
        results,
        citations,
        totalResults: results.length,
        searchTime: Date.now() - startTime,
        query,
        findings: result.data.findings,
        recommendations: result.data.recommendations,
      };
    } catch (error) {
      console.error('Web search with AI failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Web search failed: ${errorMessage}`);
    }
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