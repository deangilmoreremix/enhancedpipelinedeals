/**
 * Data Enrichment Service - AI-powered data enrichment from public sources
 * Enriches contact, company, and deal records with additional data
 */

import { getSmartAIOrchestrator } from './smartAIOrchestrator';
import { getSupabaseService } from './supabaseService';
import { DataEnrichment } from '../types';

export class DataEnrichmentService {
  private aiOrchestrator = getSmartAIOrchestrator();

  /**
   * Enrich an entity with additional data
   */
  async enrichEntity(
    entityId: string,
    entityType: 'contact' | 'company' | 'deal',
    enrichmentType: 'social' | 'firmographic' | 'technographic' | 'intent' | 'news'
  ): Promise<DataEnrichment> {
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

      // Execute AI enrichment
      const result = await this.aiOrchestrator.executeTask('data_enrichment', {
        entity,
        entityType,
        enrichmentType
      });

      if (!result.success) {
        throw new Error(`AI enrichment failed: ${result.error}`);
      }

      // Transform and validate the response
      const enrichmentData = this.transformEnrichmentResponse(
        result.data,
        entityId,
        entityType,
        enrichmentType
      );

      // Save enrichment result
      await this.saveEnrichmentResult(enrichmentData);

      // Update the original entity with enriched data
      await this.updateEntityWithEnrichment(entityId, entityType, enrichmentData);

      return enrichmentData;
    } catch (error) {
      console.error('Data enrichment failed:', error);

      // Save failed enrichment attempt
      await this.saveFailedEnrichment(entityId, entityType, enrichmentType, error.message);

      throw error;
    }
  }

  /**
   * Get enrichment history for an entity
   */
  async getEnrichmentHistory(entityId: string, entityType: string): Promise<DataEnrichment[]> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('data_enrichments')
        .select('*')
        .eq('entity_id', entityId)
        .eq('entity_type', entityType)
        .order('last_updated', { ascending: false });

      if (error) throw error;

      return data.map(item => this.transformDatabaseResult(item));
    } catch (error) {
      console.error('Failed to get enrichment history:', error);
      return [];
    }
  }

  /**
   * Check if entity needs enrichment refresh
   */
  async needsRefresh(entityId: string, entityType: string, daysThreshold: number = 30): Promise<boolean> {
    try {
      const history = await this.getEnrichmentHistory(entityId, entityType);
      if (history.length === 0) return true;

      const latest = history[0];
      if (latest.status !== 'completed') return true;

      const daysSinceUpdate = (Date.now() - new Date(latest.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate > daysThreshold;
    } catch (error) {
      console.error('Failed to check refresh status:', error);
      return true;
    }
  }

  /**
   * Bulk enrich entities
   */
  async bulkEnrichEntities(
    entityIds: string[],
    entityType: 'contact' | 'company' | 'deal',
    enrichmentType: 'social' | 'firmographic' | 'technographic' | 'intent' | 'news'
  ): Promise<DataEnrichment[]> {
    const results: DataEnrichment[] = [];

    // Process in batches to avoid overwhelming the AI service
    const batchSize = 5;
    for (let i = 0; i < entityIds.length; i += batchSize) {
      const batch = entityIds.slice(i, i + batchSize);
      const batchPromises = batch.map(id =>
        this.enrichEntity(id, entityType, enrichmentType).catch(error => {
          console.error(`Failed to enrich ${entityType} ${id}:`, error);
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

  private transformEnrichmentResponse(
    data: any,
    entityId: string,
    entityType: string,
    enrichmentType: string
  ): DataEnrichment {
    return {
      id: `enrichment_${Date.now()}_${Math.random()}`,
      entityId,
      entityType: entityType as 'contact' | 'company' | 'deal',
      enrichmentType: enrichmentType as any,
      source: data.source || 'ai_generated',
      data: data.enrichedData || data.data || {},
      confidence: Math.max(0, Math.min(100, data.confidence || 50)),
      lastUpdated: new Date(),
      aiProvider: 'openai',
      status: 'completed'
    };
  }

  private transformDatabaseResult(data: any): DataEnrichment {
    return {
      id: data.id,
      entityId: data.entity_id,
      entityType: data.entity_type,
      enrichmentType: data.enrichment_type,
      source: data.source,
      data: data.data,
      confidence: data.confidence,
      lastUpdated: new Date(data.last_updated),
      aiProvider: data.ai_provider,
      cost: data.cost,
      status: data.status,
      error: data.error
    };
  }

  private async saveEnrichmentResult(enrichment: DataEnrichment): Promise<void> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const dbData = {
        id: enrichment.id,
        entity_id: enrichment.entityId,
        entity_type: enrichment.entityType,
        enrichment_type: enrichment.enrichmentType,
        source: enrichment.source,
        data: enrichment.data,
        confidence: enrichment.confidence,
        last_updated: enrichment.lastUpdated.toISOString(),
        ai_provider: enrichment.aiProvider,
        cost: enrichment.cost,
        status: enrichment.status,
        error: enrichment.error
      };

      const { error } = await supabase
        .from('data_enrichments')
        .upsert(dbData, { onConflict: 'id' });

      if (error) {
        console.error('Failed to save enrichment result:', error);
      }
    } catch (error) {
      console.error('Failed to save enrichment result:', error);
    }
  }

  private async saveFailedEnrichment(
    entityId: string,
    entityType: string,
    enrichmentType: string,
    error: string
  ): Promise<void> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const dbData = {
        id: `enrichment_${Date.now()}_${Math.random()}`,
        entity_id: entityId,
        entity_type: entityType,
        enrichment_type: enrichmentType,
        source: 'ai_service',
        data: {},
        confidence: 0,
        last_updated: new Date().toISOString(),
        ai_provider: 'openai',
        status: 'failed',
        error
      };

      const { error: dbError } = await supabase
        .from('data_enrichments')
        .insert(dbData);

      if (dbError) {
        console.error('Failed to save failed enrichment:', dbError);
      }
    } catch (error) {
      console.error('Failed to save failed enrichment:', error);
    }
  }

  private async updateEntityWithEnrichment(
    entityId: string,
    entityType: string,
    enrichment: DataEnrichment
  ): Promise<void> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      let tableName = '';
      let updateData: any = {};

      switch (entityType) {
        case 'contact':
          tableName = 'contacts';
          if (enrichment.enrichmentType === 'social') {
            updateData.social_profiles = enrichment.data.socialProfiles || {};
          }
          break;

        case 'company':
          tableName = 'companies';
          if (enrichment.enrichmentType === 'firmographic') {
            updateData = {
              ...updateData,
              employee_count: enrichment.data.employeeCount,
              revenue: enrichment.data.revenue,
              industry: enrichment.data.industry
            };
          }
          break;

        case 'deal':
          tableName = 'deals';
          // Deals might not need direct updates, but could store enrichment reference
          break;
      }

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from(tableName)
          .update(updateData)
          .eq('id', entityId);

        if (error) {
          console.error('Failed to update entity with enrichment:', error);
        }
      }
    } catch (error) {
      console.error('Failed to update entity with enrichment:', error);
    }
  }

  /**
   * Get enrichment statistics
   */
  async getStatistics(): Promise<{
    totalEnrichments: number;
    successRate: number;
    enrichmentTypeDistribution: Record<string, number>;
    averageConfidence: number;
    recentActivity: number;
  }> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('data_enrichments')
        .select('enrichment_type, confidence, status, last_updated');

      if (error) throw error;

      const totalEnrichments = data.length;
      const completedEnrichments = data.filter(item => item.status === 'completed').length;
      const successRate = totalEnrichments > 0 ? (completedEnrichments / totalEnrichments) * 100 : 0;

      const enrichmentTypeDistribution = data.reduce((acc, item) => {
        acc[item.enrichment_type] = (acc[item.enrichment_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const completedData = data.filter(item => item.status === 'completed');
      const averageConfidence = completedData.length > 0
        ? completedData.reduce((sum, item) => sum + item.confidence, 0) / completedData.length
        : 0;

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentActivity = data.filter(item =>
        new Date(item.last_updated) > oneDayAgo
      ).length;

      return {
        totalEnrichments,
        successRate: Math.round(successRate * 100) / 100,
        enrichmentTypeDistribution,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        recentActivity
      };
    } catch (error) {
      console.error('Failed to get enrichment statistics:', error);
      return {
        totalEnrichments: 0,
        successRate: 0,
        enrichmentTypeDistribution: {},
        averageConfidence: 0,
        recentActivity: 0
      };
    }
  }

  /**
   * Get enrichment sources and their reliability
   */
  getEnrichmentSources(): Array<{
    name: string;
    type: string;
    reliability: number;
    cost: number;
    description: string;
  }> {
    return [
      {
        name: 'LinkedIn',
        type: 'social',
        reliability: 0.9,
        cost: 0.01,
        description: 'Professional profiles and company pages'
      },
      {
        name: 'Crunchbase',
        type: 'firmographic',
        reliability: 0.95,
        cost: 0.02,
        description: 'Company funding, size, and executive data'
      },
      {
        name: 'BuiltWith',
        type: 'technographic',
        reliability: 0.85,
        cost: 0.015,
        description: 'Technology stack and tool usage'
      },
      {
        name: 'News APIs',
        type: 'news',
        reliability: 0.8,
        cost: 0.005,
        description: 'Recent company news and press releases'
      },
      {
        name: 'Social Listening',
        type: 'intent',
        reliability: 0.75,
        cost: 0.01,
        description: 'Social media sentiment and intent signals'
      }
    ];
  }
}

// Singleton instance
let dataEnrichmentService: DataEnrichmentService | null = null;

export const getDataEnrichmentService = (): DataEnrichmentService => {
  if (!dataEnrichmentService) {
    dataEnrichmentService = new DataEnrichmentService();
  }
  return dataEnrichmentService;
};