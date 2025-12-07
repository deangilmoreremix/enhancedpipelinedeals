import { Deal } from '../types';
import { Contact } from '../types/contact';

export interface IntentSignals {
  budgetMentioned: boolean;
  timelineMentioned: boolean;
  decisionMakerIdentified: boolean;
  competitionAwareness: boolean;
  technicalQuestions: boolean;
  urgencyIndicators: string[];
  qualificationScore: number;
}

export interface CompetitorData {
  name: string;
  context: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface EngagementMetrics {
  openRate: number;
  responseRate: number;
  clickRate: number;
  lastInteraction: Date;
  totalInteractions: number;
}

export interface ContextAnalysisResult {
  recommendedAgents: string[];
  intentSignals: IntentSignals;
  competitorData: CompetitorData[];
  engagementScore: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reasoning: string[];
}

export class ContextDetectionService {

  /**
   * Analyze deal and contact context to recommend appropriate SDR agents
   */
  analyzeContext(deal: Deal, contact?: Contact): ContextAnalysisResult {
    const intentSignals = this.detectIntentSignals(deal, contact);
    const competitorData = this.detectCompetitorMentions(deal, contact);
    const engagementScore = this.calculateEngagementScore(deal, contact);
    const recommendedAgents = this.generateAgentRecommendations(deal, contact, intentSignals, competitorData, engagementScore);

    const priority = this.calculatePriority(deal, intentSignals, engagementScore);
    const reasoning = this.generateReasoning(deal, contact, intentSignals, competitorData, engagementScore);

    return {
      recommendedAgents,
      intentSignals,
      competitorData,
      engagementScore,
      priority,
      reasoning
    };
  }

  /**
   * Detect high-intent signals from deal and contact data
   */
  detectIntentSignals(deal: Deal, contact?: Contact): IntentSignals {
    const budgetMentioned = this.detectBudgetMentions(deal, contact);
    const timelineMentioned = this.detectTimelineMentions(deal, contact);
    const decisionMakerIdentified = this.isDecisionMaker(contact);
    const competitionAwareness = this.detectCompetitionAwareness(deal, contact);
    const technicalQuestions = this.detectTechnicalQuestions(deal, contact);
    const urgencyIndicators = this.detectUrgencyIndicators(deal, contact);

    const qualificationScore = this.calculateQualificationScore({
      budgetMentioned,
      timelineMentioned,
      decisionMakerIdentified,
      competitionAwareness,
      technicalQuestions,
      urgencyIndicators: urgencyIndicators.length
    });

    return {
      budgetMentioned,
      timelineMentioned,
      decisionMakerIdentified,
      competitionAwareness,
      technicalQuestions,
      urgencyIndicators,
      qualificationScore
    };
  }

  /**
   * Detect competitor mentions and sentiment
   */
  detectCompetitorMentions(deal: Deal, contact?: Contact): CompetitorData[] {
    const competitors: CompetitorData[] = [];
    const texts = [
      deal.notes || '',
      deal.contact || '',
      contact?.notes || '',
      contact?.company || ''
    ].filter(Boolean);

    const competitorKeywords = [
      'competitor', 'competition', 'competing', 'versus', 'vs',
      'alternative', 'option', 'choice', 'considering'
    ];

    texts.forEach(text => {
      competitorKeywords.forEach(keyword => {
        if (text.toLowerCase().includes(keyword)) {
          // Extract context around the keyword
          const index = text.toLowerCase().indexOf(keyword);
          const start = Math.max(0, index - 50);
          const end = Math.min(text.length, index + 50);
          const context = text.substring(start, end);

          competitors.push({
            name: keyword,
            context,
            sentiment: this.analyzeSentiment(context)
          });
        }
      });
    });

    return [...new Set(competitors)]; // Remove duplicates
  }

  /**
   * Calculate engagement score based on interaction history
   */
  calculateEngagementScore(deal: Deal, contact?: Contact): number {
    let score = 50; // Base score

    // Deal stage impact
    const stageScores: Record<string, number> = {
      'qualification': 20,
      'proposal': 40,
      'negotiation': 60,
      'closed-won': 80,
      'closed-lost': 10
    };
    score += stageScores[deal.stage] || 0;

    // Time since last activity (negative impact for old deals)
    const lastActivity = deal.updatedAt ? new Date(deal.updatedAt) : new Date(deal.createdAt);
    const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceActivity > 30) score -= 30;
    else if (daysSinceActivity > 7) score -= 15;
    else if (daysSinceActivity < 1) score += 10;

    // Contact completeness
    if (contact) {
      const contactFields = [contact.email, contact.phone, contact.title, contact.industry].filter(Boolean).length;
      score += contactFields * 5; // +5 points per completed field
    }

    // Deal value impact
    if (deal.value > 100000) score += 20;
    else if (deal.value > 50000) score += 10;
    else if (deal.value > 10000) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate intelligent agent recommendations based on context
   */
  private generateAgentRecommendations(
    deal: Deal,
    contact: Contact | undefined,
    intentSignals: IntentSignals,
    competitorData: CompetitorData[],
    engagementScore: number
  ): string[] {
    const recommendations: string[] = [];

    // Deal stage-based recommendations
    switch (deal.stage) {
      case 'qualification':
        recommendations.push('sdr-data-enrichment');
        if (engagementScore < 60) recommendations.push('sdr-follow-up');
        break;

      case 'proposal':
        if (intentSignals.qualificationScore > 70) recommendations.push('sdr-high-intent');
        if (competitorData.length > 0) recommendations.push('sdr-competitor-aware');
        break;

      case 'negotiation':
        recommendations.push('sdr-objection-handling');
        if (intentSignals.qualificationScore > 80) recommendations.push('sdr-high-intent');
        break;

      case 'closed-lost':
        recommendations.push('sdr-winback');
        break;
    }

    // Time-based recommendations
    const lastActivity = deal.updatedAt ? new Date(deal.updatedAt) : new Date(deal.createdAt);
    const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceActivity > 30) {
      recommendations.push('sdr-reactivation');
    } else if (daysSinceActivity > 7) {
      recommendations.push('sdr-follow-up');
      recommendations.push('sdr-bump-message');
    }

    // Contact-based recommendations
    if (contact) {
      if (!contact.industry || !contact.title) {
        recommendations.push('sdr-data-enrichment');
      }

      if (contact.notes?.toLowerCase().includes('referral') ||
          contact.notes?.toLowerCase().includes('recommend')) {
        recommendations.push('sdr-referral');
      }
    }

    // Intent-based recommendations
    if (intentSignals.qualificationScore > 80) {
      recommendations.push('sdr-high-intent');
    }

    if (competitorData.length > 0) {
      recommendations.push('sdr-competitor-aware');
    }

    // Communication channel recommendations
    if (contact?.phone && engagementScore > 70) {
      recommendations.push('sdr-whatsapp');
    }

    if (contact && engagementScore > 60) {
      recommendations.push('sdr-linkedin');
    }

    // Remove duplicates and limit to top 5 most relevant
    return [...new Set(recommendations)].slice(0, 5);
  }

  /**
   * Calculate priority level for the deal
   */
  private calculatePriority(deal: Deal, intentSignals: IntentSignals, engagementScore: number): 'low' | 'medium' | 'high' | 'urgent' {
    if (intentSignals.qualificationScore > 90 && deal.value > 50000) return 'urgent';
    if (intentSignals.qualificationScore > 80 || deal.value > 25000) return 'high';
    if (engagementScore > 70 || intentSignals.qualificationScore > 60) return 'medium';
    return 'low';
  }

  /**
   * Generate human-readable reasoning for recommendations
   */
  private generateReasoning(
    deal: Deal,
    contact: Contact | undefined,
    intentSignals: IntentSignals,
    competitorData: CompetitorData[],
    engagementScore: number
  ): string[] {
    const reasoning: string[] = [];

    if (intentSignals.qualificationScore > 80) {
      reasoning.push(`High qualification score (${intentSignals.qualificationScore.toFixed(0)}%) indicates strong buying intent`);
    }

    if (competitorData.length > 0) {
      reasoning.push(`Competitor mentions detected - positioning assistance recommended`);
    }

    if (engagementScore < 50) {
      reasoning.push(`Low engagement score (${engagementScore.toFixed(0)}%) suggests follow-up needed`);
    }

    if (deal.value > 50000) {
      reasoning.push(`High-value deal ($${deal.value.toLocaleString()}) requires priority attention`);
    }

    const lastActivity = deal.updatedAt ? new Date(deal.updatedAt) : new Date(deal.createdAt);
    const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceActivity > 30) {
      reasoning.push(`Deal inactive for ${daysSinceActivity.toFixed(0)} days - reactivation recommended`);
    }

    if (!contact?.industry) {
      reasoning.push('Incomplete contact profile - enrichment recommended');
    }

    return reasoning;
  }

  // Helper methods for intent signal detection
  private detectBudgetMentions(deal: Deal, contact?: Contact): boolean {
    const texts = [deal.notes || '', contact?.notes || ''].filter(Boolean);
    const budgetKeywords = ['budget', 'spend', 'investment', 'cost', 'price', 'funding', 'allocate'];

    return texts.some(text =>
      budgetKeywords.some(keyword => text.toLowerCase().includes(keyword))
    );
  }

  private detectTimelineMentions(deal: Deal, contact?: Contact): boolean {
    const texts = [deal.notes || '', contact?.notes || ''].filter(Boolean);
    const timelineKeywords = ['timeline', 'deadline', 'quarter', 'month', 'week', 'when', 'schedule', 'planning'];

    return texts.some(text =>
      timelineKeywords.some(keyword => text.toLowerCase().includes(keyword))
    );
  }

  private isDecisionMaker(contact?: Contact): boolean {
    if (!contact?.title) return false;

    const decisionMakerTitles = [
      'ceo', 'cto', 'cfo', 'coo', 'vp', 'director', 'head', 'chief', 'president',
      'owner', 'founder', 'partner', 'principal'
    ];

    return decisionMakerTitles.some(title =>
      contact.title!.toLowerCase().includes(title)
    );
  }

  private detectCompetitionAwareness(deal: Deal, contact?: Contact): boolean {
    return this.detectCompetitorMentions(deal, contact).length > 0;
  }

  private detectTechnicalQuestions(deal: Deal, contact?: Contact): boolean {
    const texts = [deal.notes || '', contact?.notes || ''].filter(Boolean);
    const technicalKeywords = [
      'api', 'integration', 'technical', 'implementation', 'architecture',
      'security', 'compliance', 'scalability', 'performance', 'infrastructure'
    ];

    return texts.some(text =>
      technicalKeywords.some(keyword => text.toLowerCase().includes(keyword))
    );
  }

  private detectUrgencyIndicators(deal: Deal, contact?: Contact): string[] {
    const texts = [deal.notes || '', contact?.notes || ''].filter(Boolean);
    const urgencyKeywords = [
      'urgent', 'asap', 'immediately', 'deadline', 'critical', 'priority',
      'rush', 'quickly', 'soon', 'now', 'fast'
    ];

    const found: string[] = [];
    texts.forEach(text => {
      urgencyKeywords.forEach(keyword => {
        if (text.toLowerCase().includes(keyword)) {
          found.push(keyword);
        }
      });
    });

    return [...new Set(found)];
  }

  private calculateQualificationScore(signals: {
    budgetMentioned: boolean;
    timelineMentioned: boolean;
    decisionMakerIdentified: boolean;
    competitionAwareness: boolean;
    technicalQuestions: boolean;
    urgencyIndicators: number;
  }): number {
    let score = 0;

    if (signals.budgetMentioned) score += 25;
    if (signals.timelineMentioned) score += 20;
    if (signals.decisionMakerIdentified) score += 25;
    if (signals.competitionAwareness) score += 15;
    if (signals.technicalQuestions) score += 10;
    score += Math.min(signals.urgencyIndicators * 5, 10); // Max 10 points for urgency

    return Math.min(100, score);
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['better', 'prefer', 'like', 'good', 'great', 'excellent', 'superior'];
    const negativeWords = ['worse', 'dislike', 'bad', 'terrible', 'inferior', 'problem', 'issue'];

    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }
}

// Singleton instance
export const contextDetectionService = new ContextDetectionService();