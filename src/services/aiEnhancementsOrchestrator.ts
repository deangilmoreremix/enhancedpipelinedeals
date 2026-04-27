/**
 * AI Enhancements Orchestrator - Phase 7
 * Coordinates all AI enhancement services for seamless integration
 */

import { getDealScoringService } from './dealScoringService';
import { getCompetitorAnalysisService } from './competitorAnalysisService';
import { getAutomatedNoteTakingService } from './automatedNoteTakingService';
import { getAIChatbotService } from './aiChatbotService';
import { getDataEnrichmentService } from './dataEnrichmentService';
import { getRecordClassificationService } from './recordClassificationService';
import { getCustomAIPromptService } from './customAIPromptService';
import { getFeatureFlagService } from './featureFlagService';
import { DealScoring, CompetitorAnalysis, AutomatedNote, DataEnrichment, RecordClassification, CustomAIPrompt } from '../types';

export class AIEnhancementsOrchestrator {
  private dealScoring = getDealScoringService();
  private competitorAnalysis = getCompetitorAnalysisService();
  private noteTaking = getAutomatedNoteTakingService();
  private chatbot = getAIChatbotService();
  private dataEnrichment = getDataEnrichmentService();
  private recordClassification = getRecordClassificationService();
  private customPrompts = getCustomAIPromptService();
  private featureFlags = getFeatureFlagService();

  // Deal Scoring
  async scoreDeal(dealId: string): Promise<DealScoring | null> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_deal_scoring'))) {
      return null;
    }

    try {
      return await this.dealScoring.scoreDeal(dealId);
    } catch (error) {
      console.error('Deal scoring failed:', error);
      return null;
    }
  }

  async getDealScore(dealId: string): Promise<DealScoring | null> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_deal_scoring'))) {
      return null;
    }

    return await this.dealScoring.getScoringResult(dealId);
  }

  // Competitor Analysis
  async analyzeCompetitors(dealId: string): Promise<CompetitorAnalysis | null> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_competitor_analysis'))) {
      return null;
    }

    try {
      return await this.competitorAnalysis.analyzeCompetitors(dealId);
    } catch (error) {
      console.error('Competitor analysis failed:', error);
      return null;
    }
  }

  async getCompetitorAnalysis(dealId: string): Promise<CompetitorAnalysis | null> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_competitor_analysis'))) {
      return null;
    }

    return await this.competitorAnalysis.getAnalysisResult(dealId);
  }

  // Deal Insights (combines scoring, analysis, and recommendations)
  async generateDealInsights(dealId: string): Promise<{
    scoring?: DealScoring;
    competitorAnalysis?: CompetitorAnalysis;
    insights?: any;
  } | null> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_deal_insights'))) {
      return null;
    }

    try {
      const [scoring, analysis] = await Promise.all([
        this.scoreDeal(dealId),
        this.analyzeCompetitors(dealId)
      ]);

      // Generate comprehensive insights using AI
      const insights = await this.generateComprehensiveInsights(dealId, scoring, analysis);

      return {
        scoring: scoring || undefined,
        competitorAnalysis: analysis || undefined,
        insights
      };
    } catch (error) {
      console.error('Deal insights generation failed:', error);
      return null;
    }
  }

  // Automated Note Taking
  async generateNotes(
    dealId: string,
    contactId: string,
    communicationId: string,
    communication: any
  ): Promise<AutomatedNote | null> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_automated_notes'))) {
      return null;
    }

    try {
      return await this.noteTaking.generateNotes(dealId, contactId, communicationId, communication);
    } catch (error) {
      console.error('Automated note taking failed:', error);
      return null;
    }
  }

  async getNotes(communicationId: string): Promise<AutomatedNote | null> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_automated_notes'))) {
      return null;
    }

    return await this.noteTaking.getNotes(communicationId);
  }

  // AI Chatbot
  async startChatbotSession(userId: string, workspaceId: string): Promise<any> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_chatbot'))) {
      throw new Error('AI Chatbot feature is not enabled');
    }

    return await this.chatbot.startSession(userId, workspaceId);
  }

  async processChatbotMessage(sessionId: string, message: string, pageContext?: any): Promise<any> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_chatbot'))) {
      throw new Error('AI Chatbot feature is not enabled');
    }

    return await this.chatbot.processMessage(sessionId, message, pageContext);
  }

  async getChatbotSession(sessionId: string): Promise<any> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_chatbot'))) {
      return null;
    }

    return await this.chatbot.getSession(sessionId);
  }

  // Data Enrichment
  async enrichEntity(
    entityId: string,
    entityType: 'contact' | 'company' | 'deal',
    enrichmentType: 'social' | 'firmographic' | 'technographic' | 'intent' | 'news'
  ): Promise<DataEnrichment | null> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_data_enrichment'))) {
      return null;
    }

    try {
      return await this.dataEnrichment.enrichEntity(entityId, entityType, enrichmentType);
    } catch (error) {
      console.error('Data enrichment failed:', error);
      return null;
    }
  }

  async bulkEnrichEntities(
    entityIds: string[],
    entityType: 'contact' | 'company' | 'deal',
    enrichmentType: 'social' | 'firmographic' | 'technographic' | 'intent' | 'news'
  ): Promise<DataEnrichment[]> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_data_enrichment'))) {
      return [];
    }

    try {
      return await this.dataEnrichment.bulkEnrichEntities(entityIds, entityType, enrichmentType);
    } catch (error) {
      console.error('Bulk data enrichment failed:', error);
      return [];
    }
  }

  // Record Classification
  async classifyRecord(
    entityId: string,
    entityType: 'contact' | 'company' | 'deal',
    classificationSchema?: any
  ): Promise<RecordClassification | null> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_record_classification'))) {
      return null;
    }

    try {
      return await this.recordClassification.classifyRecord(entityId, entityType, classificationSchema);
    } catch (error) {
      console.error('Record classification failed:', error);
      return null;
    }
  }

  async getClassification(entityId: string, entityType: string): Promise<RecordClassification | null> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_record_classification'))) {
      return null;
    }

    return await this.recordClassification.getClassification(entityId, entityType);
  }

  // Custom AI Prompts
  async createCustomPrompt(promptData: Omit<CustomAIPrompt, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'performanceMetrics'>): Promise<CustomAIPrompt | null> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_custom_prompts'))) {
      return null;
    }

    try {
      return await this.customPrompts.createPrompt(promptData);
    } catch (error) {
      console.error('Custom prompt creation failed:', error);
      return null;
    }
  }

  async executeCustomPrompt(
    promptId: string,
    variables: Record<string, any>,
    userId: string
  ): Promise<any> {
    if (!(await this.featureFlags.isFeatureEnabled('ai_custom_prompts'))) {
      throw new Error('Custom AI prompts feature is not enabled');
    }

    return await this.customPrompts.executePrompt(promptId, variables, userId);
  }

  // Batch operations for efficiency
  async processDealForAI(dealId: string): Promise<{
    scoring?: DealScoring;
    competitorAnalysis?: CompetitorAnalysis;
    insights?: any;
    enriched?: boolean;
  }> {
    const results: any = {};

    // Check which features are enabled
    const featuresEnabled = await Promise.all([
      this.featureFlags.isFeatureEnabled('ai_deal_scoring'),
      this.featureFlags.isFeatureEnabled('ai_competitor_analysis'),
      this.featureFlags.isFeatureEnabled('ai_deal_insights'),
      this.featureFlags.isFeatureEnabled('ai_data_enrichment')
    ]);

    const [scoringEnabled, competitorEnabled, insightsEnabled, enrichmentEnabled] = featuresEnabled;

    try {
      // Run enabled features in parallel
      const promises = [];

      if (scoringEnabled) {
        promises.push(
          this.dealScoring.scoreDeal(dealId).then(result => {
            results.scoring = result;
          }).catch(error => console.error('Scoring failed:', error))
        );
      }

      if (competitorEnabled) {
        promises.push(
          this.competitorAnalysis.analyzeCompetitors(dealId).then(result => {
            results.competitorAnalysis = result;
          }).catch(error => console.error('Competitor analysis failed:', error))
        );
      }

      if (enrichmentEnabled) {
        promises.push(
          this.dataEnrichment.enrichEntity(dealId, 'deal', 'firmographic').then(result => {
            results.enriched = !!result;
          }).catch(error => console.error('Enrichment failed:', error))
        );
      }

      await Promise.all(promises);

      // Generate insights if both scoring and analysis are available
      if (insightsEnabled && results.scoring && results.competitorAnalysis) {
        results.insights = await this.generateComprehensiveInsights(dealId, results.scoring, results.competitorAnalysis);
      }

    } catch (error) {
      console.error('Batch deal processing failed:', error);
    }

    return results;
  }

  // Comprehensive insights generation
  private async generateComprehensiveInsights(
    dealId: string,
    scoring?: DealScoring,
    competitorAnalysis?: CompetitorAnalysis
  ): Promise<any> {
    try {
      // Get deal and contact data
      const supabaseService = (await import('./supabaseService')).getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data: deal } = await supabase
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .single();

      const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', deal.contactId || deal.contact_id)
        .single();

      // Get timeline data
      const { data: timeline } = await supabase
        .from('deal_activities')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(15);

      // Use smart AI orchestrator for insights
      const { getSmartAIOrchestrator } = await import('./smartAIOrchestrator');
      const aiOrchestrator = getSmartAIOrchestrator();

      const result = await aiOrchestrator.executeTask('deal_insights', {
        dealId,
        deal,
        contact,
        timeline,
        scoring,
        competitorAnalysis
      });

      return result.success ? result.data : null;
    } catch (error) {
      console.error('Comprehensive insights generation failed:', error);
      return null;
    }
  }

  // Analytics and reporting
  async getAIEnhancementsAnalytics(): Promise<{
    dealScoring: any;
    competitorAnalysis: any;
    noteTaking: any;
    chatbot: any;
    dataEnrichment: any;
    recordClassification: any;
    customPrompts: any;
  }> {
    try {
      const [
        dealScoringStats,
        competitorStats,
        noteTakingStats,
        chatbotStats,
        enrichmentStats,
        classificationStats,
        promptStats
      ] = await Promise.all([
        this.dealScoring.getScoringStatistics(),
        this.competitorAnalysis.getAnalysisStatistics(),
        this.noteTaking.getStatistics(),
        this.chatbot.getStatistics(),
        this.dataEnrichment.getStatistics(),
        this.recordClassification.getClassificationStatistics('deal'), // Default to deal stats
        this.customPrompts.getStatistics()
      ]);

      return {
        dealScoring: dealScoringStats,
        competitorAnalysis: competitorStats,
        noteTaking: noteTakingStats,
        chatbot: chatbotStats,
        dataEnrichment: enrichmentStats,
        recordClassification: classificationStats,
        customPrompts: promptStats
      };
    } catch (error) {
      console.error('Failed to get AI enhancements analytics:', error);
      return {
        dealScoring: {},
        competitorAnalysis: {},
        noteTaking: {},
        chatbot: {},
        dataEnrichment: {},
        recordClassification: {},
        customPrompts: {}
      };
    }
  }

  // Feature flag management
  async getFeatureFlags(): Promise<any[]> {
    return await this.featureFlags.getAllFeatureFlags();
  }

  async updateFeatureFlag(featureKey: string, enabled: boolean, rolloutPercentage: number): Promise<boolean> {
    return await this.featureFlags.updateFeatureFlag(featureKey, { enabled, rollout_percentage: rolloutPercentage });
  }

  // Health check for all AI services
  async healthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'down';
    services: Record<string, 'healthy' | 'degraded' | 'down'>;
    details: Record<string, any>;
  }> {
    const services = {
      dealScoring: this.dealScoring,
      competitorAnalysis: this.competitorAnalysis,
      noteTaking: this.noteTaking,
      chatbot: this.chatbot,
      dataEnrichment: this.dataEnrichment,
      recordClassification: this.recordClassification,
      customPrompts: this.customPrompts
    };

    const results: Record<string, 'healthy' | 'degraded' | 'down'> = {};
    const details: Record<string, any> = {};
    let healthyCount = 0;

    for (const [name, service] of Object.entries(services)) {
      try {
        // Each service should have a health check method or statistics method
        const stats = await (service as any).getStatistics?.();
        if (stats && Object.keys(stats).length > 0) {
          results[name] = 'healthy';
          details[name] = stats;
          healthyCount++;
        } else {
          results[name] = 'degraded';
          details[name] = { error: 'No statistics available' };
        }
      } catch (error) {
        results[name] = 'down';
        details[name] = { error: error.message };
      }
    }

    const totalServices = Object.keys(services).length;
    const overall = healthyCount === totalServices ? 'healthy' :
                   healthyCount >= totalServices * 0.5 ? 'degraded' : 'down';

    return {
      overall,
      services: results,
      details
    };
  }
}

// Singleton instance
let aiEnhancementsOrchestrator: AIEnhancementsOrchestrator | null = null;

export const getAIEnhancementsOrchestrator = (): AIEnhancementsOrchestrator => {
  if (!aiEnhancementsOrchestrator) {
    aiEnhancementsOrchestrator = new AIEnhancementsOrchestrator();
  }
  return aiEnhancementsOrchestrator;
};