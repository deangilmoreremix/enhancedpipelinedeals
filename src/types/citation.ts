/**
 * Citation System Types and Interfaces
 * Comprehensive citation tracking and management for GPT-5 enhanced research
 */

export interface CitationSource {
  id: string;
  url: string;
  title: string;
  domain: string;
  sourceType: 'news' | 'company' | 'social' | 'academic' | 'government' | 'industry' | 'blog' | 'other';
  credibilityScore: number;
  timestamp: string;
  snippet?: string;
  author?: string;
  publicationDate?: string;
  accessDate: string;
  relevanceScore?: number;
}

export interface CitationReference {
  id: string;
  sourceId: string;
  entityType: 'contact' | 'deal' | 'company' | 'research';
  entityId: string;
  context: string;
  quote?: string;
  pageNumber?: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  createdAt: string;
  lastVerified: string;
  isActive: boolean;
}

export interface CitationBadge {
  source: CitationSource;
  confidence: 'high' | 'medium' | 'low';
  color: string;
  icon: string;
  tooltip: string;
}

export interface CitationSummary {
  totalCitations: number;
  sourceTypes: Record<string, number>;
  averageConfidence: number;
  topSources: CitationSource[];
  lastUpdated: string;
}

export interface CitationValidation {
  citationId: string;
  isValid: boolean;
  lastChecked: string;
  errorMessage?: string;
  validationSource: 'manual' | 'automated';
}

export interface CitationExport {
  format: 'APA' | 'MLA' | 'Chicago' | 'Harvard';
  citations: CitationReference[];
  bibliography: string[];
}

export type CitationFilter = {
  sourceType?: string[];
  confidenceLevel?: ('high' | 'medium' | 'low')[];
  dateRange?: {
    start: string;
    end: string;
  };
  domain?: string[];
  entityType?: string;
};

export interface CitationAnalytics {
  totalSources: number;
  sourceTypeDistribution: Record<string, number>;
  confidenceDistribution: Record<string, number>;
  temporalTrends: Array<{
    date: string;
    citations: number;
  }>;
  topDomains: Array<{
    domain: string;
    count: number;
    averageScore: number;
  }>;
}