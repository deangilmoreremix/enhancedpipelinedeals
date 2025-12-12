/**
 * Analytics & Insights Service - Advanced AI-powered business intelligence
 * Provides predictive analytics, trend analysis, and actionable insights
 */

import { getSmartAIOrchestrator, AiTask } from './smartAIOrchestrator';
import { getMonitoringService } from './monitoringService';

export interface PredictionResult {
  forecasts: Array<{
    metric: string;
    value: number;
    confidence: number;
    timeframe: string;
  }>;
  probabilities: Array<{
    scenario: string;
    probability: number;
    factors: string[];
  }>;
}

export interface TrendAnalysisResult {
  trends: Array<{
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    direction: 'improving' | 'declining' | 'stable';
    recommendations: string[];
  }>;
  insights: Array<{
    title: string;
    what: string;
    why: string;
    action: string;
  }>;
}

export interface RiskAssessmentResult {
  risks: Array<{
    dealId: string;
    riskLevel: 'high' | 'medium' | 'low';
    factors: string[];
    mitigation: string[];
    probability: number;
  }>;
  summary: {
    totalAtRisk: number;
    highRiskCount: number;
    recommendations: string[];
  };
}

export interface IntelligenceEngineResult {
  insights: Array<{
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    actions: string[];
  }>;
  recommendations: Array<{
    type: 'call' | 'email' | 'automation' | 'strategy';
    target?: string;
    action: string;
    reason: string;
    urgency: 'immediate' | 'this_week' | 'this_month';
  }>;
  predictions: Array<{
    metric: string;
    prediction: string;
    confidence: number;
  }>;
}

class AnalyticsInsightsService {
  private smartAI = getSmartAIOrchestrator();
  private monitoring = getMonitoringService();

  /**
   * Generate sales predictions and forecasts
   */
  async generatePredictions(
    workspaceId: string,
    historicalData: any,
    userId?: string
  ): Promise<PredictionResult> {
    const result = await this.smartAI.executeTask(
      'prediction',
      { workspaceId, historicalData },
      { userId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Prediction generation failed');
    }

    return result.data as PredictionResult;
  }

  /**
   * Analyze trends and patterns in sales data
   */
  async analyzeTrends(
    workspaceId: string,
    timeSeriesData: any,
    userId?: string
  ): Promise<TrendAnalysisResult> {
    const result = await this.smartAI.executeTask(
      'trend_analysis',
      { workspaceId, timeSeriesData },
      { userId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Trend analysis failed');
    }

    return result.data as TrendAnalysisResult;
  }

  /**
   * Assess risks across the pipeline
   */
  async assessRisks(
    workspaceId: string,
    deals: any[],
    userId?: string
  ): Promise<RiskAssessmentResult> {
    const result = await this.smartAI.executeTask(
      'risk_assessment',
      { workspaceId, deals },
      { userId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Risk assessment failed');
    }

    return result.data as RiskAssessmentResult;
  }

  /**
   * Generate comprehensive business insights
   */
  async generateInsights(
    workspaceId: string,
    data: {
      analytics?: any;
      pipeline?: any;
      recentActivity?: any;
      marketConditions?: any;
    } = {},
    userId?: string
  ): Promise<any> {
    const result = await this.smartAI.executeTask(
      'insights_generation',
      { workspaceId, ...data },
      { userId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Insights generation failed');
    }

    return result.data;
  }

  /**
   * Run the Intelligence Engine - comprehensive cross-panel analysis
   */
  async runIntelligenceEngine(
    workspaceId: string,
    context: {
      analytics?: any;
      pipeline?: any;
      recentWins?: any;
      recentLosses?: any;
      automationRules?: any;
      userActivity?: any;
    } = {},
    userId?: string
  ): Promise<IntelligenceEngineResult> {
    const result = await this.smartAI.executeTask(
      'intelligence_engine',
      { workspaceId, ...context },
      { userId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Intelligence engine failed');
    }

    return result.data as IntelligenceEngineResult;
  }

  /**
   * Get smart recommendations for next actions
   */
  async getSmartRecommendations(
    workspaceId: string,
    userId?: string
  ): Promise<any[]> {
    const intelligence = await this.runIntelligenceEngine(workspaceId, {}, userId);
    return intelligence.recommendations || [];
  }

  /**
   * Analyze conversion funnel performance
   */
  async analyzeConversionFunnel(
    workspaceId: string,
    funnelData: any,
    userId?: string
  ): Promise<any> {
    const result = await this.smartAI.executeTask(
      'trend_analysis',
      {
        workspaceId,
        analysisType: 'conversion_funnel',
        funnelData
      },
      { userId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Funnel analysis failed');
    }

    return result.data;
  }

  /**
   * Generate competitive intelligence insights
   */
  async generateCompetitiveInsights(
    workspaceId: string,
    competitorData: any,
    userId?: string
  ): Promise<any> {
    const result = await this.smartAI.executeTask(
      'insights_generation',
      {
        workspaceId,
        focus: 'competitive_intelligence',
        competitorData
      },
      { userId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Competitive insights failed');
    }

    return result.data;
  }
}

// Singleton instance
let analyticsInsightsServiceInstance: AnalyticsInsightsService | null = null;

export const getAnalyticsInsightsService = (): AnalyticsInsightsService => {
  if (!analyticsInsightsServiceInstance) {
    analyticsInsightsServiceInstance = new AnalyticsInsightsService();
  }
  return analyticsInsightsServiceInstance;
};

// Types are exported inline with their declarations