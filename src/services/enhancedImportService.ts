/**
 * Enhanced Import Service - Advanced deal/contact import with AI enrichment
 * Extends basic ImportService with AI-powered features, duplicate detection, and enterprise capabilities
 */

import { Deal } from '../types';
import { Contact } from '../types/contact';
import { importService, ImportResult, ImportError, ImportProgress } from './importService';

// Re-export types for use in other services
export type { ImportResult, ImportError, ImportProgress };
import { getSmartAIOrchestrator } from './smartAIOrchestrator';
import { getSupabaseService } from './supabaseService';
import { getMonitoringService } from './monitoringService';

export interface AIEnrichmentOptions {
  enrichCompanyData: boolean;
  enrichContactData: boolean;
  generateDealInsights: boolean;
  autoCategorize: boolean;
  predictDealValue: boolean;
  enhanceWithWebResearch: boolean;
}

export interface EnrichedDeal extends Deal {
  aiInsights?: string[];
  predictedValue?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  recommendedActions?: string[];
  enrichedCompanyData?: {
    industry?: string;
    size?: string;
    revenue?: string;
    competitors?: string[];
  };
}

export interface DuplicateResolution {
  strategy: 'skip' | 'update' | 'merge' | 'create_new';
  mergeFields?: string[];
  prioritySource?: 'existing' | 'import';
}

export interface DuplicateGroup {
  imported: Deal | Contact;
  existing: (Deal | Contact)[];
  resolution: DuplicateResolution;
}

export interface DuplicateResolutionResult {
  duplicates: DuplicateGroup[];
  uniques: (Deal | Contact)[];
  resolutionStrategy: DuplicateResolution;
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'format' | 'range' | 'custom';
  validator: (value: any) => boolean;
  transformer?: (value: any) => any;
  errorMessage: string;
}

export interface DataMapping {
  sourceField: string;
  targetField: string;
  transformation?: (value: any) => any;
  validation?: ValidationRule[];
}

export interface BatchConfig {
  batchSize: number;
  concurrency: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface DetailedProgress extends ImportProgress {
  phase: 'parsing' | 'validating' | 'enriching' | 'deduplicating' | 'saving';
  phaseProgress: number;
  estimatedTimeRemaining?: number;
  currentItem?: string;
  errors: ImportError[];
  warnings: string[];
}

class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      this.permits--;
      resolve();
    }
  }

  async waitForAll(): Promise<void> {
    while (this.permits < (this as any).initialPermits || this.waiting.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}

class ProgressTracker {
  private progressCallbacks: Set<(progress: DetailedProgress) => void> = new Set();
  private startTime: number = Date.now();

  updateProgress(update: Partial<DetailedProgress>): void {
    const progress: DetailedProgress = {
      current: 0,
      total: 0,
      status: 'parsing',
      phase: 'parsing',
      phaseProgress: 0,
      errors: [],
      warnings: [],
      ...update
    };

    // Calculate estimated time remaining
    if (progress.total > 0 && progress.current > 0) {
      const elapsed = Date.now() - this.startTime;
      const rate = progress.current / elapsed;
      const remaining = progress.total - progress.current;
      progress.estimatedTimeRemaining = remaining / rate;
    }

    this.progressCallbacks.forEach(callback => callback(progress));
  }

  subscribe(callback: (progress: DetailedProgress) => void): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }
}

class EnhancedImportService {
  private smartAI = getSmartAIOrchestrator();
  private supabase = getSupabaseService();
  private monitoring = getMonitoringService();
  private validationRules: Map<string, ValidationRule[]> = new Map();
  private dataMappings: Map<string, DataMapping[]> = new Map();

  /**
   * Import deals with AI-powered enrichment
   */
  async importDealsWithAI(
    fileContent: string,
    format: 'json' | 'csv',
    enrichmentOptions: AIEnrichmentOptions,
    onProgress?: (progress: DetailedProgress) => void
  ): Promise<ImportResult<EnrichedDeal>> {
    const progressTracker = new ProgressTracker();
    if (onProgress) {
      progressTracker.subscribe(onProgress);
    }

    try {
      progressTracker.updateProgress({
        status: 'parsing',
        phase: 'parsing',
        message: 'Parsing file...'
      });

      // Parse basic data
      const basicResult = await importService.importDeals(fileContent, format, (progress) => {
        progressTracker.updateProgress({
          ...progress,
          phase: 'parsing'
        });
      });

      if (basicResult.successCount === 0) {
        return basicResult as ImportResult<EnrichedDeal>;
      }

      progressTracker.updateProgress({
        current: 0,
        total: basicResult.success.length,
        status: 'processing',
        phase: 'enriching',
        message: 'AI enriching deals...'
      });

      // AI enrichment phase
      const enrichedDeals = await Promise.all(
        basicResult.success.map(async (deal, index) => {
          progressTracker.updateProgress({
            current: index + 1,
            total: basicResult.success.length,
            phase: 'enriching',
            phaseProgress: ((index + 1) / basicResult.success.length) * 100,
            currentItem: deal.title,
            message: `AI enriching: ${deal.title}`
          });

          return await this.enrichDealWithAI(deal, enrichmentOptions);
        })
      );

      progressTracker.updateProgress({
        current: basicResult.success.length,
        total: basicResult.success.length,
        status: 'complete',
        phase: 'enriching',
        message: `AI enrichment complete: ${enrichedDeals.length} deals enriched`
      });

      return {
        ...basicResult,
        success: enrichedDeals
      };
    } catch (error) {
      progressTracker.updateProgress({
        status: 'error',
        phase: 'enriching',
        message: 'AI enrichment failed'
      });
      throw error;
    }
  }

  /**
   * Enrich a single deal with AI
   */
  private async enrichDealWithAI(deal: Deal, options: AIEnrichmentOptions): Promise<EnrichedDeal> {
    const enriched: EnrichedDeal = { ...deal };

    try {
      // Company data enrichment
      if (options.enrichCompanyData) {
        const companyData = await this.smartAI.executeTask('enrichment', {
          companyName: deal.company,
          dealContext: deal.title
        });

        if (companyData.success) {
          enriched.enrichedCompanyData = companyData.data;
        }
      }

      // Deal insights generation
      if (options.generateDealInsights) {
        const insights = await this.smartAI.executeTask('deal_health', {
          dealId: deal.id,
          dealData: {
            title: deal.title,
            company: deal.company,
            value: deal.value,
            stage: deal.stage
          }
        });

        if (insights.success) {
          enriched.aiInsights = insights.data.actions || [];
          enriched.riskLevel = insights.data.status === 'Red' ? 'high' :
                              insights.data.status === 'Yellow' ? 'medium' : 'low';
          enriched.recommendedActions = insights.data.actions || [];
        }
      }

      // Deal value prediction
      if (options.predictDealValue && deal.stage !== 'closed-won') {
        const prediction = await this.smartAI.executeTask('prediction', {
          deal: {
            title: deal.title,
            company: deal.company,
            currentValue: deal.value,
            stage: deal.stage
          }
        });

        if (prediction.success) {
          enriched.predictedValue = prediction.data.forecasts?.[0]?.predictedValue || deal.value;
        }
      }

      // Web research enhancement
      if (options.enhanceWithWebResearch) {
        const research = await this.smartAI.executeTask('web_research', {
          contactId: 'temp', // Would need actual contact ID
          query: `${deal.company} ${deal.title} deal news`,
          context: 'deal_intelligence'
        });

        if (research.success && research.data.findings) {
          enriched.aiInsights = [
            ...(enriched.aiInsights || []),
            ...research.data.findings
          ];
        }
      }

    } catch (error) {
      console.warn('AI enrichment failed for deal:', deal.title, error);
      // Continue with unenriched deal
    }

    return enriched;
  }

  /**
   * Smart duplicate detection and resolution
   */
  async detectAndResolveDuplicates(
    importedDeals: Deal[],
    existingDeals: Deal[],
    resolutionStrategy: DuplicateResolution
  ): Promise<DuplicateResolutionResult> {
    const duplicates: DuplicateGroup[] = [];
    const uniques: Deal[] = [];

    for (const imported of importedDeals) {
      const matches = this.findPotentialDuplicates(imported, existingDeals);

      if (matches.length > 0) {
        duplicates.push({
          imported,
          existing: matches,
          resolution: resolutionStrategy
        });
      } else {
        uniques.push(imported);
      }
    }

    return { duplicates, uniques, resolutionStrategy };
  }

  /**
   * Find potential duplicates using fuzzy matching
   */
  private findPotentialDuplicates(imported: Deal, existing: Deal[]): Deal[] {
    const matches: Deal[] = [];

    for (const existingDeal of existing) {
      let score = 0;

      // Exact company match
      if (imported.company?.toLowerCase() === existingDeal.company?.toLowerCase()) {
        score += 50;
      }

      // Fuzzy title match
      if (imported.title && existingDeal.title) {
        const titleSimilarity = this.calculateStringSimilarity(
          imported.title.toLowerCase(),
          existingDeal.title.toLowerCase()
        );
        if (titleSimilarity > 0.8) {
          score += 30;
        }
      }

      // Value proximity (within 10%)
      if (Math.abs(imported.value - existingDeal.value) / Math.max(imported.value, existingDeal.value) < 0.1) {
        score += 20;
      }

      if (score > 60) { // Threshold for potential duplicate
        matches.push(existingDeal);
      }
    }

    return matches;
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
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
   * Add custom validation rule
   */
  addValidationRule(entityType: string, rule: ValidationRule): void {
    const rules = this.validationRules.get(entityType) || [];
    rules.push(rule);
    this.validationRules.set(entityType, rules);
  }

  /**
   * Set data mapping configuration
   */
  setDataMapping(entityType: string, mappings: DataMapping[]): void {
    this.dataMappings.set(entityType, mappings);
  }

  /**
   * Validate deal with business rules
   */
  async validateDealBusinessRules(deal: Deal): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Deal value vs company size validation
    if (deal.value > 1000000 && !deal.company.toLowerCase().includes('enterprise')) {
      warnings.push('High-value deal for non-enterprise company - consider verification');
    }

    // Probability vs stage validation
    if (deal.stage === 'closed-won' && deal.probability !== 100) {
      errors.push('Closed-won deals must have 100% probability');
    }

    if (deal.stage === 'closed-lost' && deal.probability !== 0) {
      errors.push('Closed-lost deals must have 0% probability');
    }

    // Date validation
    if (deal.dueDate && deal.dueDate < new Date()) {
      warnings.push('Deal due date is in the past - consider updating');
    }

    // Value range validation
    if (deal.value <= 0) {
      errors.push('Deal value must be greater than 0');
    }

    if (deal.value > 100000000) { // $100M
      warnings.push('Unusually high deal value - please verify');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Bulk import with batch processing
   */
  async importDealsBatch(
    deals: Deal[],
    config: BatchConfig,
    onBatchComplete?: (batch: Deal[], results: ImportResult<Deal>) => void
  ): Promise<ImportResult<Deal>> {
    const batches = this.chunkArray(deals, config.batchSize);
    const results: ImportResult<Deal>[] = [];
    const semaphore = new Semaphore(config.concurrency);

    for (const batch of batches) {
      await semaphore.acquire();

      this.processBatch(batch, config).then(result => {
        results.push(result);
        onBatchComplete?.(batch, result);
        semaphore.release();
      }).catch(error => {
        console.error('Batch processing failed:', error);
        semaphore.release();
      });
    }

    await semaphore.waitForAll();
    return this.aggregateBatchResults(results);
  }

  /**
   * Process a single batch with retry logic
   */
  private async processBatch(batch: Deal[], config: BatchConfig): Promise<ImportResult<Deal>> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.retryAttempts + 1; attempt++) {
      try {
        // Validate batch
        const validDeals: Deal[] = [];
        const errors: ImportError[] = [];

        for (let i = 0; i < batch.length; i++) {
          try {
            await this.validateDealBusinessRules(batch[i]);
            validDeals.push(batch[i]);
          } catch (error) {
            errors.push({
              row: i + 1,
              message: error instanceof Error ? error.message : 'Validation failed',
              data: batch[i]
            });
          }
        }

        // Save valid deals to database
        const savedDeals: Deal[] = [];
        for (const deal of validDeals) {
          try {
            const saved = await this.supabase.createDeal(deal);
            savedDeals.push(saved);
          } catch (error) {
            errors.push({
              row: batch.indexOf(deal) + 1,
              message: 'Database save failed',
              data: deal
            });
          }
        }

        return {
          success: savedDeals,
          errors,
          totalProcessed: batch.length,
          successCount: savedDeals.length,
          errorCount: errors.length
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Batch processing failed');

        if (attempt <= config.retryAttempts) {
          console.warn(`Batch attempt ${attempt} failed, retrying in ${config.retryDelay}ms:`, error);
          await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        }
      }
    }

    throw lastError || new Error('Batch processing failed after all retries');
  }

  /**
   * Utility: Chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Aggregate batch results
   */
  private aggregateBatchResults(results: ImportResult<Deal>[]): ImportResult<Deal> {
    return results.reduce((acc, result) => ({
      success: [...acc.success, ...result.success],
      errors: [...acc.errors, ...result.errors],
      totalProcessed: acc.totalProcessed + result.totalProcessed,
      successCount: acc.successCount + result.successCount,
      errorCount: acc.errorCount + result.errorCount
    }), {
      success: [],
      errors: [],
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0
    });
  }
}

// Singleton instance
let enhancedImportServiceInstance: EnhancedImportService | null = null;

export const getEnhancedImportService = (): EnhancedImportService => {
  if (!enhancedImportServiceInstance) {
    enhancedImportServiceInstance = new EnhancedImportService();
  }
  return enhancedImportServiceInstance;
};

export { EnhancedImportService };