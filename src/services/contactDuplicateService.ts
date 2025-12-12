/**
 * Contact Duplicate Service - Smart duplicate detection and resolution
 * Uses AI-powered matching and fuzzy logic for accurate deduplication
 */

import { Contact } from '../types/contact';
import { getEnhancedIntelligentAI } from './enhancedIntelligentAIService';

export interface DuplicateAnalysis {
  imported: Contact;
  existing: Contact[];
  confidence: number;
  matchReasons: string[];
  recommendedAction: 'merge' | 'keep_both' | 'skip';
  mergeStrategy?: {
    primaryContact: Contact;
    fieldsToMerge: Record<string, any>;
    conflicts: Array<{
      field: string;
      values: any[];
      resolution: 'primary' | 'secondary' | 'combine';
    }>;
  };
  aiInsights?: {
    analysis: string;
    confidence: number;
    recommendedAction: string;
  };
}

export interface DuplicateResolution {
  action: 'merge' | 'keep_both' | 'skip';
  primaryContactId?: string;
  fieldResolutions?: Record<string, any>;
  notes?: string;
}

export interface DuplicateDetectionOptions {
  enableFuzzyMatching: boolean;
  enableAIMatching: boolean;
  similarityThreshold: number;
  maxCandidates: number;
  checkEmailDomains: boolean;
  checkCompanyVariations: boolean;
  prioritizeRecentContacts: boolean;
}

export interface DuplicateStats {
  totalDuplicatesFound: number;
  duplicatesResolved: number;
  averageConfidence: number;
  resolutionRate: number;
  commonMatchReasons: Record<string, number>;
}

class ContactDuplicateService {
  private defaultOptions: DuplicateDetectionOptions = {
    enableFuzzyMatching: true,
    enableAIMatching: false, // Disabled by default for performance
    similarityThreshold: 0.8,
    maxCandidates: 10,
    checkEmailDomains: true,
    checkCompanyVariations: true,
    prioritizeRecentContacts: true
  };

  /**
   * Find potential duplicates for imported contacts
   */
  async findDuplicates(
    importedContacts: Contact[],
    existingContacts: Contact[],
    options: Partial<DuplicateDetectionOptions> = {}
  ): Promise<DuplicateAnalysis[]> {
    const opts = { ...this.defaultOptions, ...options };
    const analyses: DuplicateAnalysis[] = [];

    for (const imported of importedContacts) {
      const candidates = await this.findCandidateDuplicates(imported, existingContacts, opts);

      if (candidates.length > 0) {
        const analysis = await this.analyzeDuplicates(imported, candidates, opts);
        if (analysis.confidence >= opts.similarityThreshold) {
          analyses.push(analysis);
        }
      }
    }

    return analyses;
  }

  /**
   * Find candidate duplicates using fast filtering
   */
  private async findCandidateDuplicates(
    imported: Contact,
    existingContacts: Contact[],
    options: DuplicateDetectionOptions
  ): Promise<Contact[]> {
    const candidates: Contact[] = [];
    const scoredCandidates: Array<{ contact: Contact; score: number }> = [];

    for (const existing of existingContacts) {
      let score = 0;

      // Exact email match (highest priority)
      if (imported.email && existing.email &&
          imported.email.toLowerCase() === existing.email.toLowerCase()) {
        score += 100;
      }

      // Email domain match
      if (options.checkEmailDomains && imported.email && existing.email) {
        const importedDomain = imported.email.split('@')[1];
        const existingDomain = existing.email.split('@')[1];
        if (importedDomain && existingDomain && importedDomain === existingDomain) {
          score += 30;
        }
      }

      // Name similarity
      if (imported.name && existing.name) {
        const nameSimilarity = this.calculateStringSimilarity(
          imported.name.toLowerCase(),
          existing.name.toLowerCase()
        );
        if (nameSimilarity > 0.8) {
          score += 40;
        } else if (nameSimilarity > 0.6) {
          score += 20;
        }
      }

      // Company match
      if (imported.company && existing.company) {
        const companySimilarity = this.calculateCompanySimilarity(
          imported.company,
          existing.company,
          options.checkCompanyVariations
        );
        if (companySimilarity > 0.9) {
          score += 35;
        } else if (companySimilarity > 0.7) {
          score += 15;
        }
      }

      // Phone number match
      if (imported.phone && existing.phone) {
        const phoneSimilarity = this.calculatePhoneSimilarity(imported.phone, existing.phone);
        if (phoneSimilarity > 0.9) {
          score += 25;
        }
      }

      // Title similarity
      if (imported.title && existing.title) {
        const titleSimilarity = this.calculateStringSimilarity(
          imported.title.toLowerCase(),
          existing.title.toLowerCase()
        );
        if (titleSimilarity > 0.8) {
          score += 15;
        }
      }

      if (score > 10) { // Minimum threshold to be considered a candidate
        scoredCandidates.push({ contact: existing, score });
      }
    }

    // Sort by score and return top candidates
    scoredCandidates.sort((a, b) => b.score - a.score);
    return scoredCandidates.slice(0, options.maxCandidates).map(c => c.contact);
  }

  /**
   * Analyze duplicates with optional AI enhancement
   */
  private async analyzeDuplicates(
    imported: Contact,
    candidates: Contact[],
    options: DuplicateDetectionOptions
  ): Promise<DuplicateAnalysis> {
    const matchReasons: string[] = [];
    let totalConfidence = 0;

    // Analyze each candidate
    const candidateAnalyses = candidates.map(candidate => {
      const reasons: string[] = [];
      let confidence = 0;

      // Email analysis
      if (imported.email && candidate.email) {
        if (imported.email.toLowerCase() === candidate.email.toLowerCase()) {
          reasons.push('Exact email match');
          confidence += 50;
        } else if (this.getEmailDomain(imported.email) === this.getEmailDomain(candidate.email)) {
          reasons.push('Same email domain');
          confidence += 15;
        }
      }

      // Name analysis
      if (imported.name && candidate.name) {
        const similarity = this.calculateStringSimilarity(
          imported.name.toLowerCase(),
          candidate.name.toLowerCase()
        );
        if (similarity > 0.9) {
          reasons.push('Very similar names');
          confidence += 30;
        } else if (similarity > 0.7) {
          reasons.push('Similar names');
          confidence += 15;
        }
      }

      // Company analysis
      if (imported.company && candidate.company) {
        const similarity = this.calculateCompanySimilarity(
          imported.company,
          candidate.company,
          options.checkCompanyVariations
        );
        if (similarity > 0.9) {
          reasons.push('Same company');
          confidence += 25;
        } else if (similarity > 0.7) {
          reasons.push('Similar company');
          confidence += 10;
        }
      }

      // Phone analysis
      if (imported.phone && candidate.phone) {
        if (this.normalizePhone(imported.phone) === this.normalizePhone(candidate.phone)) {
          reasons.push('Same phone number');
          confidence += 20;
        }
      }

      // Title analysis
      if (imported.title && candidate.title) {
        const similarity = this.calculateStringSimilarity(
          imported.title.toLowerCase(),
          candidate.title.toLowerCase()
        );
        if (similarity > 0.8) {
          reasons.push('Similar job titles');
          confidence += 10;
        }
      }

      // Recency bonus
      if (options.prioritizeRecentContacts && candidate.updatedAt) {
        const daysSinceUpdate = (Date.now() - candidate.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 30) {
          confidence += 5; // Bonus for recently updated contacts
        }
      }

      return { candidate, reasons, confidence };
    });

    // Sort by confidence
    candidateAnalyses.sort((a, b) => b.confidence - a.confidence);
    const topCandidate = candidateAnalyses[0];

    // Determine recommended action
    let recommendedAction: 'merge' | 'keep_both' | 'skip' = 'keep_both';
    if (topCandidate.confidence > 80) {
      recommendedAction = 'merge';
    } else if (topCandidate.confidence < 30) {
      recommendedAction = 'skip';
    }

    const analysis: DuplicateAnalysis = {
      imported,
      existing: candidateAnalyses.map(a => a.candidate),
      confidence: topCandidate.confidence,
      matchReasons: topCandidate.reasons,
      recommendedAction
    };

    // AI-enhanced analysis (optional)
  if (options.enableAIMatching && topCandidate.confidence > 60) {
    try {
      const aiAnalysis = await this.getAIAnalysis(imported, topCandidate.candidate);
      analysis.aiInsights = aiAnalysis;
      // Adjust confidence based on AI analysis
      if (aiAnalysis && aiAnalysis.confidence > 0.8) {
        analysis.confidence = Math.min(100, analysis.confidence + 10);
      }
    } catch (error) {
      console.warn('AI duplicate analysis failed:', error);
    }
  }

    // Generate merge strategy if recommended
    if (recommendedAction === 'merge') {
      analysis.mergeStrategy = this.generateMergeStrategy(imported, topCandidate.candidate);
    }

    return analysis;
  }

  /**
   * Get AI-powered duplicate analysis
   */
  private async getAIAnalysis(contact1: Contact, contact2: Contact): Promise<DuplicateAnalysis['aiInsights']> {
    const aiService = getEnhancedIntelligentAI();

    const prompt = `Analyze if these two contacts are the same person:

Contact 1:
- Name: ${contact1.name}
- Email: ${contact1.email}
- Company: ${contact1.company}
- Title: ${contact1.title}
- Phone: ${contact1.phone}

Contact 2:
- Name: ${contact2.name}
- Email: ${contact2.email}
- Company: ${contact2.company}
- Title: ${contact2.title}
- Phone: ${contact2.phone}

Return JSON: {
  "analysis": "brief explanation",
  "confidence": 0-1,
  "recommendedAction": "merge|keep_both|skip"
}`;

    try {
      const response = await aiService.analyzeContact({ customPrompt: prompt }, 'quality');

      return {
        analysis: response.analysis || 'AI analysis completed',
        confidence: response.confidence || 0.5,
        recommendedAction: response.recommendedAction || 'keep_both'
      };
    } catch (error) {
      return {
        analysis: 'AI analysis unavailable',
        confidence: 0.5,
        recommendedAction: 'keep_both'
      };
    }
  }

  /**
   * Generate merge strategy for duplicates
   */
  private generateMergeStrategy(contact1: Contact, contact2: Contact): DuplicateAnalysis['mergeStrategy'] {
    const primary = contact2; // Existing contact takes precedence
    const secondary = contact1; // Imported contact
    const fieldsToMerge: Record<string, any> = {};
    const conflicts: Array<{ field: string; values: any[]; resolution: 'primary' | 'secondary' | 'combine' }> = [];

    // Define field priority (existing > imported for most fields)
    const fieldPriorities: Record<string, 'primary' | 'secondary' | 'combine'> = {
      name: 'primary',
      email: 'primary',
      phone: 'primary',
      title: 'primary',
      company: 'primary',
      industry: 'primary',
      status: 'primary',
      interestLevel: 'primary',
      sources: 'combine',
      tags: 'combine',
      notes: 'combine',
      customFields: 'combine'
    };

    // Check each field for conflicts
    Object.keys(fieldPriorities).forEach(field => {
      const primaryValue = (primary as any)[field];
      const secondaryValue = (secondary as any)[field];

      if (primaryValue && secondaryValue && primaryValue !== secondaryValue) {
        const resolution = fieldPriorities[field];

        if (resolution === 'combine') {
          if (Array.isArray(primaryValue) && Array.isArray(secondaryValue)) {
            fieldsToMerge[field] = [...new Set([...primaryValue, ...secondaryValue])];
          } else if (typeof primaryValue === 'string' && typeof secondaryValue === 'string') {
            fieldsToMerge[field] = `${primaryValue}; ${secondaryValue}`;
          } else {
            fieldsToMerge[field] = primaryValue; // Keep primary if can't combine
          }
        } else {
          fieldsToMerge[field] = resolution === 'primary' ? primaryValue : secondaryValue;
        }

        conflicts.push({
          field,
          values: [primaryValue, secondaryValue],
          resolution
        });
      } else {
        // No conflict, use existing value or add new one
        fieldsToMerge[field] = primaryValue || secondaryValue;
      }
    });

    return {
      primaryContact: primary,
      fieldsToMerge,
      conflicts
    };
  }

  /**
   * Apply duplicate resolution
   */
  async resolveDuplicate(analysis: DuplicateAnalysis, resolution: DuplicateResolution): Promise<Contact | null> {
    switch (resolution.action) {
      case 'merge':
        if (analysis.mergeStrategy) {
          // In a real implementation, this would update the database
          const mergedContact = {
            ...analysis.mergeStrategy.primaryContact,
            ...analysis.mergeStrategy.fieldsToMerge,
            updatedAt: new Date()
          };
          return mergedContact;
        }
        break;

      case 'keep_both':
        // Both contacts are kept as-is
        return null;

      case 'skip':
        // Imported contact is discarded
        return null;
    }

    return null;
  }

  /**
   * Utility functions for similarity calculations
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private calculateCompanySimilarity(company1: string, company2: string, checkVariations: boolean): number {
    if (!company1 || !company2) return 0;

    const c1 = company1.toLowerCase().trim();
    const c2 = company2.toLowerCase().trim();

    // Exact match
    if (c1 === c2) return 1.0;

    // Check for common variations if enabled
    if (checkVariations) {
      const variations1 = this.generateCompanyVariations(c1);
      const variations2 = this.generateCompanyVariations(c2);

      for (const v1 of variations1) {
        for (const v2 of variations2) {
          if (v1 === v2) return 0.9;
        }
      }
    }

    // Fuzzy match
    return this.calculateStringSimilarity(c1, c2);
  }

  private generateCompanyVariations(company: string): string[] {
    const variations = [company];

    // Remove common suffixes
    const suffixes = ['inc', 'llc', 'ltd', 'corp', 'corporation', 'company', 'co', 'group', 'holdings'];
    for (const suffix of suffixes) {
      if (company.endsWith(` ${suffix}`)) {
        variations.push(company.replace(` ${suffix}`, ''));
      }
      if (company.endsWith(` ${suffix}.`)) {
        variations.push(company.replace(` ${suffix}.`, ''));
      }
    }

    // Remove common prefixes
    const prefixes = ['the'];
    for (const prefix of prefixes) {
      if (company.startsWith(`${prefix} `)) {
        variations.push(company.replace(`${prefix} `, ''));
      }
    }

    return [...new Set(variations)]; // Remove duplicates
  }

  private calculatePhoneSimilarity(phone1: string, phone2: string): number {
    const normalized1 = this.normalizePhone(phone1);
    const normalized2 = this.normalizePhone(phone2);

    if (normalized1 === normalized2) return 1.0;

    // Check if one is a subset of the other (handles extensions)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return 0.9;
    }

    return 0;
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)\.]/g, '');
  }

  private getEmailDomain(email: string): string {
    return email.split('@')[1]?.toLowerCase() || '';
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get duplicate detection statistics
   */
  getDuplicateStats(analyses: DuplicateAnalysis[]): DuplicateStats {
    const totalDuplicatesFound = analyses.length;
    const duplicatesResolved = analyses.filter(a => a.recommendedAction === 'merge').length;
    const averageConfidence = analyses.length > 0
      ? analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length
      : 0;
    const resolutionRate = totalDuplicatesFound > 0 ? duplicatesResolved / totalDuplicatesFound : 0;

    const commonMatchReasons: Record<string, number> = {};
    analyses.forEach(analysis => {
      analysis.matchReasons.forEach(reason => {
        commonMatchReasons[reason] = (commonMatchReasons[reason] || 0) + 1;
      });
    });

    return {
      totalDuplicatesFound,
      duplicatesResolved,
      averageConfidence,
      resolutionRate,
      commonMatchReasons
    };
  }
}

export const contactDuplicateService = new ContactDuplicateService();