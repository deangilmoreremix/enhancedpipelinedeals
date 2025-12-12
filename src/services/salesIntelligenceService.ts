/**
 * Sales Intelligence Service - Advanced AI features for sales teams
 * Integrates SmartAIOrchestrator with sales intelligence features
 */

import { getSmartAIOrchestrator, AiTask } from './smartAIOrchestrator';
import { getMonitoringService } from './monitoringService';

export interface SalesPlaybookResult {
  steps: string[];
  stakeholders: string[];
  risks: string[];
  timeline: string;
}

export interface DealHealthResult {
  status: 'Green' | 'Yellow' | 'Red';
  risk_score: number;
  risk_factors: string[];
  actions: string[];
  recommendations: string[];
}

export interface CommunicationAnalysisResult {
  clarity: number;
  empathy: number;
  persuasion: number;
  suggestions: string[];
}

export interface DiscoveryQuestionsResult {
  questions: string[];
}

class SalesIntelligenceService {
  private smartAI = getSmartAIOrchestrator();
  private monitoring = getMonitoringService();

  /**
   * Generate adaptive sales playbook
   */
  async generateSalesPlaybook(
    dealId: string,
    contactId: string,
    currentStage: string,
    userId?: string,
    personaId?: string
  ): Promise<SalesPlaybookResult> {
    const result = await this.smartAI.executeTask(
      'sales_playbook',
      { dealId, contactId, currentStage },
      { userId, personaId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Playbook generation failed');
    }

    return result.data as SalesPlaybookResult;
  }

  /**
   * Assess deal health with AI
   */
  async assessDealHealth(
    dealId: string,
    contactId: string,
    interactions: any[] = [],
    userId?: string,
    personaId?: string
  ): Promise<DealHealthResult> {
    const result = await this.smartAI.executeTask(
      'deal_health',
      { dealId, contactId, interactions },
      { userId, personaId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Deal health assessment failed');
    }

    return result.data as DealHealthResult;
  }

  /**
   * Analyze communication effectiveness
   */
  async analyzeCommunication(
    dealId: string,
    threads: any[],
    userId?: string,
    personaId?: string
  ): Promise<CommunicationAnalysisResult> {
    const result = await this.smartAI.executeTask(
      'communication_optimize',
      { dealId, threads },
      { userId, personaId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Communication analysis failed');
    }

    return result.data as CommunicationAnalysisResult;
  }

  /**
   * Generate discovery questions
   */
  async generateDiscoveryQuestions(
    contactId: string,
    context: {
      role?: string;
      industry?: string;
      valueProposition?: string;
      stage?: string;
    } = {},
    userId?: string,
    personaId?: string
  ): Promise<DiscoveryQuestionsResult> {
    const result = await this.smartAI.executeTask(
      'discovery_questions',
      { contactId, ...context },
      { userId, personaId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Question generation failed');
    }

    return result.data as DiscoveryQuestionsResult;
  }

  /**
   * Get AI suggestions for automation rules
   */
  async getAutomationSuggestions(
    workspaceId: string,
    currentWorkflows: any[],
    userId?: string
  ): Promise<any> {
    const result = await this.smartAI.executeTask(
      'automation_suggestions',
      { workspaceId, currentWorkflows },
      { userId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Automation suggestions failed');
    }

    return result.data;
  }

  /**
   * Optimize existing automation rules
   */
  async optimizeAutomationRules(
    rules: any[],
    performanceMetrics: any[],
    userId?: string
  ): Promise<any> {
    const result = await this.smartAI.executeTask(
      'automation_suggestions',
      { rules, performanceMetrics },
      { userId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Rule optimization failed');
    }

    return result.data;
  }
}

// Singleton instance
let salesIntelligenceServiceInstance: SalesIntelligenceService | null = null;

export const getSalesIntelligenceService = (): SalesIntelligenceService => {
  if (!salesIntelligenceServiceInstance) {
    salesIntelligenceServiceInstance = new SalesIntelligenceService();
  }
  return salesIntelligenceServiceInstance;
};

// Types are exported inline with their declarations