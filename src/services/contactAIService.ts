/**
 * Contact AI Service - Integrates SmartAIOrchestrator with contact-level features
 * Provides clean API for UI components to access AI-powered contact analysis
 */

import { getSmartAIOrchestrator, AiTask, SDRPersona } from './smartAIOrchestrator';
import { getMonitoringService } from './monitoringService';

export interface ContactAnalysisResult {
  summary: string;
  score: number;
  next_action: string;
  risks: string[];
}

export interface LeadScoreResult {
  score: number;
  level: 'SQL' | 'PQL' | 'MQL';
  reasons: string[];
  next_steps: string[];
}

export interface EmailComposeResult {
  subject: string;
  body: string;
}

export interface WebResearchResult {
  findings: string[];
  citations: Array<{ url: string; title: string }>;
  recommendations: string[];
}

class ContactAIService {
  private smartAI = getSmartAIOrchestrator();
  private monitoring = getMonitoringService();

  /**
   * Analyze contact and provide comprehensive insights
   */
  async analyzeContact(
    contactId: string,
    userId?: string,
    personaId?: string
  ): Promise<ContactAnalysisResult> {
    const result = await this.smartAI.executeTask(
      'contact_analyze',
      { contactId },
      { userId, personaId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Contact analysis failed');
    }

    return result.data as ContactAnalysisResult;
  }

  /**
   * Score lead with different qualification criteria
   */
  async scoreLead(
    contactId: string,
    scoringMode: 'SQL' | 'PQL' | 'MQL' = 'SQL',
    userId?: string,
    personaId?: string
  ): Promise<LeadScoreResult> {
    const result = await this.smartAI.executeTask(
      'lead_score',
      { contactId, scoringMode },
      { userId, personaId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Lead scoring failed');
    }

    return result.data as LeadScoreResult;
  }

  /**
   * Compose personalized email
   */
  async composeEmail(
    contactId: string,
    goal: string,
    tone: 'professional' | 'casual' | 'friendly' | 'formal' = 'professional',
    userId?: string,
    personaId?: string
  ): Promise<EmailComposeResult> {
    const result = await this.smartAI.executeTask(
      'email_compose',
      { contactId, goal, tone },
      { userId, personaId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Email composition failed');
    }

    return result.data as EmailComposeResult;
  }

  /**
   * Conduct web research for contact intelligence
   */
  async conductWebResearch(
    contactId: string,
    userId?: string,
    personaId?: string
  ): Promise<WebResearchResult> {
    const result = await this.smartAI.executeTask(
      'web_research',
      { contactId },
      { userId, personaId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Web research failed');
    }

    return result.data as WebResearchResult;
  }

  /**
   * Enrich contact data with external sources
   */
  async enrichContactData(
    contactId: string,
    includeSocialProfiles: boolean = true,
    includeCompanyResearch: boolean = true,
    userId?: string,
    personaId?: string
  ): Promise<any> {
    const result = await this.smartAI.executeTask(
      'enrichment',
      {
        contactId,
        includeSocialProfiles,
        includeCompanyResearch
      },
      { userId, personaId }
    );

    if (!result.success) {
      throw new Error(result.error || 'Contact enrichment failed');
    }

    return result.data;
  }

  /**
   * Submit feedback for AI scoring
   */
  async submitAIScoreFeedback(
    contactId: string,
    score: number,
    feedback: 'good' | 'bad',
    userId?: string
  ): Promise<void> {
    // In a real implementation, this would store feedback in a database
    // For now, we'll just track it in monitoring
    this.monitoring.trackUserAction(
      'ai_score_feedback',
      'ContactAIService',
      { contactId, score, feedback },
      userId
    );

    // Could also send feedback to improve future AI prompts
    console.log(`AI Score Feedback: ${feedback} for score ${score} on contact ${contactId}`);
  }

  /**
   * Get available SDR personas
   */
  getAvailablePersonas(): SDRPersona[] {
    return this.smartAI.getAvailablePersonas();
  }

  /**
   * Suggest best persona for a lead
   */
  suggestPersonaForLead(contactData: any, companyData: any): SDRPersona {
    return this.smartAI.suggestPersonaForLead(contactData, companyData);
  }

  /**
   * Get persona by ID
   */
  getPersona(personaId: string): SDRPersona | null {
    return this.smartAI.getPersona(personaId);
  }
}

// Singleton instance
let contactAIServiceInstance: ContactAIService | null = null;

export const getContactAIService = (): ContactAIService => {
  if (!contactAIServiceInstance) {
    contactAIServiceInstance = new ContactAIService();
  }
  return contactAIServiceInstance;
};

// Types are exported inline with their declarations