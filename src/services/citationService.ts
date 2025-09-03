/**
 * Citation Service - Track and manage citations for AI-generated content
 * Provides citation storage, retrieval, and confidence scoring
 */

interface Citation {
  id: string;
  url: string;
  title: string;
  domain: string;
  sourceType: 'news' | 'company' | 'social' | 'academic' | 'government' | 'other';
  credibilityScore: number;
  timestamp: string;
  snippet?: string;
  entityType: 'contact' | 'deal' | 'company';
  entityId: string;
  createdAt: string;
}

interface CitationSummary {
  totalCount: number;
  citations: Citation[];
  sourceTypeBreakdown: Record<string, number>;
  averageCredibility: number;
  lastUpdated: string;
}

class CitationService {
  private citations: Map<string, Citation[]> = new Map();

  async trackCitations(entityType: 'contact' | 'deal' | 'company', entityId: string, citations: any[]): Promise<void> {
    try {
      const key = `${entityType}:${entityId}`;
      const existingCitations = this.citations.get(key) || [];

      const newCitations: Citation[] = citations.map((citation, index) => ({
        id: `${key}:${Date.now()}:${index}`,
        url: citation.url,
        title: citation.title,
        domain: citation.domain,
        sourceType: citation.sourceType,
        credibilityScore: citation.credibilityScore,
        timestamp: citation.timestamp,
        snippet: citation.snippet,
        entityType,
        entityId,
        createdAt: new Date().toISOString()
      }));

      // Merge with existing citations, avoiding duplicates
      const allCitations = [...existingCitations];
      for (const newCitation of newCitations) {
        const exists = allCitations.some(c => c.url === newCitation.url);
        if (!exists) {
          allCitations.push(newCitation);
        }
      }

      // Keep only the most recent 20 citations per entity
      allCitations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.citations.set(key, allCitations.slice(0, 20));

      console.log(`📚 Tracked ${newCitations.length} citations for ${entityType}:${entityId}`);
    } catch (error) {
      console.error('Failed to track citations:', error);
    }
  }

  async getCitations(entityType: 'contact' | 'deal' | 'company', entityId: string): Promise<CitationSummary> {
    try {
      const key = `${entityType}:${entityId}`;
      const citations = this.citations.get(key) || [];

      const sourceTypeBreakdown: Record<string, number> = {};
      let totalCredibility = 0;

      citations.forEach(citation => {
        sourceTypeBreakdown[citation.sourceType] = (sourceTypeBreakdown[citation.sourceType] || 0) + 1;
        totalCredibility += citation.credibilityScore;
      });

      const averageCredibility = citations.length > 0 ? totalCredibility / citations.length : 0;

      return {
        totalCount: citations.length,
        citations,
        sourceTypeBreakdown,
        averageCredibility: Math.round(averageCredibility),
        lastUpdated: citations.length > 0 ? citations[0].createdAt : new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get citations:', error);
      return {
        totalCount: 0,
        citations: [],
        sourceTypeBreakdown: {},
        averageCredibility: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  async getCitationById(citationId: string): Promise<Citation | null> {
    try {
      for (const citations of this.citations.values()) {
        const citation = citations.find(c => c.id === citationId);
        if (citation) {
          return citation;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to get citation by ID:', error);
      return null;
    }
  }

  async updateCitationCredibility(citationId: string, newScore: number): Promise<boolean> {
    try {
      for (const [key, citations] of this.citations.entries()) {
        const citationIndex = citations.findIndex(c => c.id === citationId);
        if (citationIndex !== -1) {
          citations[citationIndex].credibilityScore = Math.max(0, Math.min(100, newScore));
          this.citations.set(key, citations);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to update citation credibility:', error);
      return false;
    }
  }

  async removeCitation(citationId: string): Promise<boolean> {
    try {
      for (const [key, citations] of this.citations.entries()) {
        const filteredCitations = citations.filter(c => c.id !== citationId);
        if (filteredCitations.length !== citations.length) {
          this.citations.set(key, filteredCitations);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to remove citation:', error);
      return false;
    }
  }

  async getAllCitations(): Promise<Citation[]> {
    try {
      const allCitations: Citation[] = [];
      for (const citations of this.citations.values()) {
        allCitations.push(...citations);
      }
      return allCitations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Failed to get all citations:', error);
      return [];
    }
  }

  async clearCitationsForEntity(entityType: 'contact' | 'deal' | 'company', entityId: string): Promise<boolean> {
    try {
      const key = `${entityType}:${entityId}`;
      this.citations.delete(key);
      return true;
    } catch (error) {
      console.error('Failed to clear citations for entity:', error);
      return false;
    }
  }

  getCitationStats(): {
    totalCitations: number;
    entitiesWithCitations: number;
    averageCredibility: number;
    sourceTypeDistribution: Record<string, number>;
  } {
    try {
      const allCitations: Citation[] = [];
      for (const citations of this.citations.values()) {
        allCitations.push(...citations);
      }

      const sourceTypeDistribution: Record<string, number> = {};
      let totalCredibility = 0;

      allCitations.forEach(citation => {
        sourceTypeDistribution[citation.sourceType] = (sourceTypeDistribution[citation.sourceType] || 0) + 1;
        totalCredibility += citation.credibilityScore;
      });

      return {
        totalCitations: allCitations.length,
        entitiesWithCitations: this.citations.size,
        averageCredibility: allCitations.length > 0 ? Math.round(totalCredibility / allCitations.length) : 0,
        sourceTypeDistribution
      };
    } catch (error) {
      console.error('Failed to get citation stats:', error);
      return {
        totalCitations: 0,
        entitiesWithCitations: 0,
        averageCredibility: 0,
        sourceTypeDistribution: {}
      };
    }
  }
}

// Singleton instance
let citationService: CitationService | null = null;

export const getCitationService = (): CitationService => {
  if (!citationService) {
    citationService = new CitationService();
  }
  return citationService;
};

export { CitationService };
export type { Citation, CitationSummary };