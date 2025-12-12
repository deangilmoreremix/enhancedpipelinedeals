/**
 * Account Executive (AE) Agent Service
 * Advanced deal management and closing automation
 */

interface DealContext {
  id: string;
  title: string;
  value: number;
  stage: string;
  probability: number;
  contact: {
    id: string;
    name: string;
    title: string;
    company: string;
  };
  timeline: {
    createdAt: string;
    updatedAt: string;
    expectedCloseDate?: string;
  };
  requirements: string[];
  objections: string[];
  competitors: string[];
  decisionMakers: string[];
}

interface NegotiationStrategy {
  id: string;
  name: string;
  description: string;
  tactics: string[];
  conditions: string[];
  successRate: number;
}

interface ContractTerms {
  pricing: {
    basePrice: number;
    discounts: number;
    finalPrice: number;
  };
  timeline: {
    startDate: string;
    endDate: string;
    implementationPeriod: number;
  };
  scope: string[];
  specialTerms: string[];
  risks: string[];
}

interface StakeholderAnalysis {
  primaryDecisionMaker: {
    name: string;
    title: string;
    influence: number; // 1-10
    buyingStyle: string;
  };
  secondaryStakeholders: Array<{
    name: string;
    title: string;
    influence: number;
    concerns: string[];
  }>;
  consensusLevel: number; // 1-10
  decisionProcess: string;
}

class AEAgentService {
  private negotiationStrategies: NegotiationStrategy[] = [
    {
      id: 'value_based',
      name: 'Value-Based Selling',
      description: 'Focus on ROI and long-term value rather than price',
      tactics: [
        'Quantify business impact',
        'Provide ROI calculations',
        'Offer performance guarantees',
        'Create value comparison matrix'
      ],
      conditions: ['high deal value', 'long sales cycle', 'multiple stakeholders'],
      successRate: 85
    },
    {
      id: 'concession_ladder',
      name: 'Concession Ladder',
      description: 'Strategic concessions that maintain value perception',
      tactics: [
        'Start with smallest concessions',
        'Bundle concessions with requirements',
        'Create concession value perception',
        'Know when to walk away'
      ],
      conditions: ['price objections', 'budget constraints', 'competitive situation'],
      successRate: 78
    },
    {
      id: 'relationship_focused',
      name: 'Relationship Building',
      description: 'Build trust and partnership for complex deals',
      tactics: [
        'Regular stakeholder check-ins',
        'Executive sponsorship development',
        'Joint business planning',
        'Post-sale relationship nurturing'
      ],
      conditions: ['enterprise deals', 'long implementation', 'strategic partnership'],
      successRate: 92
    },
    {
      id: 'urgency_creation',
      name: 'Urgency Creation',
      description: 'Create time-sensitive decision drivers',
      tactics: [
        'Limited-time offers',
        'Competitive pressure',
        'Business case urgency',
        'Resource availability windows'
      ],
      conditions: ['stalled deals', 'budget cycles', 'competitive threats'],
      successRate: 71
    }
  ];

  async analyzeDeal(dealId: string): Promise<DealContext> {
    try {
      // Fetch comprehensive deal data
      const dealResponse = await fetch(`/api/deals/${dealId}`);
      const deal = await dealResponse.json();

      const contactResponse = await fetch(`/api/contacts/${deal.contactId}`);
      const contact = await contactResponse.json();

      // Analyze deal requirements and objections
      const requirements = await this.extractRequirements(deal);
      const objections = await this.analyzeObjections(deal);
      const competitors = await this.identifyCompetitors(deal);
      const decisionMakers = await this.mapDecisionMakers(deal);

      return {
        id: deal.id,
        title: deal.title,
        value: deal.value,
        stage: deal.stage,
        probability: deal.probability,
        contact: {
          id: contact.id,
          name: contact.name,
          title: contact.title,
          company: contact.company
        },
        timeline: {
          createdAt: deal.createdAt,
          updatedAt: deal.updatedAt,
          expectedCloseDate: deal.expectedCloseDate
        },
        requirements,
        objections,
        competitors,
        decisionMakers
      };
    } catch (error) {
      console.error('Failed to analyze deal:', error);
      throw error;
    }
  }

  async recommendNegotiationStrategy(dealContext: DealContext): Promise<NegotiationStrategy> {
    try {
      const scores = this.negotiationStrategies.map(strategy => ({
        strategy,
        score: this.scoreStrategyFit(strategy, dealContext)
      }));

      scores.sort((a, b) => b.score - a.score);
      return scores[0].strategy;
    } catch (error) {
      console.error('Failed to recommend negotiation strategy:', error);
      return this.negotiationStrategies[0]; // Default to value-based
    }
  }

  async generateContractTerms(dealContext: DealContext): Promise<ContractTerms> {
    try {
      const basePricing = await this.calculateOptimalPricing(dealContext);
      const timeline = await this.optimizeTimeline(dealContext);
      const scope = await this.defineScope(dealContext);
      const specialTerms = await this.identifySpecialTerms(dealContext);
      const risks = await this.assessContractRisks(dealContext);

      return {
        pricing: basePricing,
        timeline,
        scope,
        specialTerms,
        risks
      };
    } catch (error) {
      console.error('Failed to generate contract terms:', error);
      throw error;
    }
  }

  async analyzeStakeholders(dealContext: DealContext): Promise<StakeholderAnalysis> {
    try {
      const stakeholders = await this.mapStakeholders(dealContext);
      const primaryDM = await this.identifyPrimaryDecisionMaker(stakeholders);
      const consensusLevel = await this.assessConsensusLevel(stakeholders);
      const decisionProcess = await this.understandDecisionProcess(dealContext);

      return {
        primaryDecisionMaker: primaryDM,
        secondaryStakeholders: stakeholders.filter(s => s.name !== primaryDM.name),
        consensusLevel,
        decisionProcess
      };
    } catch (error) {
      console.error('Failed to analyze stakeholders:', error);
      throw error;
    }
  }

  async handleObjection(dealContext: DealContext, objection: string): Promise<{
    response: string;
    strategy: string;
    followUpActions: string[];
  }> {
    try {
      const objectionType = await this.classifyObjection(objection);
      const response = await this.generateObjectionResponse(objectionType, dealContext);
      const strategy = await this.selectObjectionStrategy(objectionType, dealContext);
      const followUpActions = await this.planFollowUpActions(objectionType, dealContext);

      return {
        response,
        strategy,
        followUpActions
      };
    } catch (error) {
      console.error('Failed to handle objection:', error);
      throw error;
    }
  }

  async predictCloseProbability(dealContext: DealContext): Promise<{
    probability: number;
    confidence: number;
    factors: Array<{ factor: string; impact: number; reasoning: string }>;
    timeline: { optimistic: string; realistic: string; pessimistic: string };
  }> {
    try {
      const factors = await this.analyzeCloseFactors(dealContext);
      const probability = this.calculateProbability(factors);
      const confidence = this.calculateConfidence(factors);
      const timeline = this.predictTimeline(dealContext, factors);

      return {
        probability,
        confidence,
        factors,
        timeline
      };
    } catch (error) {
      console.error('Failed to predict close probability:', error);
      throw error;
    }
  }

  async generateNextSteps(dealContext: DealContext): Promise<Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    timeline: string;
    owner: string;
    rationale: string;
  }>> {
    try {
      const nextSteps = [];

      // Analyze current stage and generate appropriate actions
      switch (dealContext.stage) {
        case 'proposal':
          nextSteps.push(
            {
              action: 'Schedule product demo',
              priority: 'high',
              timeline: 'Within 3 days',
              owner: 'AE',
              rationale: 'Demos significantly increase close rates'
            },
            {
              action: 'Prepare ROI analysis',
              priority: 'high',
              timeline: 'Within 1 week',
              owner: 'AE',
              rationale: 'Addresses price objections with data'
            }
          );
          break;

        case 'negotiation':
          nextSteps.push(
            {
              action: 'Identify all decision makers',
              priority: 'high',
              timeline: 'Immediate',
              owner: 'AE',
              rationale: 'Ensures all stakeholders are aligned'
            },
            {
              action: 'Prepare concession strategy',
              priority: 'medium',
              timeline: 'Within 2 days',
              owner: 'AE',
              rationale: 'Strategic concessions maintain value perception'
            }
          );
          break;

        case 'closing':
          nextSteps.push(
            {
              action: 'Finalize contract terms',
              priority: 'high',
              timeline: 'Within 24 hours',
              owner: 'Legal',
              rationale: 'Legal review required for closing'
            },
            {
              action: 'Prepare implementation plan',
              priority: 'medium',
              timeline: 'Within 3 days',
              owner: 'AE',
              rationale: 'Smooth handover to customer success'
            }
          );
          break;
      }

      // Add objection-specific actions
      if (dealContext.objections.length > 0) {
        nextSteps.push({
          action: 'Address outstanding objections',
          priority: 'high',
          timeline: 'Immediate',
          owner: 'AE',
          rationale: `${dealContext.objections.length} objections need resolution`
        });
      }

      return nextSteps;
    } catch (error) {
      console.error('Failed to generate next steps:', error);
      throw error;
    }
  }

  // Private helper methods

  private scoreStrategyFit(strategy: NegotiationStrategy, dealContext: DealContext): number {
    let score = 50; // Base score

    // Check conditions
    strategy.conditions.forEach(condition => {
      switch (condition) {
        case 'high deal value':
          if (dealContext.value > 50000) score += 20;
          break;
        case 'long sales cycle':
          const cycleLength = Date.now() - new Date(dealContext.timeline.createdAt).getTime();
          if (cycleLength > 30 * 24 * 60 * 60 * 1000) score += 15; // 30 days
          break;
        case 'price objections':
          if (dealContext.objections.some(o => o.toLowerCase().includes('price'))) score += 25;
          break;
        case 'enterprise deals':
          if (dealContext.value > 100000) score += 20;
          break;
      }
    });

    // Adjust for success rate
    score += (strategy.successRate - 75) * 0.5; // Slight preference for proven strategies

    return Math.max(0, Math.min(100, score));
  }

  private async calculateOptimalPricing(dealContext: DealContext): Promise<ContractTerms['pricing']> {
    const basePrice = dealContext.value;
    let discounts = 0;

    // Calculate appropriate discounts based on deal factors
    if (dealContext.probability > 80) discounts += 5; // High probability
    if (dealContext.value > 100000) discounts += 10; // Large deal
    if (dealContext.timeline.expectedCloseDate) {
      const daysToClose = (new Date(dealContext.timeline.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysToClose < 30) discounts += 5; // Quick close
    }

    return {
      basePrice,
      discounts: Math.min(discounts, 25), // Max 25% discount
      finalPrice: basePrice * (1 - discounts / 100)
    };
  }

  private async optimizeTimeline(dealContext: DealContext): Promise<ContractTerms['timeline']> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 30); // Default 30 days

    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1); // Default 1 year

    let implementationPeriod = 30; // Default 30 days

    // Adjust based on deal complexity
    if (dealContext.value > 100000) implementationPeriod += 30;
    if (dealContext.requirements.length > 5) implementationPeriod += 15;

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      implementationPeriod
    };
  }

  private async defineScope(dealContext: DealContext): Promise<string[]> {
    // Extract scope from deal requirements
    return dealContext.requirements.map(req => `• ${req}`);
  }

  private async identifySpecialTerms(dealContext: DealContext): Promise<string[]> {
    const terms = [];

    if (dealContext.value > 50000) {
      terms.push('Custom implementation support');
    }

    if (dealContext.probability > 90) {
      terms.push('Priority support SLA');
    }

    if (dealContext.competitors.length > 0) {
      terms.push('Competitive replacement protection');
    }

    return terms;
  }

  private async assessContractRisks(dealContext: DealContext): Promise<string[]> {
    const risks = [];

    if (dealContext.probability < 50) {
      risks.push('Low close probability may affect implementation commitment');
    }

    if (dealContext.objections.length > 3) {
      risks.push('Multiple outstanding objections may delay signing');
    }

    if (dealContext.decisionMakers.length > 5) {
      risks.push('Complex decision-making process may extend timeline');
    }

    return risks;
  }

  private async extractRequirements(deal: any): Promise<string[]> {
    // Extract from deal notes, custom fields, etc.
    const requirements = [];

    if (deal.notes) {
      // Simple extraction - in production, use NLP
      const noteLines = deal.notes.split('\n');
      noteLines.forEach(line => {
        if (line.toLowerCase().includes('need') ||
            line.toLowerCase().includes('require') ||
            line.toLowerCase().includes('want')) {
          requirements.push(line.trim());
        }
      });
    }

    return requirements.length > 0 ? requirements : ['Standard implementation'];
  }

  private async analyzeObjections(deal: any): Promise<string[]> {
    // Extract objections from deal history, notes, etc.
    return deal.objections || [];
  }

  private async identifyCompetitors(deal: any): Promise<string[]> {
    return deal.competitors || [];
  }

  private async mapDecisionMakers(deal: any): Promise<string[]> {
    return deal.decisionMakers || [deal.contact];
  }

  private async mapStakeholders(dealContext: DealContext): Promise<any[]> {
    // In production, this would analyze email threads, meeting notes, etc.
    return [
      {
        name: dealContext.contact.name,
        title: dealContext.contact.title,
        influence: 8,
        concerns: dealContext.objections
      }
    ];
  }

  private async identifyPrimaryDecisionMaker(stakeholders: any[]): Promise<any> {
    // Find stakeholder with highest influence
    const sorted = stakeholders.sort((a, b) => b.influence - a.influence);
    return sorted[0];
  }

  private async assessConsensusLevel(stakeholders: any[]): Promise<number> {
    // Simple assessment based on stakeholder alignment
    if (stakeholders.length === 1) return 10;
    if (stakeholders.length <= 3) return 7;
    return 5;
  }

  private async understandDecisionProcess(dealContext: DealContext): Promise<string> {
    if (dealContext.value > 100000) return 'Enterprise procurement process';
    if (dealContext.decisionMakers.length > 3) return 'Committee decision';
    return 'Individual decision maker';
  }

  private async classifyObjection(objection: string): Promise<string> {
    const objectionTypes = {
      price: ['price', 'cost', 'expensive', 'budget'],
      timing: ['time', 'timeline', 'schedule', 'ready'],
      competition: ['competitor', 'alternative', 'other vendor'],
      features: ['feature', 'functionality', 'capability'],
      trust: ['trust', 'prove', 'guarantee', 'risk']
    };

    for (const [type, keywords] of Object.entries(objectionTypes)) {
      if (keywords.some(keyword => objection.toLowerCase().includes(keyword))) {
        return type;
      }
    }

    return 'other';
  }

  private async generateObjectionResponse(objectionType: string, dealContext: DealContext): Promise<string> {
    const responses = {
      price: `I understand budget concerns are important. Let me show you the ROI this solution delivers - our clients typically see ${dealContext.value * 0.3} in annual savings. Would you be open to discussing the value metrics that matter most to your business?`,
      timing: `I completely understand timing is critical. Based on what you've shared, we could have you up and running within ${dealContext.timeline.expectedCloseDate ? 'your preferred timeline' : '30 days'}. What specific timing concerns do you have?`,
      competition: `It's smart to evaluate all options. What specifically draws you to ${dealContext.competitors[0] || 'the other solution'}? I'd love to understand their strengths so I can show you how we complement or exceed those benefits.`,
      features: `Great question about capabilities. We actually excel in that area - let me share some specific examples of how we've helped similar companies achieve their goals.`,
      trust: `Trust is fundamental in any business relationship. We've been helping companies like yours for over 5 years, and our clients stay with us because they see real results. Would you like to speak with a current customer in your industry?`
    };

    return responses[objectionType] || "Thank you for sharing that concern. Let me address it directly...";
  }

  private async selectObjectionStrategy(objectionType: string, dealContext: DealContext): Promise<string> {
    const strategies = {
      price: 'Value-based selling - focus on ROI and long-term benefits',
      timing: 'Timeline optimization - show quick wins and phased implementation',
      competition: 'Competitive differentiation - highlight unique advantages',
      features: 'Feature demonstration - provide specific use cases and examples',
      trust: 'Social proof and credibility - share testimonials and case studies'
    };

    return strategies[objectionType] || 'Direct addressing - acknowledge and provide specific solutions';
  }

  private async planFollowUpActions(objectionType: string, dealContext: DealContext): Promise<string[]> {
    const actions = {
      price: [
        'Send detailed ROI calculator',
        'Share relevant case studies',
        'Schedule value demonstration call'
      ],
      timing: [
        'Provide detailed implementation timeline',
        'Share quick start options',
        'Discuss phased rollout approach'
      ],
      competition: [
        'Send competitive comparison matrix',
        'Arrange competitive replacement demo',
        'Share win/loss analysis insights'
      ],
      features: [
        'Schedule personalized demo',
        'Provide feature walkthrough video',
        'Share detailed product documentation'
      ],
      trust: [
        'Send customer testimonials',
        'Arrange reference call',
        'Share company credentials and certifications'
      ]
    };

    return actions[objectionType] || ['Follow up with additional information', 'Schedule detailed discussion'];
  }

  private async analyzeCloseFactors(dealContext: DealContext): Promise<Array<{ factor: string; impact: number; reasoning: string }>> {
    const factors = [];

    // Deal age factor
    const dealAge = (Date.now() - new Date(dealContext.timeline.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    factors.push({
      factor: 'Deal Age',
      impact: dealAge > 60 ? 15 : dealAge > 30 ? 10 : -5,
      reasoning: `Deal is ${Math.round(dealAge)} days old`
    });

    // Current probability
    factors.push({
      factor: 'Current Probability',
      impact: (dealContext.probability - 50) * 0.5,
      reasoning: `${dealContext.probability}% stated probability`
    });

    // Deal value
    factors.push({
      factor: 'Deal Value',
      impact: dealContext.value > 50000 ? 10 : dealContext.value > 25000 ? 5 : 0,
      reasoning: `$${dealContext.value.toLocaleString()} deal value`
    });

    // Objections
    factors.push({
      factor: 'Outstanding Objections',
      impact: -dealContext.objections.length * 5,
      reasoning: `${dealContext.objections.length} unresolved objections`
    });

    // Competition
    factors.push({
      factor: 'Competitive Situation',
      impact: -dealContext.competitors.length * 3,
      reasoning: `${dealContext.competitors.length} known competitors`
    });

    return factors;
  }

  private calculateProbability(factors: Array<{ factor: string; impact: number }>): number {
    const baseProbability = 50;
    const totalImpact = factors.reduce((sum, factor) => sum + factor.impact, 0);
    return Math.max(0, Math.min(100, baseProbability + totalImpact));
  }

  private calculateConfidence(factors: Array<{ factor: string; impact: number }>): number {
    // Higher confidence with more data points and consistent factors
    const factorCount = factors.length;
    const impactVariance = this.calculateVariance(factors.map(f => f.impact));

    let confidence = 60; // Base confidence
    confidence += Math.min(factorCount * 5, 20); // More factors = higher confidence
    confidence -= Math.min(impactVariance, 30); // High variance = lower confidence

    return Math.max(10, Math.min(95, confidence));
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  }

  private predictTimeline(dealContext: DealContext, factors: Array<{ factor: string; impact: number }>): { optimistic: string; realistic: string; pessimistic: string } {
    const baseDays = 30;
    const totalImpact = factors.reduce((sum, factor) => sum + factor.impact, 0);
    const adjustedDays = Math.max(7, baseDays + (totalImpact * 2));

    const optimistic = new Date(Date.now() + (adjustedDays * 0.7 * 24 * 60 * 60 * 1000));
    const realistic = new Date(Date.now() + (adjustedDays * 24 * 60 * 60 * 1000));
    const pessimistic = new Date(Date.now() + (adjustedDays * 1.5 * 24 * 60 * 60 * 1000));

    return {
      optimistic: optimistic.toISOString().split('T')[0],
      realistic: realistic.toISOString().split('T')[0],
      pessimistic: pessimistic.toISOString().split('T')[0]
    };
  }
}

// Singleton instance
let aeAgentService: AEAgentService | null = null;

export const getAEAgentService = (): AEAgentService => {
  if (!aeAgentService) {
    aeAgentService = new AEAgentService();
  }
  return aeAgentService;
};

export { AEAgentService };
export type {
  DealContext,
  NegotiationStrategy,
  ContractTerms,
  StakeholderAnalysis
};