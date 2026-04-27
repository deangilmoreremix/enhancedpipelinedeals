import { supabase } from './supabaseService';
import { Deal, ProbabilityFactor, DealActivity } from '../types';

/**
 * Service for calculating advanced win probability for deals
 */
export class DealProbabilityService {
  /**
   * Calculate advanced win probability using multiple factors
   */
  static calculateWinProbability(deal: Deal, activities: DealActivity[] = [], historicalData?: any): number {
    const factors = this.analyzeProbabilityFactors(deal, activities, historicalData);

    // Start with base probability from deal
    let probability = deal.probability || 50;

    // Apply factor impacts
    for (const factor of factors) {
      const impact = (factor.impact * factor.confidence) / 100; // Weighted impact
      probability = Math.max(0, Math.min(100, probability + impact));
    }

    return Math.round(probability);
  }

  /**
   * Analyze all probability factors for a deal
   */
  static analyzeProbabilityFactors(deal: Deal, activities: DealActivity[] = [], historicalData?: any): ProbabilityFactor[] {
    const factors: ProbabilityFactor[] = [];

    // Historical conversion factor
    const historical = this.calculateHistoricalFactor(deal, historicalData);
    if (historical) factors.push(historical);

    // Engagement factor
    const engagement = this.calculateEngagementFactor(deal, activities);
    if (engagement) factors.push(engagement);

    // Competition factor
    const competition = this.calculateCompetitionFactor(deal, activities);
    if (competition) factors.push(competition);

    // Market factor
    const market = this.calculateMarketFactor(deal);
    if (market) factors.push(market);

    // Internal factor
    const internal = this.calculateInternalFactor(deal, activities);
    if (internal) factors.push(internal);

    return factors;
  }

  /**
   * Calculate historical conversion factor based on similar deals
   */
  private static calculateHistoricalFactor(deal: Deal, historicalData?: any): ProbabilityFactor | null {
    // This would typically query historical deal data
    // For now, using simplified logic based on deal value and stage
    let impact = 0;
    let confidence = 70;

    // Larger deals tend to have lower conversion rates
    if (deal.value > 100000) {
      impact = -10;
      confidence = 75;
    } else if (deal.value > 50000) {
      impact = -5;
      confidence = 70;
    } else if (deal.value < 5000) {
      impact = 5; // Smaller deals convert better
      confidence = 65;
    }

    // Stage-based historical conversion
    const stageMultipliers = {
      'qualification': 0.8,
      'proposal': 1.2,
      'negotiation': 1.5,
      'closed-won': 2.0,
      'closed-lost': 0.1
    };

    impact *= stageMultipliers[deal.stage as keyof typeof stageMultipliers] || 1;

    return {
      id: `historical-${deal.id}`,
      name: 'Historical Conversion Rate',
      category: 'historical',
      impact: Math.round(impact),
      confidence,
      description: `Based on similar deals of $${deal.value.toLocaleString()} in ${deal.stage} stage`,
      data: { dealValue: deal.value, stage: deal.stage },
      timestamp: new Date()
    };
  }

  /**
   * Calculate engagement factor based on contact interaction quality
   */
  private static calculateEngagementFactor(deal: Deal, activities: DealActivity[]): ProbabilityFactor | null {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentActivities = activities.filter(a => new Date(a.createdAt) > lastWeek);
    const monthlyActivities = activities.filter(a => new Date(a.createdAt) > lastMonth);

    const emailCount = activities.filter(a => a.type === 'email_sent').length;
    const meetingCount = activities.filter(a => a.type === 'meeting_scheduled').length;

    let impact = 0;
    let confidence = 60;

    // Recent activity is positive
    if (recentActivities.length > 3) impact += 15;
    else if (recentActivities.length === 0) impact -= 10;

    // Consistent activity over month
    if (monthlyActivities.length > 8) impact += 10;
    else if (monthlyActivities.length < 2) impact -= 15;

    // Quality interactions (meetings > emails)
    if (meetingCount > emailCount) impact += 8;
    else if (meetingCount === 0 && emailCount > 5) impact += 3;

    return {
      id: `engagement-${deal.id}`,
      name: 'Contact Engagement Quality',
      category: 'engagement',
      impact: Math.round(impact),
      confidence,
      description: `${meetingCount} meetings, ${emailCount} emails in last month`,
      data: { meetings: meetingCount, emails: emailCount, recentActivity: recentActivities.length },
      timestamp: new Date()
    };
  }

  /**
   * Calculate competition factor
   */
  private static calculateCompetitionFactor(deal: Deal, activities: DealActivity[]): ProbabilityFactor | null {
    // Look for competition mentions in activities or notes
    const competitionKeywords = ['competitor', 'competition', 'competing', 'alternative', 'vs', 'versus'];
    const hasCompetition = activities.some(a =>
      competitionKeywords.some(keyword =>
        a.description.toLowerCase().includes(keyword) ||
        a.title.toLowerCase().includes(keyword)
      )
    ) || (deal.notes && competitionKeywords.some(keyword =>
      deal.notes!.toLowerCase().includes(keyword)
    ));

    let impact = 0;
    let confidence = 50;

    if (hasCompetition) {
      impact = -15; // Competition typically reduces probability
      confidence = 70;
    } else {
      impact = 5; // No mentioned competition is slightly positive
      confidence = 40;
    }

    return {
      id: `competition-${deal.id}`,
      name: 'Competitive Landscape',
      category: 'competition',
      impact,
      confidence,
      description: hasCompetition ? 'Competition detected in deal activities' : 'No competition mentioned',
      data: { hasCompetition },
      timestamp: new Date()
    };
  }

  /**
   * Calculate market factor based on deal size and timing
   */
  private static calculateMarketFactor(deal: Deal): ProbabilityFactor | null {
    const now = new Date();
    const dealAge = Math.floor((now.getTime() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    let impact = 0;
    let confidence = 55;

    // Deal momentum - deals that progress quickly have higher probability
    if (dealAge < 7) {
      impact += 10; // New deals have momentum
    } else if (dealAge > 90) {
      impact -= 15; // Old deals may be stale
    }

    // Size matters - medium-sized deals tend to convert better than very large or very small
    if (deal.value >= 10000 && deal.value <= 100000) {
      impact += 5;
    } else if (deal.value > 500000) {
      impact -= 10; // Very large deals are harder to close
    }

    return {
      id: `market-${deal.id}`,
      name: 'Market Conditions & Timing',
      category: 'market',
      impact,
      confidence,
      description: `Deal age: ${dealAge} days, value: $${deal.value.toLocaleString()}`,
      data: { dealAge, dealValue: deal.value },
      timestamp: new Date()
    };
  }

  /**
   * Calculate internal factor based on team performance and deal handling
   */
  private static calculateInternalFactor(deal: Deal, activities: DealActivity[]): ProbabilityFactor | null {
    let impact = 0;
    let confidence = 45;

    // Check for assigned owner (good sign)
    if (deal.assignedToId) {
      impact += 8;
      confidence = 60;
    } else {
      impact -= 5; // Unassigned deals have lower probability
    }

    // Check for overdue items
    if (deal.dueDate) {
      const daysOverdue = Math.floor((new Date().getTime() - new Date(deal.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 0) {
        impact -= Math.min(20, daysOverdue * 2); // Overdue reduces probability
      }
    }

    // Priority affects internal handling
    if (deal.priority === 'high') {
      impact += 5;
    } else if (deal.priority === 'low') {
      impact -= 3;
    }

    return {
      id: `internal-${deal.id}`,
      name: 'Internal Deal Management',
      category: 'internal',
      impact,
      confidence,
      description: deal.assignedToId ? 'Deal assigned to team member' : 'Deal unassigned',
      data: { assigned: !!deal.assignedToId, priority: deal.priority },
      timestamp: new Date()
    };
  }

  /**
   * Update deal win probability in database
   */
  static async updateDealProbability(dealId: string): Promise<boolean> {
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

      // Get historical data for similar deals (simplified)
      const { data: similarDeals } = await supabase
        .from('deals')
        .select('stage, value')
        .eq('company', deal.company)
        .neq('id', dealId)
        .limit(10);

      // Calculate probability
      const winProbability = this.calculateWinProbability(deal, activities || [], similarDeals);
      const probabilityFactors = this.analyzeProbabilityFactors(deal, activities || [], similarDeals);

      // Update deal
      const { error } = await supabase
        .from('deals')
        .update({
          win_probability: winProbability,
          probability_factors: probabilityFactors,
          last_probability_update: new Date().toISOString()
        })
        .eq('id', dealId);

      if (error) throw error;

      // Log probability update activity
      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        type: 'probability_updated',
        title: 'Win Probability Updated',
        description: `Win probability updated to ${winProbability}%`,
        metadata: { winProbability, factorsCount: probabilityFactors.length }
      });

      return true;
    } catch (error) {
      console.error('Error updating deal probability:', error);
      return false;
    }
  }
}

// Export convenience functions
export const calculateWinProbability = DealProbabilityService.calculateWinProbability;
export const analyzeProbabilityFactors = DealProbabilityService.analyzeProbabilityFactors;
export const updateDealProbability = DealProbabilityService.updateDealProbability;