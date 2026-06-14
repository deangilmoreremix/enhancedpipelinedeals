import { supabase } from './supabaseService';
import { Deal, HealthFactor, ProbabilityFactor, DealActivity } from '../types';

/**
 * Service for calculating and managing deal health indicators
 */
export class DealHealthService {
  /**
   * Calculate overall health score for a deal based on multiple factors
   */
  static calculateHealthScore(deal: Deal, activities: DealActivity[] = []): number {
    const factors = this.analyzeHealthFactors(deal, activities);

    if (factors.length === 0) return 50; // Default neutral score

    const weightedSum = factors.reduce((sum, factor) => {
      return sum + (factor.score * factor.weight);
    }, 0);

    const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);

    return Math.round(Math.max(0, Math.min(100, weightedSum / totalWeight)));
  }

  /**
   * Analyze all health factors for a deal
   */
  static analyzeHealthFactors(deal: Deal, activities: DealActivity[] = []): HealthFactor[] {
    const factors: HealthFactor[] = [];

    // Activity factor - Recent activity indicates health
    const recentActivity = this.calculateActivityFactor(deal, activities);
    if (recentActivity) factors.push(recentActivity);

    // Progress factor - Movement through stages
    const progress = this.calculateProgressFactor(deal, activities);
    if (progress) factors.push(progress);

    // Timeline factor - On track vs overdue
    const timeline = this.calculateTimelineFactor(deal);
    if (timeline) factors.push(timeline);

    // Value factor - Deal size and potential
    const value = this.calculateValueFactor(deal);
    if (value) factors.push(value);

    // Engagement factor - Contact interaction quality
    const engagement = this.calculateEngagementFactor(deal, activities);
    if (engagement) factors.push(engagement);

    return factors;
  }

  /**
   * Calculate activity health factor
   */
  private static calculateActivityFactor(deal: Deal, activities: DealActivity[]): HealthFactor | null {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentActivities = activities.filter(a => new Date(a.createdAt) > lastWeek);
    const monthlyActivities = activities.filter(a => new Date(a.createdAt) > lastMonth);

    let score = 50; // Base score

    if (recentActivities.length > 5) score += 30;
    else if (recentActivities.length > 2) score += 15;
    else if (recentActivities.length === 0) score -= 20;

    if (monthlyActivities.length > 10) score += 20;
    else if (monthlyActivities.length < 3) score -= 10;

    return {
      id: `activity-${deal.id}`,
      name: 'Recent Activity',
      category: 'activity',
      score: Math.max(0, Math.min(100, score)),
      weight: 0.25,
      description: `${recentActivities.length} activities in last week, ${monthlyActivities.length} in last month`,
      isPositive: recentActivities.length > 0,
      timestamp: now
    };
  }

  /**
   * Calculate progress health factor
   */
  private static calculateProgressFactor(deal: Deal, activities: DealActivity[]): HealthFactor | null {
    const stageChanges = activities.filter(a => a.type === 'stage_changed');
    const daysSinceCreated = Math.floor((new Date().getTime() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    let score = 50;

    // More stage changes generally indicate better progress
    if (stageChanges.length > 3) score += 25;
    else if (stageChanges.length > 1) score += 10;
    else if (stageChanges.length === 0 && daysSinceCreated > 14) score -= 15;

    // Time-based progress assessment
    const expectedProgress = Math.min(100, (daysSinceCreated / 30) * 100); // Expect some progress within 30 days
    const actualProgress = this.getStageProgressScore(deal.stage);

    if (actualProgress >= expectedProgress) score += 15;
    else if (actualProgress < expectedProgress * 0.5) score -= 20;

    return {
      id: `progress-${deal.id}`,
      name: 'Deal Progress',
      category: 'progress',
      score: Math.max(0, Math.min(100, score)),
      weight: 0.3,
      description: `Stage: ${deal.stage}, ${stageChanges.length} stage changes`,
      isPositive: stageChanges.length > 0,
      timestamp: new Date()
    };
  }

  /**
   * Calculate timeline health factor
   */
  private static calculateTimelineFactor(deal: Deal): HealthFactor | null {
    if (!deal.dueDate) return null;

    const now = new Date();
    const dueDate = new Date(deal.dueDate);
    const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let score = 50;

    if (daysUntilDue < 0) {
      // Overdue
      score = Math.max(10, 50 - Math.abs(daysUntilDue) * 2);
    } else if (daysUntilDue <= 7) {
      // Due soon
      score = Math.max(30, 50 - (7 - daysUntilDue) * 5);
    } else if (daysUntilDue <= 30) {
      // Due within month
      score = 70;
    } else {
      // Due far in future
      score = 60;
    }

    return {
      id: `timeline-${deal.id}`,
      name: 'Timeline Health',
      category: 'timeline',
      score: Math.max(0, Math.min(100, score)),
      weight: 0.2,
      description: daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} days overdue` : `Due in ${daysUntilDue} days`,
      isPositive: daysUntilDue >= 0,
      timestamp: new Date()
    };
  }

  /**
   * Calculate value health factor
   */
  private static calculateValueFactor(deal: Deal): HealthFactor | null {
    let score = 50;

    // Larger deals get higher scores (to a point)
    if (deal.value > 100000) score += 20;
    else if (deal.value > 50000) score += 15;
    else if (deal.value > 25000) score += 10;
    else if (deal.value > 10000) score += 5;
    else if (deal.value < 1000) score -= 10;

    // Higher probability deals are healthier
    if (deal.probability > 75) score += 15;
    else if (deal.probability > 50) score += 10;
    else if (deal.probability < 25) score -= 15;

    return {
      id: `value-${deal.id}`,
      name: 'Deal Value & Probability',
      category: 'value',
      score: Math.max(0, Math.min(100, score)),
      weight: 0.15,
      description: `$${deal.value.toLocaleString()} at ${deal.probability}% probability`,
      isPositive: deal.probability > 25,
      timestamp: new Date()
    };
  }

  /**
   * Calculate engagement health factor
   */
  private static calculateEngagementFactor(deal: Deal, activities: DealActivity[]): HealthFactor | null {
    const engagementActivities = activities.filter(a =>
      ['email_sent', 'meeting_scheduled', 'contact_added'].includes(a.type)
    );

    const lastWeek = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentEngagement = engagementActivities.filter(a => new Date(a.createdAt) > lastWeek);

    let score = 50;

    if (recentEngagement.length > 3) score += 25;
    else if (recentEngagement.length > 1) score += 10;
    else if (recentEngagement.length === 0) score -= 20;

    // Check for diverse engagement types
    const engagementTypes = new Set(engagementActivities.map(a => a.type));
    if (engagementTypes.size > 2) score += 10;

    return {
      id: `engagement-${deal.id}`,
      name: 'Contact Engagement',
      category: 'engagement',
      score: Math.max(0, Math.min(100, score)),
      weight: 0.1,
      description: `${recentEngagement.length} engagements in last week`,
      isPositive: recentEngagement.length > 0,
      timestamp: new Date()
    };
  }

  /**
   * Get stage progress score (0-100)
   */
  private static getStageProgressScore(stage: string): number {
    const stageScores = {
      'qualification': 20,
      'proposal': 60,
      'negotiation': 80,
      'closed-won': 100,
      'closed-lost': 0
    };
    return stageScores[stage as keyof typeof stageScores] || 0;
  }

  /**
   * Update deal health score in database
   */
  static async updateDealHealth(dealId: string): Promise<boolean> {
    if (!supabase) {
      console.warn('DealHealthService: Supabase not configured');
      return false;
    }
    try {
      // Get deal and activities
      const { data: deal } = await supabase
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .single();

      if (!deal) return false;

      const { data: activities } = await supabase
        .from('deal_activities')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(50);

      // Calculate health
      const healthScore = this.calculateHealthScore(deal, activities || []);
      const healthFactors = this.analyzeHealthFactors(deal, activities || []);

      // Update deal
      const { error } = await supabase
        .from('deals')
        .update({
          health_score: healthScore,
          health_factors: healthFactors,
          last_health_update: new Date().toISOString()
        })
        .eq('id', dealId);

      if (error) throw error;

      // Log health update activity
      if (supabase) {
        await supabase.from('deal_activities').insert({
          deal_id: dealId,
          type: 'health_updated',
          title: 'Health Score Updated',
          description: `Health score updated to ${healthScore}/100`,
          metadata: { healthScore, factorsCount: healthFactors.length }
        });
      }

      return true;
    } catch (error) {
      console.error('Error updating deal health:', error);
      return false;
    }
  }
}

// Export convenience functions
export const calculateHealthScore = DealHealthService.calculateHealthScore;
export const analyzeHealthFactors = DealHealthService.analyzeHealthFactors;
export const updateDealHealth = DealHealthService.updateDealHealth;