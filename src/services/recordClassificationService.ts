/**
 * Record Classification Service - AI-powered record categorization
 * Automatically classifies contacts, companies, and deals into categories
 */

import { getSmartAIOrchestrator } from './smartAIOrchestrator';
import { getSupabaseService } from './supabaseService';
import { RecordClassification, Classification } from '../types';

export class RecordClassificationService {
  private aiOrchestrator = getSmartAIOrchestrator();

  /**
   * Classify a record
   */
  async classifyRecord(
    entityId: string,
    entityType: 'contact' | 'company' | 'deal',
    classificationSchema?: any
  ): Promise<RecordClassification> {
    try {
      // Get entity data from Supabase
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      let entity: any = null;
      let tableName = '';

      switch (entityType) {
        case 'contact':
          tableName = 'contacts';
          break;
        case 'company':
          tableName = 'companies';
          break;
        case 'deal':
          tableName = 'deals';
          break;
      }

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', entityId)
        .single();

      if (error || !data) {
        throw new Error(`${entityType} not found: ${entityId}`);
      }

      entity = data;

      // Use default classification schema if none provided
      const schema = classificationSchema || this.getDefaultClassificationSchema(entityType);

      // Execute AI classification
      const result = await this.aiOrchestrator.executeTask('record_classification', {
        entity,
        entityType,
        classificationSchema: schema
      });

      if (!result.success) {
        throw new Error(`AI classification failed: ${result.error}`);
      }

      // Transform and validate the response
      const classificationData = this.transformClassificationResponse(
        result.data,
        entityId,
        entityType
      );

      // Save classification result
      await this.saveClassificationResult(classificationData);

      // Update entity with classification tags
      await this.updateEntityWithClassification(entityId, entityType, classificationData);

      return classificationData;
    } catch (error) {
      console.error('Record classification failed:', error);
      throw error;
    }
  }

  /**
   * Get classification for a record
   */
  async getClassification(entityId: string, entityType: string): Promise<RecordClassification | null> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('record_classifications')
        .select('*')
        .eq('entity_id', entityId)
        .eq('entity_type', entityType)
        .order('classified_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return this.transformDatabaseResult(data);
    } catch (error) {
      console.error('Failed to get classification:', error);
      return null;
    }
  }

  /**
   * Bulk classify records
   */
  async bulkClassifyRecords(
    entityIds: string[],
    entityType: 'contact' | 'company' | 'deal',
    classificationSchema?: any
  ): Promise<RecordClassification[]> {
    const results: RecordClassification[] = [];

    // Process in batches to avoid overwhelming the AI service
    const batchSize = 10;
    for (let i = 0; i < entityIds.length; i += batchSize) {
      const batch = entityIds.slice(i, i + batchSize);
      const batchPromises = batch.map(id =>
        this.classifyRecord(id, entityType, classificationSchema).catch(error => {
          console.error(`Failed to classify ${entityType} ${id}:`, error);
          return null;
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => result !== null));

      // Small delay between batches
      if (i + batchSize < entityIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get classification statistics by category
   */
  async getClassificationStatistics(entityType: string): Promise<{
    totalClassified: number;
    categoryDistribution: Record<string, number>;
    averageConfidence: number;
    topTags: Array<{ tag: string; count: number }>;
  }> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('record_classifications')
        .select('primary_category, secondary_categories, classifications, confidence')
        .eq('entity_type', entityType);

      if (error) throw error;

      const totalClassified = data.length;

      const categoryDistribution = data.reduce((acc, item) => {
        const category = item.primary_category;
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const averageConfidence = totalClassified > 0
        ? data.reduce((sum, item) => sum + item.confidence, 0) / totalClassified
        : 0;

      // Count tag frequency
      const tagCounts: Record<string, number> = {};
      data.forEach(item => {
        (item.classifications || []).forEach((classification: any) => {
          (classification.tags || []).forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        });
      });

      const topTags = Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));

      return {
        totalClassified,
        categoryDistribution,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        topTags
      };
    } catch (error) {
      console.error('Failed to get classification statistics:', error);
      return {
        totalClassified: 0,
        categoryDistribution: {},
        averageConfidence: 0,
        topTags: []
      };
    }
  }

  /**
   * Retrain classification model with feedback
   */
  async retrainWithFeedback(
    entityId: string,
    entityType: string,
    correctClassification: RecordClassification
  ): Promise<void> {
    try {
      // Update the classification with user feedback
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { error } = await supabase
        .from('record_classifications')
        .update({
          primary_category: correctClassification.primaryCategory,
          secondary_categories: correctClassification.secondaryCategories,
          classifications: correctClassification.classifications,
          confidence: correctClassification.confidence,
          user_feedback: true,
          updated_at: new Date().toISOString()
        })
        .eq('entity_id', entityId)
        .eq('entity_type', entityType);

      if (error) throw error;

      // In production, this would trigger model retraining
      // For now, just log the feedback
      console.log('Classification feedback recorded for retraining:', {
        entityId,
        entityType,
        correctClassification
      });
    } catch (error) {
      console.error('Failed to record classification feedback:', error);
      throw error;
    }
  }

  private getDefaultClassificationSchema(entityType: string): any {
    switch (entityType) {
      case 'contact':
        return {
          categories: [
            'Decision Maker',
            'Influencer',
            'End User',
            'Gatekeeper',
            'Champion'
          ],
          industries: [
            'Technology',
            'Healthcare',
            'Finance',
            'Manufacturing',
            'Retail',
            'Education',
            'Government'
          ],
          companySize: [
            'Startup (1-10)',
            'Small (11-50)',
            'Medium (51-200)',
            'Large (201-1000)',
            'Enterprise (1000+)'
          ]
        };

      case 'company':
        return {
          categories: [
            'Technology',
            'Healthcare',
            'Financial Services',
            'Manufacturing',
            'Retail',
            'Professional Services',
            'Education',
            'Government',
            'Non-profit'
          ],
          growthStage: [
            'Startup',
            'Growth',
            'Mature',
            'Declining'
          ],
          businessModel: [
            'B2B',
            'B2C',
            'B2B2C',
            'Marketplace',
            'SaaS',
            'Consulting'
          ]
        };

      case 'deal':
        return {
          categories: [
            'New Business',
            'Expansion',
            'Renewal',
            'Upgrade',
            'Cross-sell',
            'Rescue'
          ],
          dealSize: [
            'Small (<$10K)',
            'Medium ($10K-$50K)',
            'Large ($50K-$100K)',
            'Enterprise (>$100K)'
          ],
          complexity: [
            'Simple',
            'Moderate',
            'Complex',
            'High-touch'
          ]
        };

      default:
        return {};
    }
  }

  private transformClassificationResponse(
    data: any,
    entityId: string,
    entityType: string
  ): RecordClassification {
    return {
      id: `classification_${Date.now()}_${Math.random()}`,
      entityId,
      entityType: entityType as 'contact' | 'company' | 'deal',
      classifications: (data.classifications || []).map((classification: any) => ({
        category: classification.category || 'Unknown',
        subcategory: classification.subcategory,
        confidence: Math.max(0, Math.min(100, classification.confidence || 50)),
        reasoning: classification.reasoning || '',
        tags: classification.tags || [],
        metadata: classification.metadata || {}
      })),
      primaryCategory: data.primaryCategory || data.classifications?.[0]?.category || 'Unknown',
      secondaryCategories: data.secondaryCategories || [],
      confidence: Math.max(0, Math.min(100, data.confidence || 50)),
      classifiedAt: new Date(),
      classifierVersion: '1.0.0'
    };
  }

  private transformDatabaseResult(data: any): RecordClassification {
    return {
      id: data.id,
      entityId: data.entity_id,
      entityType: data.entity_type,
      classifications: data.classifications || [],
      primaryCategory: data.primary_category,
      secondaryCategories: data.secondary_categories || [],
      confidence: data.confidence,
      classifiedAt: new Date(data.classified_at),
      classifierVersion: data.classifier_version
    };
  }

  private async saveClassificationResult(classification: RecordClassification): Promise<void> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const dbData = {
        id: classification.id,
        entity_id: classification.entityId,
        entity_type: classification.entityType,
        classifications: classification.classifications,
        primary_category: classification.primaryCategory,
        secondary_categories: classification.secondaryCategories,
        confidence: classification.confidence,
        classified_at: classification.classifiedAt.toISOString(),
        classifier_version: classification.classifierVersion,
        user_feedback: false
      };

      const { error } = await supabase
        .from('record_classifications')
        .upsert(dbData, { onConflict: 'entity_id,entity_type' });

      if (error) {
        console.error('Failed to save classification result:', error);
      }
    } catch (error) {
      console.error('Failed to save classification result:', error);
    }
  }

  private async updateEntityWithClassification(
    entityId: string,
    entityType: string,
    classification: RecordClassification
  ): Promise<void> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      // Collect all tags from classifications
      const allTags = classification.classifications.reduce((tags: string[], cls) => {
        return [...tags, ...(cls.tags || [])];
      }, []);

      // Add primary and secondary categories as tags
      allTags.push(classification.primaryCategory);
      allTags.push(...classification.secondaryCategories);

      // Remove duplicates
      const uniqueTags = [...new Set(allTags)];

      let tableName = '';
      switch (entityType) {
        case 'contact':
          tableName = 'contacts';
          break;
        case 'company':
          tableName = 'companies';
          break;
        case 'deal':
          tableName = 'deals';
          break;
      }

      const { error } = await supabase
        .from(tableName)
        .update({
          tags: uniqueTags,
          ai_classified: true,
          classification_confidence: classification.confidence,
          primary_category: classification.primaryCategory,
          updated_at: new Date().toISOString()
        })
        .eq('id', entityId);

      if (error) {
        console.error('Failed to update entity with classification:', error);
      }
    } catch (error) {
      console.error('Failed to update entity with classification:', error);
    }
  }

  /**
   * Get available classification schemas
   */
  getAvailableSchemas(): Array<{
    id: string;
    name: string;
    entityType: string;
    description: string;
    version: string;
  }> {
    return [
      {
        id: 'contact_bant',
        name: 'Contact BANT Classification',
        entityType: 'contact',
        description: 'Budget, Authority, Need, Timeline classification for contacts',
        version: '1.0.0'
      },
      {
        id: 'company_industry',
        name: 'Company Industry Classification',
        entityType: 'company',
        description: 'Industry, size, and growth stage classification',
        version: '1.0.0'
      },
      {
        id: 'deal_stage_priority',
        name: 'Deal Priority Classification',
        entityType: 'deal',
        description: 'Deal size, complexity, and priority classification',
        version: '1.0.0'
      },
      {
        id: 'contact_engagement',
        name: 'Contact Engagement Level',
        entityType: 'contact',
        description: 'Engagement and influence level classification',
        version: '1.0.0'
      }
    ];
  }

  /**
   * Validate classification schema
   */
  validateSchema(schema: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!schema.categories || !Array.isArray(schema.categories)) {
      errors.push('Schema must have a categories array');
    }

    if (!schema.categories?.length) {
      errors.push('Schema must have at least one category');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Singleton instance
let recordClassificationService: RecordClassificationService | null = null;

export const getRecordClassificationService = (): RecordClassificationService => {
  if (!recordClassificationService) {
    recordClassificationService = new RecordClassificationService();
  }
  return recordClassificationService;
};