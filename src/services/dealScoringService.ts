/**
 * Deal Scoring Service - AI-powered deal qualification
 * Provides comprehensive scoring based on contact, company, engagement, and market factors
 */

import { getSmartAIOrchestrator } from './smartAIOrchestrator';
import { getSupabaseService } from './supabaseService';
import { DealScoring, ScoringFactor } from '../types';

export class DealScoringService {
  private aiOrchestrator = getSmartAIOrchestrator();

  /**
   * Score a deal using AI analysis
   */
  async scoreDeal(dealId: string): Promise<DealScoring> {
    try {
      // Get deal and contact data from Supabase
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      // Fetch deal data
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .single();

      if (dealError || !deal) {
        throw new Error(`Deal not found: ${dealId}`);
      }

      // Fetch contact data
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', deal.contactId || deal.contact_id)
        .single();

      // Fetch recent interactions
      const { data: interactions } = await supabase
        .from('communication_records')
        .select('*')
        .eq('contact_id', deal.contactId || deal.contact_id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Execute AI scoring
      const result = await this.aiOrchestrator.executeTask('deal_scoring', {
        dealId,
        deal,
        contact: contact || {},
        interactions: interactions || []
      });

      if (!result.success) {
        throw new Error(`AI scoring failed: ${result.error}`);
      }

      // Transform and validate the response
      const scoringData = this.transformScoringResponse(result.data, dealId);

      // Save scoring result to database
      await this.saveScoringResult(scoringData);

      return scoringData;
    } catch (error) {
      console.error('Deal scoring failed:', error);
      throw error;
    }
  }

  /**
   * Get cached scoring result
   */
  async getScoringResult(dealId: string): Promise<DealScoring | null> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('deal_scorings')
        .select('*')
        .eq('deal_id', dealId)
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return this.transformDatabaseResult(data);
    } catch (error) {
      console.error('Failed to get scoring result:', error);
      return null;
    }
  }

  /**
   * Get scoring factors for a deal
   */
  async getScoringFactors(dealId: string): Promise<ScoringFactor[]> {
    const scoring = await this.getScoringResult(dealId);
    return scoring?.scoringFactors || [];
  }

  /**
   * Check if scoring needs refresh (older than 24 hours)
   */
  async needsRefresh(dealId: string): Promise<boolean> {
    const scoring = await this.getScoringResult(dealId);
    if (!scoring) return true;

    const oneDay = 24 * 60 * 60 * 1000;
    const age = Date.now() - new Date(scoring.lastUpdated).getTime();
    return age > oneDay;
  }

  private transformScoringResponse(data: any, dealId: string): DealScoring {
    return {
      dealId,
      overallScore: Math.max(0, Math.min(100, data.overallScore || 0)),
      qualificationLevel: this.validateQualificationLevel(data.qualificationLevel),
      scoringFactors: (data.scoringFactors || []).map((factor: any) => ({
        id: factor.id || `factor_${Date.now()}_${Math.random()}`,
        name: factor.name || 'Unknown Factor',
        category: this.validateCategory(factor.category),
        score: Math.max(0, Math.min(100, factor.score || 0)),
        weight: Math.max(0, Math.min(1, factor.weight || 0)),
        evidence: factor.evidence || [],
        reasoning: factor.reasoning || '',
        confidence: Math.max(0, Math.min(100, factor.confidence || 50))
      })),
      confidence: Math.max(0, Math.min(100, data.confidence || 50)),
      lastUpdated: new Date(),
      aiProvider: 'openai',
      modelVersion: 'gpt-5.2-thinking'
    };
  }

  private validateQualificationLevel(level: string): DealScoring['qualificationLevel'] {
    const validLevels: DealScoring['qualificationLevel'][] = ['cold', 'warm', 'hot', 'qualified', 'sales_ready'];
    return validLevels.includes(level as any) ? level as DealScoring['qualificationLevel'] : 'cold';
  }

  private validateCategory(category: string): ScoringFactor['category'] {
    const validCategories: ScoringFactor['category'][] = ['contact', 'company', 'engagement', 'timeline', 'competition', 'market'];
    return validCategories.includes(category as any) ? category as ScoringFactor['category'] : 'contact';
  }

  private transformDatabaseResult(data: any): DealScoring {
    return {
      dealId: data.deal_id,
      overallScore: data.overall_score,
      qualificationLevel: data.qualification_level,
      scoringFactors: data.scoring_factors || [],
      confidence: data.confidence,
      lastUpdated: new Date(data.last_updated),
      aiProvider: data.ai_provider,
      modelVersion: data.model_version
    };
  }

  private async saveScoringResult(scoring: DealScoring): Promise<void> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const dbData = {
        deal_id: scoring.dealId,
        overall_score: scoring.overallScore,
        qualification_level: scoring.qualificationLevel,
        scoring_factors: scoring.scoringFactors,
        confidence: scoring.confidence,
        last_updated: scoring.lastUpdated.toISOString(),
        ai_provider: scoring.aiProvider,
        model_version: scoring.modelVersion
      };

      const { error } = await supabase
        .from('deal_scorings')
        .upsert(dbData, { onConflict: 'deal_id' });

      if (error) {
        console.error('Failed to save scoring result:', error);
      }
    } catch (error) {
      console.error('Failed to save scoring result:', error);
    }
  }

  /**
   * Get scoring statistics across all deals
   */
  async getScoringStatistics(): Promise<{
    totalScored: number;
    averageScore: number;
    levelDistribution: Record<string, number>;
    recentUpdates: number;
  }> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('deal_scorings')
        .select('overall_score, qualification_level, last_updated');

      if (error) throw error;

      const totalScored = data.length;
      const averageScore = totalScored > 0
        ? data.reduce((sum, item) => sum + item.overall_score, 0) / totalScored
        : 0;

      const levelDistribution = data.reduce((acc, item) => {
        acc[item.qualification_level] = (acc[item.qualification_level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentUpdates = data.filter(item =>
        new Date(item.last_updated) > oneDayAgo
      ).length;

      return {
        totalScored,
        averageScore: Math.round(averageScore * 100) / 100,
        levelDistribution,
        recentUpdates
      };
    } catch (error) {
      console.error('Failed to get scoring statistics:', error);
      return {
        totalScored: 0,
        averageScore: 0,
        levelDistribution: {},
        recentUpdates: 0
      };
    }
  }
}

// Singleton instance
let dealScoringService: DealScoringService | null = null;

export const getDealScoringService = (): DealScoringService => {
  if (!dealScoringService) {
    dealScoringService = new DealScoringService();
  }
  return dealScoringService;
};