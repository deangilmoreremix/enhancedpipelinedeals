/**
 * Competitor Analysis Service - AI-powered competitive landscape analysis
 * Analyzes competitors, threats, opportunities, and strategic positioning
 */

import { getSmartAIOrchestrator } from './smartAIOrchestrator';
import { getSupabaseService } from './supabaseService';
import { CompetitorAnalysis } from '../types';

export class CompetitorAnalysisService {
  private aiOrchestrator = getSmartAIOrchestrator();

  /**
   * Analyze competitive landscape for a deal
   */
  async analyzeCompetitors(dealId: string): Promise<CompetitorAnalysis> {
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

      // Fetch contact and company data
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', deal.contactId || deal.contact_id)
        .single();

      // Fetch company data if available
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', contact?.company_id || deal.company_id)
        .single();

      // Get market intelligence (placeholder - would integrate with external APIs)
      const marketData = await this.getMarketIntelligence(deal, company);

      // Execute AI competitor analysis
      const result = await this.aiOrchestrator.executeTask('competitor_analysis', {
        dealId,
        deal,
        contact: contact || {},
        company: company || {},
        marketData
      });

      if (!result.success) {
        throw new Error(`AI competitor analysis failed: ${result.error}`);
      }

      // Transform and validate the response
      const analysisData = this.transformAnalysisResponse(result.data, dealId);

      // Save analysis result to database
      await this.saveAnalysisResult(analysisData);

      return analysisData;
    } catch (error) {
      console.error('Competitor analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get cached analysis result
   */
  async getAnalysisResult(dealId: string): Promise<CompetitorAnalysis | null> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('competitor_analyses')
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
      console.error('Failed to get analysis result:', error);
      return null;
    }
  }

  /**
   * Check if analysis needs refresh (older than 7 days)
   */
  async needsRefresh(dealId: string): Promise<boolean> {
    const analysis = await this.getAnalysisResult(dealId);
    if (!analysis) return true;

    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const age = Date.now() - new Date(analysis.lastUpdated).getTime();
    return age > sevenDays;
  }

  /**
   * Get competitive intelligence summary
   */
  async getCompetitiveSummary(dealId: string): Promise<{
    position: string;
    topThreats: string[];
    topOpportunities: string[];
    recommendations: string[];
  } | null> {
    const analysis = await this.getAnalysisResult(dealId);
    if (!analysis) return null;

    return {
      position: analysis.competitivePosition,
      topThreats: analysis.threats.slice(0, 3).map(t => t.description),
      topOpportunities: analysis.opportunities.slice(0, 3).map(o => o.description),
      recommendations: analysis.recommendations.slice(0, 5)
    };
  }

  private async getMarketIntelligence(deal: any, company: any): Promise<any> {
    // Placeholder for market intelligence gathering
    // In production, this would integrate with external APIs like:
    // - SimilarWeb, BuiltWith for technographics
    // - Crunchbase, PitchBook for funding data
    // - G2, TrustRadius for competitor reviews
    // - Social media APIs for sentiment analysis

    return {
      industry: company?.industry || 'Unknown',
      companySize: company?.employee_count || 'Unknown',
      fundingStage: company?.funding_stage || 'Unknown',
      marketTrends: [], // Would be populated from market research APIs
      competitorMentions: [] // Would be populated from web scraping/social listening
    };
  }

  private transformAnalysisResponse(data: any, dealId: string): CompetitorAnalysis {
    return {
      dealId,
      primaryCompetitors: (data.primaryCompetitors || []).map((comp: any) => ({
        id: comp.id || `comp_${Date.now()}_${Math.random()}`,
        name: comp.name || 'Unknown Competitor',
        strength: Math.max(0, Math.min(100, comp.strength || 50)),
        marketShare: comp.marketShare,
        keyAdvantages: comp.keyAdvantages || [],
        keyDisadvantages: comp.keyDisadvantages || [],
        recentActivity: comp.recentActivity || [],
        pricingStrategy: comp.pricingStrategy,
        targetSegments: comp.targetSegments || []
      })),
      competitivePosition: this.validatePosition(data.competitivePosition),
      threats: (data.threats || []).map((threat: any) => ({
        id: threat.id || `threat_${Date.now()}_${Math.random()}`,
        type: this.validateThreatType(threat.type),
        severity: this.validateSeverity(threat.severity),
        description: threat.description || '',
        mitigationStrategies: threat.mitigationStrategies || [],
        probability: Math.max(0, Math.min(100, threat.probability || 50))
      })),
      opportunities: (data.opportunities || []).map((opp: any) => ({
        id: opp.id || `opp_${Date.now()}_${Math.random()}`,
        type: this.validateOpportunityType(opp.type),
        potential: this.validatePotential(opp.potential),
        description: opp.description || '',
        exploitationStrategy: opp.exploitationStrategy || [],
        expectedValue: opp.expectedValue || 0
      })),
      recommendations: data.recommendations || [],
      lastUpdated: new Date(),
      confidence: Math.max(0, Math.min(100, data.confidence || 50))
    };
  }

  private validatePosition(position: string): CompetitorAnalysis['competitivePosition'] {
    const validPositions: CompetitorAnalysis['competitivePosition'][] = ['leading', 'competitive', 'challenged', 'losing'];
    return validPositions.includes(position as any) ? position as CompetitorAnalysis['competitivePosition'] : 'competitive';
  }

  private validateThreatType(type: string): any {
    const validTypes = ['pricing', 'feature', 'timing', 'relationship', 'capability'];
    return validTypes.includes(type) ? type : 'pricing';
  }

  private validateSeverity(severity: string): any {
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    return validSeverities.includes(severity) ? severity : 'medium';
  }

  private validateOpportunityType(type: string): any {
    const validTypes = ['gap', 'weakness', 'timing', 'partnership', 'innovation'];
    return validTypes.includes(type) ? type : 'gap';
  }

  private validatePotential(potential: string): any {
    const validPotentials = ['low', 'medium', 'high'];
    return validPotentials.includes(potential) ? potential : 'medium';
  }

  private transformDatabaseResult(data: any): CompetitorAnalysis {
    return {
      dealId: data.deal_id,
      primaryCompetitors: data.primary_competitors || [],
      competitivePosition: data.competitive_position,
      threats: data.threats || [],
      opportunities: data.opportunities || [],
      recommendations: data.recommendations || [],
      lastUpdated: new Date(data.last_updated),
      confidence: data.confidence
    };
  }

  private async saveAnalysisResult(analysis: CompetitorAnalysis): Promise<void> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const dbData = {
        deal_id: analysis.dealId,
        primary_competitors: analysis.primaryCompetitors,
        competitive_position: analysis.competitivePosition,
        threats: analysis.threats,
        opportunities: analysis.opportunities,
        recommendations: analysis.recommendations,
        last_updated: analysis.lastUpdated.toISOString(),
        confidence: analysis.confidence
      };

      const { error } = await supabase
        .from('competitor_analyses')
        .upsert(dbData, { onConflict: 'deal_id' });

      if (error) {
        console.error('Failed to save analysis result:', error);
      }
    } catch (error) {
      console.error('Failed to save analysis result:', error);
    }
  }

  /**
   * Get competitor analysis statistics
   */
  async getAnalysisStatistics(): Promise<{
    totalAnalyzed: number;
    averageConfidence: number;
    positionDistribution: Record<string, number>;
    topCompetitors: Array<{ name: string; frequency: number }>;
  }> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('competitor_analyses')
        .select('competitive_position, confidence, primary_competitors');

      if (error) throw error;

      const totalAnalyzed = data.length;
      const averageConfidence = totalAnalyzed > 0
        ? data.reduce((sum, item) => sum + item.confidence, 0) / totalAnalyzed
        : 0;

      const positionDistribution = data.reduce((acc, item) => {
        acc[item.competitive_position] = (acc[item.competitive_position] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Count competitor frequencies
      const competitorCounts: Record<string, number> = {};
      data.forEach(item => {
        (item.primary_competitors || []).forEach((comp: any) => {
          competitorCounts[comp.name] = (competitorCounts[comp.name] || 0) + 1;
        });
      });

      const topCompetitors = Object.entries(competitorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, frequency]) => ({ name, frequency }));

      return {
        totalAnalyzed,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        positionDistribution,
        topCompetitors
      };
    } catch (error) {
      console.error('Failed to get analysis statistics:', error);
      return {
        totalAnalyzed: 0,
        averageConfidence: 0,
        positionDistribution: {},
        topCompetitors: []
      };
    }
  }
}

// Singleton instance
let competitorAnalysisService: CompetitorAnalysisService | null = null;

export const getCompetitorAnalysisService = (): CompetitorAnalysisService => {
  if (!competitorAnalysisService) {
    competitorAnalysisService = new CompetitorAnalysisService();
  }
  return competitorAnalysisService;
};