/**
 * Enhanced Contact Import Service - AI-powered contact enrichment and import
 * Provides advanced contact data processing with AI enrichment, validation, and deduplication
 */

import { Contact } from '../types/contact';
import { getEnhancedIntelligentAI } from './enhancedIntelligentAIService';
import { getWebSearchService } from './webSearchService';
import { getCitationService } from './citationService';
import * as XLSX from 'xlsx';
import * as xml2js from 'xml2js';
import * as yaml from 'js-yaml';

export interface AIEnrichmentData {
  enrichedCompanyData?: {
    industry: string;
    size: string;
    revenue: string;
    competitors: string[];
    founded: string;
    description: string;
    headquarters?: string;
    funding?: string;
  };
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    companyWebsite?: string;
    personalWebsite?: string;
  };
  buyingSignals?: {
    recentActivity: string[];
    contentInterests: string[];
    budgetIndicators: string[];
    timelineSignals: string[];
  };
  enrichmentMetadata?: {
    sourcesUsed: string[];
    confidence: number;
    lastEnriched: Date;
    enrichmentDuration: number;
  };
}

export interface ContactImportResult<T> {
  success: T[];
  errors: ContactImportError[];
  duplicates: DuplicateAnalysis[];
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  enrichedCount: number;
  processingTime: number;
}

export interface ContactImportError {
  row: number;
  field?: string;
  message: string;
  data?: any;
  severity: 'error' | 'warning';
}

export interface DuplicateAnalysis {
  imported: any;
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
}

export interface ContactEnrichmentOptions {
  enrichCompanyData: boolean;
  discoverSocialProfiles: boolean;
  analyzeBuyingSignals: boolean;
  generateLeadScoring: boolean;
  includeWebResearch: boolean;
  maxResearchResults?: number;
}

export interface ContactImportProgress {
  current: number;
  total: number;
  status: 'parsing' | 'validating' | 'enriching' | 'deduplicating' | 'saving' | 'complete' | 'error';
  message?: string;
  phaseProgress?: number;
  currentItem?: string;
}

class EnhancedContactImportService {
  private batchSize = 10;
  private maxConcurrency = 3;

  /**
   * Import contacts with AI enrichment
   */
  async importContactsWithAI(
    input: string | ArrayBuffer,
    format: 'json' | 'csv' | 'excel' | 'xml' | 'tsv' | 'yaml',
    enrichmentOptions: ContactEnrichmentOptions,
    onProgress?: (progress: ContactImportProgress) => void
  ): Promise<ContactImportResult<Contact & AIEnrichmentData>> {
    const startTime = Date.now();

    try {
      onProgress?.({ current: 0, total: 0, status: 'parsing', message: 'Parsing contact data...' });

      // Parse input data based on format
      let rawContacts: any[];
      switch (format) {
        case 'json':
          rawContacts = this.parseJSONContacts(typeof input === 'string' ? input : '');
          break;
        case 'csv':
          rawContacts = this.parseCSVContacts(typeof input === 'string' ? input : '');
          break;
        case 'excel':
          rawContacts = this.parseExcelContacts(input as ArrayBuffer);
          break;
        case 'xml':
          rawContacts = await this.parseXMLContacts(typeof input === 'string' ? input : '');
          break;
        case 'tsv':
          rawContacts = this.parseTSVContacts(typeof input === 'string' ? input : '');
          break;
        case 'yaml':
          rawContacts = this.parseYAMLContacts(typeof input === 'string' ? input : '');
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      onProgress?.({
        current: 0,
        total: rawContacts.length,
        status: 'validating',
        message: 'Validating contact data...'
      });

      const result: ContactImportResult<Contact & AIEnrichmentData> = {
        success: [],
        errors: [],
        duplicates: [],
        totalProcessed: rawContacts.length,
        successCount: 0,
        errorCount: 0,
        duplicateCount: 0,
        enrichedCount: 0,
        processingTime: 0
      };

      // Process contacts in batches
      const batches = this.chunkArray(rawContacts, this.batchSize);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchStartIndex = batchIndex * this.batchSize;

        // Process batch with concurrency control
        const batchPromises = batch.map(async (rawContact, indexInBatch) => {
          const globalIndex = batchStartIndex + indexInBatch;

          onProgress?.({
            current: globalIndex + 1,
            total: rawContacts.length,
            status: 'enriching',
            message: `Processing contact ${globalIndex + 1} of ${rawContacts.length}`,
            currentItem: rawContact.name || rawContact.email || `Contact ${globalIndex + 1}`
          });

          try {
            // Validate and transform
            const validatedContact = await this.validateAndTransformContact(rawContact, globalIndex + 1);

            // AI enrichment
            const enrichedContact = await this.enrichContactWithAI(validatedContact, enrichmentOptions);

            // Duplicate detection
            const duplicates = await this.detectDuplicates(enrichedContact);

            if (duplicates.length > 0) {
              result.duplicates.push({
                imported: enrichedContact,
                existing: duplicates,
                confidence: this.calculateDuplicateConfidence(enrichedContact, duplicates[0]),
                matchReasons: this.getMatchReasons(enrichedContact, duplicates[0]),
                recommendedAction: 'merge'
              });
              result.duplicateCount++;
            } else {
              result.success.push(enrichedContact);
              result.successCount++;
              if (enrichedContact.enrichmentMetadata) {
                result.enrichedCount++;
              }
            }

          } catch (error) {
            result.errors.push({
              row: globalIndex + 1,
              message: error instanceof Error ? error.message : 'Unknown error',
              data: rawContact,
              severity: 'error'
            });
            result.errorCount++;
          }
        });

        // Wait for batch to complete
        await Promise.allSettled(batchPromises);

        // Small delay between batches
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      result.processingTime = Date.now() - startTime;

      onProgress?.({
        current: rawContacts.length,
        total: rawContacts.length,
        status: 'complete',
        message: `Import complete: ${result.successCount} success, ${result.errorCount} errors, ${result.duplicateCount} duplicates`
      });

      return result;

    } catch (error) {
      onProgress?.({ current: 0, total: 0, status: 'error', message: 'Import failed' });
      throw error;
    }
  }

  /**
   * AI-powered contact enrichment
   */
  private async enrichContactWithAI(
    contact: Contact,
    options: ContactEnrichmentOptions
  ): Promise<Contact & AIEnrichmentData> {
    const enriched: Contact & AIEnrichmentData = { ...contact };
    const enrichmentStart = Date.now();
    const sourcesUsed: string[] = [];

    try {
      const aiService = getEnhancedIntelligentAI();

      // Company data enrichment
      if (options.enrichCompanyData && contact.company) {
        sourcesUsed.push('company-research');

        const companyPrompt = `Research this company comprehensively: ${contact.company}
        ${contact.industry ? `Industry: ${contact.industry}` : ''}
        ${contact.title ? `Contact Title: ${contact.title}` : ''}

        Return as JSON: {
          "industry": "primary industry",
          "size": "company size (startup/SMB/enterprise)",
          "revenue": "annual revenue range",
          "competitors": ["competitor1", "competitor2"],
          "founded": "founding year",
          "description": "2-3 sentence company description",
          "headquarters": "HQ location",
          "funding": "funding status if applicable"
        }`;

        const companyResponse = await aiService.analyzeContact({ company: contact.company }, 'quality');
        if (companyResponse.enrichedCompanyData) {
          enriched.enrichedCompanyData = companyResponse.enrichedCompanyData;
        }
      }

      // Social profile discovery
      if (options.discoverSocialProfiles) {
        sourcesUsed.push('social-discovery');

        if (options.includeWebResearch) {
          const webSearch = getWebSearchService();
          const searchQuery = `${contact.name} ${contact.company} ${contact.title} linkedin`;

          const searchResults = await webSearch.searchWithCitation(searchQuery, {
            maxResults: options.maxResearchResults || 3,
            includeSources: true
          });

          // Extract LinkedIn and other social profiles from search results
          const socialProfiles: any = {};
          for (const result of searchResults.results) {
            if (result.url.includes('linkedin.com')) {
              socialProfiles.linkedin = result.url;
            } else if (result.url.includes('twitter.com') || result.url.includes('x.com')) {
              socialProfiles.twitter = result.url;
            }
          }

          if (Object.keys(socialProfiles).length > 0) {
            enriched.socialProfiles = { ...enriched.socialProfiles, ...socialProfiles };
            sourcesUsed.push('web-search');
          }
        }
      }

      // Buying signals analysis
      if (options.analyzeBuyingSignals) {
        sourcesUsed.push('buying-signals');

        const signalsPrompt = `Analyze buying signals for this contact:
        Name: ${contact.name}
        Title: ${contact.title}
        Company: ${contact.company}
        Industry: ${contact.industry}
        Status: ${contact.status}
        Interest Level: ${contact.interestLevel}

        Return as JSON: {
          "recentActivity": ["activity1", "activity2"],
          "contentInterests": ["interest1", "interest2"],
          "budgetIndicators": ["indicator1", "indicator2"],
          "timelineSignals": ["signal1", "signal2"]
        }`;

        const signalsResponse = await aiService.analyzeContact({
          name: contact.name,
          title: contact.title,
          company: contact.company,
          industry: contact.industry,
          status: contact.status,
          interestLevel: contact.interestLevel
        }, 'quality');

        if (signalsResponse.buyingSignals) {
          enriched.buyingSignals = signalsResponse.buyingSignals;
        }
      }

      // Lead scoring
      if (options.generateLeadScoring) {
        sourcesUsed.push('lead-scoring');

        // Use existing analyzeContact method for scoring
        const analysis = await aiService.analyzeContact({
          name: contact.name,
          title: contact.title,
          company: contact.company,
          industry: contact.industry,
          status: contact.status,
          interestLevel: contact.interestLevel
        }, 'quality');

        // Update aiScore with analysis result
        enriched.aiScore = analysis.score || 50;
      }

      // Add enrichment metadata
      enriched.enrichmentMetadata = {
        sourcesUsed,
        confidence: 0.85, // Could be calculated based on data completeness
        lastEnriched: new Date(),
        enrichmentDuration: Date.now() - enrichmentStart
      };

    } catch (error) {
      console.warn('Contact enrichment failed:', error);
      // Continue without enrichment rather than failing
    }

    return enriched;
  }

  /**
   * Smart duplicate detection
   */
  private async detectDuplicates(contact: Contact & AIEnrichmentData): Promise<Contact[]> {
    // This would typically query the database
    // For now, return empty array as we don't have DB access in this service
    return [];
  }

  /**
   * Calculate duplicate confidence score
   */
  private calculateDuplicateConfidence(contact1: Contact & AIEnrichmentData, contact2: Contact): number {
    let score = 0;

    // Email match (highest weight)
    if (contact1.email?.toLowerCase() === contact2.email?.toLowerCase()) {
      score += 50;
    }

    // Name similarity
    if (contact1.name && contact2.name) {
      const nameSimilarity = this.calculateStringSimilarity(
        contact1.name.toLowerCase(),
        contact2.name.toLowerCase()
      );
      if (nameSimilarity > 0.8) {
        score += 25;
      }
    }

    // Company match
    if (contact1.company?.toLowerCase() === contact2.company?.toLowerCase()) {
      score += 15;
    }

    // Title similarity
    if (contact1.title && contact2.title) {
      const titleSimilarity = this.calculateStringSimilarity(
        contact1.title.toLowerCase(),
        contact2.title.toLowerCase()
      );
      if (titleSimilarity > 0.7) {
        score += 10;
      }
    }

    return Math.min(score, 100);
  }

  /**
   * Get reasons for duplicate match
   */
  private getMatchReasons(contact1: Contact & AIEnrichmentData, contact2: Contact): string[] {
    const reasons: string[] = [];

    if (contact1.email?.toLowerCase() === contact2.email?.toLowerCase()) {
      reasons.push('Email address match');
    }

    if (contact1.name && contact2.name) {
      const nameSimilarity = this.calculateStringSimilarity(
        contact1.name.toLowerCase(),
        contact2.name.toLowerCase()
      );
      if (nameSimilarity > 0.8) {
        reasons.push('Similar name');
      }
    }

    if (contact1.company?.toLowerCase() === contact2.company?.toLowerCase()) {
      reasons.push('Same company');
    }

    if (contact1.title && contact2.title) {
      const titleSimilarity = this.calculateStringSimilarity(
        contact1.title.toLowerCase(),
        contact2.title.toLowerCase()
      );
      if (titleSimilarity > 0.7) {
        reasons.push('Similar job title');
      }
    }

    return reasons;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
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
   * Parse JSON contacts
   */
  private parseJSONContacts(content: string): any[] {
    try {
      const parsed = JSON.parse(content);

      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.contacts && Array.isArray(parsed.contacts)) {
        return parsed.contacts;
      } else if (parsed.data && Array.isArray(parsed.data)) {
        return parsed.data;
      } else {
        throw new Error('Invalid JSON format. Expected array or object with contacts/data property.');
      }
    } catch (error) {
      throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse CSV contacts
   */
  private parseCSVContacts(content: string): any[] {
    try {
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error('CSV must contain at least a header row and one data row');
      }

      const headers = this.parseCSVLine(lines[0]);
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length > 0 && values.some(v => v.trim())) {
          const row: any = {};
          headers.forEach((header, index) => {
            row[header.toLowerCase().trim()] = values[index]?.trim() || '';
          });
          rows.push(row);
        }
      }

      return rows;
    } catch (error) {
      throw new Error(`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Parse Excel contacts (.xlsx, .xls)
   */
  private parseExcelContacts(buffer: ArrayBuffer): any[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'array' });

      // Use the first worksheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('Excel file contains no worksheets');
      }

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // Use first row as headers
        defval: '' // Default value for empty cells
      });

      if (jsonData.length < 2) {
        throw new Error('Excel file must contain at least a header row and one data row');
      }

      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1) as any[][];

      return rows.map(row => {
        const contact: any = {};
        headers.forEach((header, index) => {
          const cleanHeader = header.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_');
          contact[cleanHeader] = row[index] || '';
        });
        return contact;
      });

    } catch (error) {
      throw new Error(`Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse XML contacts
   */
  private async parseXMLContacts(content: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      xml2js.parseString(content, { explicitArray: false }, (err, result) => {
        if (err) {
          reject(new Error(`XML parsing failed: ${err.message}`));
          return;
        }

        try {
          // Handle different XML structures
          let contacts: any[] = [];

          if (result.contacts && Array.isArray(result.contacts.contact)) {
            contacts = result.contacts.contact;
          } else if (result.contacts && result.contacts.contact) {
            contacts = [result.contacts.contact];
          } else if (Array.isArray(result.contact)) {
            contacts = result.contact;
          } else if (result.contact) {
            contacts = [result.contact];
          } else {
            throw new Error('Invalid XML format. Expected <contacts><contact>...</contact></contacts> or <contact>...</contact>');
          }

          resolve(contacts);
        } catch (error) {
          reject(new Error(`XML structure parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });
  }

  /**
   * Parse TSV contacts
   */
  private parseTSVContacts(content: string): any[] {
    try {
      // TSV is just CSV with tab delimiter
      return this.parseCSVWithDelimiter(content, '\t');
    } catch (error) {
      throw new Error(`TSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse YAML contacts
   */
  private parseYAMLContacts(content: string): any[] {
    try {
      const parsed = yaml.load(content) as any;

      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.contacts && Array.isArray(parsed.contacts)) {
        return parsed.contacts;
      } else if (parsed.data && Array.isArray(parsed.data)) {
        return parsed.data;
      } else {
        throw new Error('Invalid YAML format. Expected array or object with contacts/data property.');
      }
    } catch (error) {
      throw new Error(`YAML parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhanced CSV parser with custom delimiter support
   */
  private parseCSVWithDelimiter(content: string, delimiter: string = ','): any[] {
    try {
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error('File must contain at least a header row and one data row');
      }

      const headers = this.parseCSVLineWithDelimiter(lines[0], delimiter).map(h => h.trim());
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLineWithDelimiter(lines[i], delimiter);
        if (values.length > 0 && values.some(v => v.trim())) {
          const row: any = {};
          headers.forEach((header, index) => {
            row[header.toLowerCase().trim()] = values[index]?.trim() || '';
          });
          rows.push(row);
        }
      }

      return rows;
    } catch (error) {
      throw new Error(`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseCSVLineWithDelimiter(line: string, delimiter: string = ','): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Validate and transform contact data
   */
  private async validateAndTransformContact(data: any, row: number): Promise<Contact> {
    const errors: string[] = [];

    // Required fields validation
    if (!data.email || typeof data.email !== 'string' || !/\S+@\S+\.\S+/.test(data.email)) {
      errors.push('Valid email is required');
    }
    if (!data.company || typeof data.company !== 'string') {
      errors.push('Company is required and must be a string');
    }

    // Optional field validation
    if (data.status && !['lead', 'prospect', 'customer', 'churned'].includes(data.status)) {
      errors.push('Status must be one of: lead, prospect, customer, churned');
    }
    if (data.interestLevel && !['hot', 'medium', 'low', 'cold'].includes(data.interestLevel)) {
      errors.push('Interest level must be one of: hot, medium, low, cold');
    }

    if (errors.length > 0) {
      throw new Error(`Row ${row}: ${errors.join(', ')}`);
    }

    // Transform and create contact object
    const firstName = data.firstName || data.name?.split(' ')[0] || '';
    const lastName = data.lastName || data.name?.split(' ').slice(1).join(' ') || '';

    const contact: Contact = {
      id: data.id || `imported-contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      firstName,
      lastName,
      name: data.name || `${firstName} ${lastName}`,
      email: data.email,
      phone: data.phone,
      title: data.title || '',
      company: data.company,
      industry: data.industry,
      status: data.status || 'lead',
      interestLevel: data.interestLevel || 'medium',
      sources: data.sources ? (Array.isArray(data.sources) ? data.sources : data.sources.split(',').map((s: string) => s.trim())) : ['Import'],
      notes: data.notes || '',
      tags: data.tags ? (Array.isArray(data.tags) ? data.tags : data.tags.split(',').map((t: string) => t.trim())) : undefined,
      customFields: data.customFields || {},
      socialProfiles: data.socialProfiles || {},
      avatarSrc: data.avatarSrc,
      aiScore: data.aiScore ? Number(data.aiScore) : undefined,
      lastConnected: data.lastConnected,
      isFavorite: Boolean(data.isFavorite),
      isTeamMember: Boolean(data.isTeamMember),
      role: data.role,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date()
    };

    return contact;
  }

  /**
   * Utility function to chunk arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export const enhancedContactImportService = new EnhancedContactImportService();