/**
 * Summary Generation Service - AI-powered content summarization
 * Generates executive summaries, detailed reports, and insights
 */

import { getSmartAIOrchestrator } from './smartAIOrchestrator';
import { getSupabaseService } from './supabaseService';
import { SummaryGeneration } from '../types';

export class SummaryGenerationService {
  private aiOrchestrator = getSmartAIOrchestrator();

  /**
   * Generate a summary for an entity
   */
  async generateSummary(
    entityId: string,
    entityType: 'contact' | 'company' | 'deal',
    summaryType: 'executive' | 'detailed' | 'bullet_points' | 'timeline' | 'risk_analysis'
  ): Promise<SummaryGeneration> {
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

      // Gather additional context based on entity type
      const context = await this.gatherEntityContext(entityId, entityType, entity);

      // Execute AI summary generation
      const result = await this.aiOrchestrator.executeTask('summary_generation', {
        entity: { ...entity, ...context },
        entityType,
        summaryType
      });

      if (!result.success) {
        throw new Error(`AI summary generation failed: ${result.error}`);
      }

      // Transform and validate the response
      const summaryData = this.transformSummaryResponse(
        result.data,
        entityId,
        entityType,
        summaryType
      );

      // Save summary to database
      await this.saveSummary(summaryData);

      return summaryData;
    } catch (error) {
      console.error('Summary generation failed:', error);
      throw error;
    }
  }

  /**
   * Get existing summary for an entity
   */
  async getSummary(
    entityId: string,
    entityType: string,
    summaryType?: string
  ): Promise<SummaryGeneration | null> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      let query = supabase
        .from('summary_generations')
        .select('*')
        .eq('entity_id', entityId)
        .eq('entity_type', entityType)
        .order('generated_at', { ascending: false });

      if (summaryType) {
        query = query.eq('summary_type', summaryType);
      }

      const { data, error } = await query.limit(1).single();

      if (error || !data) {
        return null;
      }

      return this.transformDatabaseResult(data);
    } catch (error) {
      console.error('Failed to get summary:', error);
      return null;
    }
  }

  /**
   * Get all summaries for an entity
   */
  async getEntitySummaries(entityId: string, entityType: string): Promise<SummaryGeneration[]> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('summary_generations')
        .select('*')
        .eq('entity_id', entityId)
        .eq('entity_type', entityType)
        .order('generated_at', { ascending: false });

      if (error) throw error;

      return data.map(item => this.transformDatabaseResult(item));
    } catch (error) {
      console.error('Failed to get entity summaries:', error);
      return [];
    }
  }

  /**
   * Check if summary needs refresh
   */
  async needsRefresh(
    entityId: string,
    entityType: string,
    summaryType: string,
    maxAgeHours: number = 24
  ): Promise<boolean> {
    try {
      const summary = await this.getSummary(entityId, entityType, summaryType);
      if (!summary) return true;

      const ageHours = (Date.now() - new Date(summary.generatedAt).getTime()) / (1000 * 60 * 60);
      return ageHours > maxAgeHours;
    } catch (error) {
      console.error('Failed to check summary refresh status:', error);
      return true;
    }
  }

  /**
   * Bulk generate summaries
   */
  async bulkGenerateSummaries(
    entityIds: string[],
    entityType: 'contact' | 'company' | 'deal',
    summaryType: 'executive' | 'detailed' | 'bullet_points' | 'timeline' | 'risk_analysis'
  ): Promise<SummaryGeneration[]> {
    const results: SummaryGeneration[] = [];

    // Process in batches to avoid overwhelming the AI service
    const batchSize = 5;
    for (let i = 0; i < entityIds.length; i += batchSize) {
      const batch = entityIds.slice(i, i + batchSize);
      const batchPromises = batch.map(id =>
        this.generateSummary(id, entityType, summaryType).catch(error => {
          console.error(`Failed to generate summary for ${entityType} ${id}:`, error);
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

  private async gatherEntityContext(entityId: string, entityType: string, entity: any): Promise<any> {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    const context: any = {};

    try {
      switch (entityType) {
        case 'contact':
          // Get recent communications
          const { data: communications } = await supabase
            .from('communication_records')
            .select('*')
            .eq('contact_id', entityId)
            .order('created_at', { ascending: false })
            .limit(10);
          context.recentCommunications = communications || [];

          // Get associated deals
          const { data: deals } = await supabase
            .from('deals')
            .select('id, title, stage, value, created_at')
            .eq('contact_id', entityId)
            .limit(5);
          context.associatedDeals = deals || [];
          break;

        case 'company':
          // Get contacts at company
          const { data: contacts } = await supabase
            .from('contacts')
            .select('id, name, title')
            .eq('company_id', entityId)
            .limit(10);
          context.contacts = contacts || [];

          // Get deals with company
          const { data: companyDeals } = await supabase
            .from('deals')
            .select('id, title, stage, value, created_at')
            .eq('company_id', entityId)
            .limit(10);
          context.deals = companyDeals || [];
          break;

        case 'deal':
          // Get contact info
          const { data: dealContact } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', entity.contact_id || entity.contactId)
            .single();
          context.contact = dealContact || {};

          // Get deal activities/timeline
          const { data: activities } = await supabase
            .from('deal_activities')
            .select('*')
            .eq('deal_id', entityId)
            .order('created_at', { ascending: false })
            .limit(20);
          context.timeline = activities || [];

          // Get communications
          const { data: dealCommunications } = await supabase
            .from('communication_records')
            .select('*')
            .eq('contact_id', entity.contact_id || entity.contactId)
            .order('created_at', { ascending: false })
            .limit(15);
          context.communications = dealCommunications || [];
          break;
      }
    } catch (error) {
      console.error('Failed to gather entity context:', error);
    }

    return context;
  }

  private transformSummaryResponse(
    data: any,
    entityId: string,
    entityType: string,
    summaryType: string
  ): SummaryGeneration {
    return {
      id: `summary_${Date.now()}_${Math.random()}`,
      entityId,
      entityType: entityType as 'contact' | 'company' | 'deal',
      summaryType: summaryType as any,
      content: data.content || '',
      keyInsights: data.keyInsights || [],
      recommendations: data.recommendations || [],
      generatedAt: new Date(),
      aiProvider: 'openai',
      modelVersion: 'gpt-4o',
      confidence: Math.max(0, Math.min(100, data.confidence || 50)),
      wordCount: data.content ? data.content.split(' ').length : 0
    };
  }

  private transformDatabaseResult(data: any): SummaryGeneration {
    return {
      id: data.id,
      entityId: data.entity_id,
      entityType: data.entity_type,
      summaryType: data.summary_type,
      content: data.content,
      keyInsights: data.key_insights || [],
      recommendations: data.recommendations || [],
      generatedAt: new Date(data.generated_at),
      aiProvider: data.ai_provider,
      modelVersion: data.model_version,
      confidence: data.confidence,
      wordCount: data.word_count
    };
  }

  private async saveSummary(summary: SummaryGeneration): Promise<void> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const dbData = {
        id: summary.id,
        entity_id: summary.entityId,
        entity_type: summary.entityType,
        summary_type: summary.summaryType,
        content: summary.content,
        key_insights: summary.keyInsights,
        recommendations: summary.recommendations,
        generated_at: summary.generatedAt.toISOString(),
        ai_provider: summary.aiProvider,
        model_version: summary.modelVersion,
        confidence: summary.confidence,
        word_count: summary.wordCount
      };

      const { error } = await supabase
        .from('summary_generations')
        .upsert(dbData, { onConflict: 'id' });

      if (error) {
        console.error('Failed to save summary:', error);
      }
    } catch (error) {
      console.error('Failed to save summary:', error);
    }
  }

  /**
   * Get summary statistics
   */
  async getStatistics(): Promise<{
    totalSummaries: number;
    averageConfidence: number;
    summaryTypeDistribution: Record<string, number>;
    entityTypeDistribution: Record<string, number>;
    recentActivity: number;
    averageWordCount: number;
  }> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('summary_generations')
        .select('summary_type, entity_type, confidence, word_count, generated_at');

      if (error) throw error;

      const totalSummaries = data.length;
      const averageConfidence = totalSummaries > 0
        ? data.reduce((sum, item) => sum + item.confidence, 0) / totalSummaries
        : 0;

      const averageWordCount = totalSummaries > 0
        ? data.reduce((sum, item) => sum + item.word_count, 0) / totalSummaries
        : 0;

      const summaryTypeDistribution = data.reduce((acc, item) => {
        acc[item.summary_type] = (acc[item.summary_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const entityTypeDistribution = data.reduce((acc, item) => {
        acc[item.entity_type] = (acc[item.entity_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentActivity = data.filter(item =>
        new Date(item.generated_at) > oneDayAgo
      ).length;

      return {
        totalSummaries,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        summaryTypeDistribution,
        entityTypeDistribution,
        recentActivity,
        averageWordCount: Math.round(averageWordCount)
      };
    } catch (error) {
      console.error('Failed to get summary statistics:', error);
      return {
        totalSummaries: 0,
        averageConfidence: 0,
        summaryTypeDistribution: {},
        entityTypeDistribution: {},
        recentActivity: 0,
        averageWordCount: 0
      };
    }
  }

  /**
   * Get available summary types with descriptions
   */
  getAvailableSummaryTypes(): Array<{
    type: string;
    name: string;
    description: string;
    useCase: string;
  }> {
    return [
      {
        type: 'executive',
        name: 'Executive Summary',
        description: 'High-level overview suitable for leadership and quick reviews',
        useCase: 'Board meetings, executive briefings, high-level decision making'
      },
      {
        type: 'detailed',
        name: 'Detailed Analysis',
        description: 'Comprehensive analysis with all relevant information and context',
        useCase: 'Deep dives, stakeholder presentations, detailed reviews'
      },
      {
        type: 'bullet_points',
        name: 'Bullet Point Summary',
        description: 'Key facts and takeaways in concise bullet point format',
        useCase: 'Quick references, email updates, status reports'
      },
      {
        type: 'timeline',
        name: 'Timeline Summary',
        description: 'Chronological summary of events and milestones',
        useCase: 'Progress tracking, historical analysis, timeline reports'
      },
      {
        type: 'risk_analysis',
        name: 'Risk Analysis',
        description: 'Focus on risks, opportunities, and strategic recommendations',
        useCase: 'Risk assessment, strategic planning, mitigation planning'
      }
    ];
  }
}

// Singleton instance
let summaryGenerationService: SummaryGenerationService | null = null;

export const getSummaryGenerationService = (): SummaryGenerationService => {
  if (!summaryGenerationService) {
    summaryGenerationService = new SummaryGenerationService();
  }
  return summaryGenerationService;
};