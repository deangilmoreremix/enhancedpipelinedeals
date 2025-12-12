/**
 * Pipeline Analytics Service
 * Advanced reporting and insights for sales pipeline performance
 */

interface PipelineMetrics {
  totalDeals: number;
  totalValue: number;
  averageDealSize: number;
  conversionRate: number;
  velocity: number; // days to close
  winRate: number;
  pipelineHealth: number; // 0-100 score
}

interface StageAnalytics {
  stage: string;
  dealCount: number;
  totalValue: number;
  averageValue: number;
  averageTimeInStage: number; // days
  conversionRate: number;
  bottleneckRisk: 'low' | 'medium' | 'high';
}

interface TrendAnalysis {
  period: string;
  dealsCreated: number;
  dealsClosed: number;
  revenue: number;
  growth: number; // percentage
  forecast: number; // predicted revenue
}

interface AgentPerformance {
  agentId: string;
  agentName: string;
  dealsManaged: number;
  revenueGenerated: number;
  winRate: number;
  averageDealSize: number;
  activityScore: number; // 0-100 based on engagement
  efficiency: number; // deals per day
}

interface PredictiveInsights {
  nextMonthRevenue: number;
  confidence: number; // 0-100
  riskFactors: string[];
  opportunities: string[];
  recommendations: string[];
}

class PipelineAnalyticsService {
  private cache = new Map<string, any>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  async getPipelineMetrics(dateRange?: { start: string; end: string }): Promise<PipelineMetrics> {
    const cacheKey = `metrics_${dateRange?.start || 'all'}_${dateRange?.end || 'all'}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const deals = await this.getDealsData(dateRange);

      const totalDeals = deals.length;
      const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
      const averageDealSize = totalDeals > 0 ? totalValue / totalDeals : 0;

      const closedDeals = deals.filter(deal => deal.stage === 'closed-won');
      const conversionRate = totalDeals > 0 ? (closedDeals.length / totalDeals) * 100 : 0;

      const velocity = this.calculateAverageVelocity(deals);
      const winRate = this.calculateWinRate(deals);
      const pipelineHealth = this.calculatePipelineHealth(deals);

      const metrics: PipelineMetrics = {
        totalDeals,
        totalValue,
        averageDealSize,
        conversionRate,
        velocity,
        winRate,
        pipelineHealth
      };

      this.cache.set(cacheKey, metrics);
      return metrics;
    } catch (error) {
      console.error('Failed to get pipeline metrics:', error);
      throw error;
    }
  }

  async getStageAnalytics(): Promise<StageAnalytics[]> {
    const cacheKey = 'stage_analytics';

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const deals = await this.getDealsData();
      const stages = ['qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost'];

      const analytics: StageAnalytics[] = stages.map(stage => {
        const stageDeals = deals.filter(deal => deal.stage === stage);
        const dealCount = stageDeals.length;
        const totalValue = stageDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
        const averageValue = dealCount > 0 ? totalValue / dealCount : 0;
        const averageTimeInStage = this.calculateAverageTimeInStage(stageDeals, stage);
        const conversionRate = this.calculateStageConversionRate(deals, stage);
        const bottleneckRisk = this.assessBottleneckRisk(stageDeals, stage);

        return {
          stage,
          dealCount,
          totalValue,
          averageValue,
          averageTimeInStage,
          conversionRate,
          bottleneckRisk
        };
      });

      this.cache.set(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error('Failed to get stage analytics:', error);
      throw error;
    }
  }

  async getTrendAnalysis(period: 'daily' | 'weekly' | 'monthly' = 'monthly', months: number = 12): Promise<TrendAnalysis[]> {
    const cacheKey = `trends_${period}_${months}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const trends: TrendAnalysis[] = [];
      const now = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const periodStart = new Date(now);
        const periodEnd = new Date(now);

        switch (period) {
          case 'daily':
            periodStart.setDate(now.getDate() - i);
            periodEnd.setDate(now.getDate() - i + 1);
            break;
          case 'weekly':
            periodStart.setDate(now.getDate() - (i * 7));
            periodEnd.setDate(now.getDate() - ((i - 1) * 7));
            break;
          case 'monthly':
            periodStart.setMonth(now.getMonth() - i, 1);
            periodEnd.setMonth(now.getMonth() - i + 1, 0);
            break;
        }

        const deals = await this.getDealsData({
          start: periodStart.toISOString().split('T')[0],
          end: periodEnd.toISOString().split('T')[0]
        });

        const dealsCreated = deals.filter(deal =>
          new Date(deal.createdAt) >= periodStart && new Date(deal.createdAt) <= periodEnd
        ).length;

        const dealsClosed = deals.filter(deal =>
          deal.stage === 'closed-won' &&
          new Date(deal.updatedAt) >= periodStart &&
          new Date(deal.updatedAt) <= periodEnd
        ).length;

        const revenue = deals
          .filter(deal => deal.stage === 'closed-won')
          .reduce((sum, deal) => sum + (deal.value || 0), 0);

        // Calculate growth (compared to previous period)
        const growth = i < months - 1 ? this.calculateGrowth(trends[trends.length - 1]?.revenue || 0, revenue) : 0;

        // Simple forecast based on trend
        const forecast = this.calculateForecast(trends, revenue);

        trends.push({
          period: periodStart.toLocaleDateString(),
          dealsCreated,
          dealsClosed,
          revenue,
          growth,
          forecast
        });
      }

      this.cache.set(cacheKey, trends);
      return trends;
    } catch (error) {
      console.error('Failed to get trend analysis:', error);
      throw error;
    }
  }

  async getAgentPerformance(): Promise<AgentPerformance[]> {
    const cacheKey = 'agent_performance';

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Get agent activity data
      const response = await fetch('/.netlify/functions/get-agent-performance');
      const data = await response.json();

      const performance: AgentPerformance[] = data.agents.map(agent => ({
        agentId: agent.id,
        agentName: agent.name,
        dealsManaged: agent.dealsManaged || 0,
        revenueGenerated: agent.revenueGenerated || 0,
        winRate: agent.winRate || 0,
        averageDealSize: agent.averageDealSize || 0,
        activityScore: this.calculateActivityScore(agent),
        efficiency: agent.efficiency || 0
      }));

      this.cache.set(cacheKey, performance);
      return performance;
    } catch (error) {
      console.error('Failed to get agent performance:', error);
      throw error;
    }
  }

  async getPredictiveInsights(): Promise<PredictiveInsights> {
    try {
      const trends = await this.getTrendAnalysis('monthly', 6);
      const currentMetrics = await this.getPipelineMetrics();
      const stageAnalytics = await this.getStageAnalytics();

      // Simple linear regression for forecasting
      const revenues = trends.map(t => t.revenue);
      const nextMonthRevenue = this.predictNextMonth(revenues);

      // Calculate confidence based on data consistency
      const confidence = this.calculatePredictionConfidence(revenues);

      // Identify risk factors
      const riskFactors = this.identifyRiskFactors(stageAnalytics, currentMetrics);

      // Identify opportunities
      const opportunities = this.identifyOpportunities(stageAnalytics, trends);

      // Generate recommendations
      const recommendations = this.generateRecommendations(riskFactors, opportunities, currentMetrics);

      return {
        nextMonthRevenue,
        confidence,
        riskFactors,
        opportunities,
        recommendations
      };
    } catch (error) {
      console.error('Failed to get predictive insights:', error);
      throw error;
    }
  }

  private async getDealsData(dateRange?: { start: string; end: string }): Promise<any[]> {
    try {
      let url = '/.netlify/functions/get-deals-analytics';
      if (dateRange) {
        url += `?start=${dateRange.start}&end=${dateRange.end}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      return data.deals || [];
    } catch (error) {
      console.warn('Failed to get deals data:', error);
      return [];
    }
  }

  private calculateAverageVelocity(deals: any[]): number {
    const closedDeals = deals.filter(deal =>
      deal.stage === 'closed-won' && deal.createdAt && deal.updatedAt
    );

    if (closedDeals.length === 0) return 0;

    const totalDays = closedDeals.reduce((sum, deal) => {
      const created = new Date(deal.createdAt);
      const closed = new Date(deal.updatedAt);
      const days = (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);

    return Math.round(totalDays / closedDeals.length);
  }

  private calculateWinRate(deals: any[]): number {
    const closedDeals = deals.filter(deal =>
      deal.stage === 'closed-won' || deal.stage === 'closed-lost'
    );

    if (closedDeals.length === 0) return 0;

    const wonDeals = closedDeals.filter(deal => deal.stage === 'closed-won').length;
    return Math.round((wonDeals / closedDeals.length) * 100);
  }

  private calculatePipelineHealth(deals: any[]): number {
    let health = 50; // Base score

    // Factor 1: Deal distribution across stages
    const stageDistribution = this.analyzeStageDistribution(deals);
    health += stageDistribution.score;

    // Factor 2: Velocity (faster is better, but not too fast)
    const velocity = this.calculateAverageVelocity(deals);
    if (velocity > 0 && velocity < 90) health += 20; // Optimal velocity
    else if (velocity >= 90) health += 10; // A bit slow
    else health -= 10; // Too fast

    // Factor 3: Win rate
    const winRate = this.calculateWinRate(deals);
    health += Math.min(winRate / 2, 20); // Up to 20 points

    // Factor 4: Deal quality (size distribution)
    const quality = this.analyzeDealQuality(deals);
    health += quality.score;

    return Math.max(0, Math.min(100, health));
  }

  private analyzeStageDistribution(deals: any[]): { score: number; analysis: string } {
    const stages = ['qualification', 'proposal', 'negotiation'];
    const totalDeals = deals.length;

    if (totalDeals === 0) return { score: 0, analysis: 'No deals in pipeline' };

    let score = 0;
    const analysis = [];

    stages.forEach((stage, index) => {
      const stageDeals = deals.filter(deal => deal.stage === stage).length;
      const percentage = (stageDeals / totalDeals) * 100;

      // Ideal distribution: 40% qualification, 30% proposal, 20% negotiation
      const idealPercentages = [40, 30, 20];
      const ideal = idealPercentages[index];

      const deviation = Math.abs(percentage - ideal);
      const stageScore = Math.max(0, 10 - deviation);

      score += stageScore;

      if (deviation > 20) {
        analysis.push(`${stage} has ${percentage.toFixed(1)}% (ideal: ${ideal}%)`);
      }
    });

    return { score: Math.min(30, score), analysis: analysis.join(', ') };
  }

  private analyzeDealQuality(deals: any[]): { score: number; analysis: string } {
    if (deals.length === 0) return { score: 0, analysis: 'No deals to analyze' };

    const values = deals.map(deal => deal.value || 0).filter(v => v > 0);
    if (values.length === 0) return { score: 0, analysis: 'No deal values available' };

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];

    // Healthy pipeline has reasonable average/median ratio
    const ratio = avg / median;
    let score = 20;

    if (ratio > 2) {
      score -= 10; // Too many large deals, risky
    } else if (ratio < 1.2) {
      score += 5; // Good distribution
    }

    return { score, analysis: `Avg/Median ratio: ${ratio.toFixed(1)}` };
  }

  private calculateAverageTimeInStage(deals: any[], stage: string): number {
    // Simplified - in production, track stage entry/exit times
    const stageDeals = deals.filter(deal => deal.stage === stage);
    if (stageDeals.length === 0) return 0;

    // Mock calculation based on deal age
    const avgAge = stageDeals.reduce((sum, deal) => {
      const age = Date.now() - new Date(deal.updatedAt).getTime();
      return sum + (age / (1000 * 60 * 60 * 24)); // days
    }, 0) / stageDeals.length;

    return Math.round(avgAge);
  }

  private calculateStageConversionRate(deals: any[], stage: string): number {
    const stageDeals = deals.filter(deal => deal.stage === stage).length;
    const nextStage = this.getNextStage(stage);
    const nextStageDeals = nextStage ? deals.filter(deal => deal.stage === nextStage).length : 0;

    if (stageDeals === 0) return 0;
    return Math.round((nextStageDeals / stageDeals) * 100);
  }

  private getNextStage(stage: string): string | null {
    const stages = ['qualification', 'proposal', 'negotiation', 'closed-won'];
    const index = stages.indexOf(stage);
    return index >= 0 && index < stages.length - 1 ? stages[index + 1] : null;
  }

  private assessBottleneckRisk(deals: any[], stage: string): 'low' | 'medium' | 'high' {
    const timeInStage = this.calculateAverageTimeInStage(deals, stage);
    const stageDeals = deals.filter(deal => deal.stage === stage).length;

    if (stageDeals === 0) return 'low';

    // Risk assessment based on time and deal count
    if (timeInStage > 30 || stageDeals > 20) return 'high';
    if (timeInStage > 14 || stageDeals > 10) return 'medium';
    return 'low';
  }

  private calculateGrowth(previous: number, current: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private calculateForecast(trends: TrendAnalysis[], current: number): number {
    if (trends.length < 3) return current;

    // Simple moving average forecast
    const recent = trends.slice(-3).map(t => t.revenue);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;

    // Add slight growth trend
    const growth = trends.length > 1 ?
      (trends[trends.length - 1].revenue - trends[0].revenue) / trends.length : 0;

    return Math.round(avg + growth);
  }

  private calculateActivityScore(agent: any): number {
    // Calculate based on various activity metrics
    let score = 50; // Base score

    if (agent.emailsSent > 0) score += Math.min(agent.emailsSent / 10, 20);
    if (agent.callsMade > 0) score += Math.min(agent.callsMade / 5, 15);
    if (agent.meetingsBooked > 0) score += Math.min(agent.meetingsBooked / 2, 10);
    if (agent.dealsUpdated > 0) score += Math.min(agent.dealsUpdated / 5, 5);

    return Math.min(100, score);
  }

  private predictNextMonth(revenues: number[]): number {
    if (revenues.length < 3) return revenues[revenues.length - 1] || 0;

    // Linear regression for simple forecasting
    const n = revenues.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = revenues.reduce((a, b) => a + b, 0);
    const sumXY = revenues.reduce((sum, y, x) => sum + x * y, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict next month (x = n)
    return Math.max(0, Math.round(intercept + slope * n));
  }

  private calculatePredictionConfidence(revenues: number[]): number {
    if (revenues.length < 3) return 30;

    // Calculate coefficient of variation
    const mean = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const variance = revenues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / revenues.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? (stdDev / mean) * 100 : 100;

    // Lower CV = higher confidence
    return Math.max(10, Math.min(95, 100 - cv));
  }

  private identifyRiskFactors(stageAnalytics: StageAnalytics[], metrics: PipelineMetrics): string[] {
    const risks = [];

    // Check for bottlenecks
    const bottlenecks = stageAnalytics.filter(stage => stage.bottleneckRisk === 'high');
    if (bottlenecks.length > 0) {
      risks.push(`High bottleneck risk in: ${bottlenecks.map(b => b.stage).join(', ')}`);
    }

    // Check pipeline health
    if (metrics.pipelineHealth < 40) {
      risks.push('Pipeline health is critically low');
    } else if (metrics.pipelineHealth < 60) {
      risks.push('Pipeline health needs attention');
    }

    // Check velocity
    if (metrics.velocity > 120) {
      risks.push('Deals are taking too long to close');
    }

    // Check conversion rate
    if (metrics.conversionRate < 10) {
      risks.push('Conversion rate is below acceptable levels');
    }

    return risks;
  }

  private identifyOpportunities(stageAnalytics: StageAnalytics[], trends: TrendAnalysis[]): string[] {
    const opportunities = [];

    // Check for growth trends
    const recentTrends = trends.slice(-3);
    const avgGrowth = recentTrends.reduce((sum, t) => sum + t.growth, 0) / recentTrends.length;

    if (avgGrowth > 20) {
      opportunities.push('Strong growth trend indicates market opportunity');
    }

    // Check stage performance
    const highPerformingStages = stageAnalytics.filter(stage => stage.conversionRate > 80);
    if (highPerformingStages.length > 0) {
      opportunities.push(`High-performing stages: ${highPerformingStages.map(s => s.stage).join(', ')}`);
    }

    // Check for untapped potential
    const underutilizedStages = stageAnalytics.filter(stage =>
      stage.dealCount > 0 && stage.averageTimeInStage < 7
    );
    if (underutilizedStages.length > 0) {
      opportunities.push('Fast-moving stages indicate efficient processes');
    }

    return opportunities;
  }

  private generateRecommendations(risks: string[], opportunities: string[], metrics: PipelineMetrics): string[] {
    const recommendations = [];

    if (risks.some(r => r.includes('bottleneck'))) {
      recommendations.push('Review and optimize bottleneck stages with additional resources');
    }

    if (metrics.pipelineHealth < 60) {
      recommendations.push('Focus on pipeline health by qualifying leads more effectively');
    }

    if (metrics.velocity > 90) {
      recommendations.push('Implement strategies to accelerate deal velocity');
    }

    if (opportunities.some(o => o.includes('growth'))) {
      recommendations.push('Capitalize on growth trends by increasing lead generation');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue current strategies - pipeline is performing well');
    }

    return recommendations;
  }

  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;

    const now = Date.now();
    return (now - cached.timestamp) < this.cacheExpiry;
  }

  clearCache(): void {
    this.cache.clear();
  }

  updateCacheExpiry(minutes: number): void {
    this.cacheExpiry = minutes * 60 * 1000;
  }
}

// Singleton instance
let pipelineAnalyticsService: PipelineAnalyticsService | null = null;

export const getPipelineAnalyticsService = (): PipelineAnalyticsService => {
  if (!pipelineAnalyticsService) {
    pipelineAnalyticsService = new PipelineAnalyticsService();
  }
  return pipelineAnalyticsService;
};

export { PipelineAnalyticsService };
export type {
  PipelineMetrics,
  StageAnalytics,
  TrendAnalysis,
  AgentPerformance,
  PredictiveInsights
};