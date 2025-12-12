/**
 * SmartAIOrchestrator - Single "Brain" for All AI Features
 * Intelligently routes tasks to GPT-5.2 variants and orchestrates CRM context
 */

import { getMonitoringService } from './monitoringService';
import { validateContactData, validateDealData } from '../utils/validation';

// Task types for intelligent model routing
export type AiTask =
  | "contact_analyze"
  | "lead_score"
  | "email_compose"
  | "sales_playbook"
  | "deal_health"
  | "prediction"
  | "trend_analysis"
  | "intelligence_engine"
  | "sdr_persona"
  | "automation_suggestions"
  | "enrichment"
  | "web_research"
  | "meeting_invite"
  | "proposal_email"
  | "communication_optimize"
  | "discovery_questions"
  | "insights_generation"
  | "risk_assessment";

// Model routing based on task complexity
export function pickModel(task: AiTask): string {
  switch (task) {
    case "trend_analysis":
    case "intelligence_engine":
    case "prediction":
    case "risk_assessment":
    case "insights_generation":
      return "gpt-5.2-pro"; // Heavy analytics & cross-panel intelligence

    case "sales_playbook":
    case "deal_health":
    case "automation_suggestions":
    case "contact_analyze":
    case "lead_score":
    case "communication_optimize":
    case "web_research":
    case "enrichment":
      return "gpt-5.2-thinking"; // Multi-step reasoning tasks

    default:
      return "gpt-5.2-instant"; // Quick features, emails, short insights
  }
}

// SDR Persona definitions
export interface SDRPersona {
  id: string;
  name: string;
  tone: string;
  ideal_segments: string[];
  email_style: string;
  communication_focus: string[];
}

const SDR_PERSONAS: SDRPersona[] = [
  {
    id: "dean_closer",
    name: "Dean – Closer",
    tone: "confident, direct, value-driven",
    ideal_segments: ["SaaS", "B2B services"],
    email_style: "short with strong CTA",
    communication_focus: ["ROI", "implementation", "decision-makers"]
  },
  {
    id: "sarah_nurturer",
    name: "Sarah – Nurturer",
    tone: "empathetic, educational, relationship-focused",
    ideal_segments: ["B2B", "professional services"],
    email_style: "story-driven with value insights",
    communication_focus: ["pain points", "success stories", "long-term partnership"]
  },
  {
    id: "alex_hunter",
    name: "Alex – Hunter",
    tone: "aggressive, competitive, challenge-focused",
    ideal_segments: ["enterprise", "high-growth startups"],
    email_style: "competitive positioning with urgency",
    communication_focus: ["market leadership", "competitive advantage", "growth acceleration"]
  },
  {
    id: "maya_educator",
    name: "Maya – Educator",
    tone: "informative, consultative, thought-leadership",
    ideal_segments: ["technology", "consulting"],
    email_style: "insight-driven with industry trends",
    communication_focus: ["industry insights", "best practices", "strategic guidance"]
  }
];

// Context builders for CRM entities
export class CRMContextBuilder {
  static async buildContactSnapshot(contactId: string): Promise<any> {
    try {
      // Import Supabase service dynamically
      const { getSupabaseService } = await import('./supabaseService');
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      // Fetch contact data from Supabase
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (contactError || !contact) {
        console.warn('Contact not found:', contactId);
        return this.getFallbackContactData(contactId);
      }

      // Fetch recent interactions
      const { data: interactions } = await supabase
        .from('communication_records')
        .select('*')
        .eq('contact_id', contactId)
        .order('timestamp', { ascending: false })
        .limit(10);

      // Fetch current deals
      const { data: deals } = await supabase
        .from('deals')
        .select('*')
        .eq('contact_id', contactId)
        .eq('status', 'active');

      return {
        contactId,
        fields: {
          name: contact.name || contact.first_name + ' ' + contact.last_name,
          title: contact.title,
          company: contact.company,
          location: contact.location || contact.city + ', ' + contact.state,
          source: contact.source,
          email: contact.email,
          phone: contact.phone,
          industry: contact.industry,
          website: contact.website
        },
        recentInteractions: interactions?.map(i => ({
          type: i.type,
          date: i.created_at,
          subject: i.subject,
          duration: i.duration,
          notes: i.notes
        })) || [],
        currentDeals: deals?.map(d => ({
          id: d.id,
          stage: d.stage,
          value: d.value,
          probability: d.probability
        })) || []
      };
    } catch (error) {
      console.error('Failed to build contact snapshot:', error);
      return this.getFallbackContactData(contactId);
    }
  }

  private static getFallbackContactData(contactId: string): any {
    return {
      contactId,
      fields: {
        name: "Contact Data Unavailable",
        title: "Unknown",
        company: "Unknown",
        location: "Unknown",
        source: "Unknown"
      },
      recentInteractions: [],
      currentDeals: []
    };
  }

  static async buildDealSnapshot(dealId: string): Promise<any> {
    return {
      dealId,
      details: {
        name: "Enterprise Software License",
        value: 75000,
        stage: "negotiation",
        probability: 80,
        expectedCloseDate: "2024-02-15"
      },
      stakeholders: [
        { name: "John Doe", role: "CTO", influence: "high" },
        { name: "Jane Smith", role: "CFO", influence: "medium" }
      ],
      timeline: [
        { date: "2024-01-01", event: "Initial contact" },
        { date: "2024-01-15", event: "Demo completed" },
        { date: "2024-01-20", event: "Proposal sent" }
      ]
    };
  }

  static async buildPipelineSnapshot(entityId: string): Promise<any> {
    return {
      entityId,
      metrics: {
        totalDeals: 12,
        activeDeals: 8,
        averageDealSize: 45000,
        conversionRate: 0.65,
        averageTimeToClose: 45 // days
      },
      stageDistribution: {
        prospecting: 3,
        qualification: 2,
        proposal: 2,
        negotiation: 1,
        closed: 4
      }
    };
  }

  static async buildGlobalAnalyticsSnapshot(workspaceId: string): Promise<any> {
    return {
      workspaceId,
      kpis: {
        monthlyRecurringRevenue: 250000,
        customerAcquisitionCost: 5000,
        customerLifetimeValue: 75000,
        churnRate: 0.05,
        growthRate: 0.15
      },
      trends: {
        leadQuality: "improving",
        salesCycle: "stable",
        conversionRates: "trending_up",
        customerSatisfaction: "high"
      }
    };
  }
}

// Task-specific prompt templates
export class PromptTemplates {
  static getContactAnalysisPrompt(context: any): string {
    return `Analyze this contact and provide a comprehensive assessment:

Contact Information:
${JSON.stringify(context.fields, null, 2)}

Recent Interactions:
${JSON.stringify(context.recentInteractions, null, 2)}

Current Deals:
${JSON.stringify(context.currentDeals, null, 2)}

Please provide:
1. Relationship summary (1-2 sentences)
2. Buying likelihood score (0-100) with 2-3 specific reasons
3. Recommended next action (1-2 sentences)
4. Key risks or blockers (2-3 items)

Return as JSON with keys: summary, score, next_action, risks`;
  }

  static getLeadScoringPrompt(context: any, scoringMode: string = "SQL"): string {
    return `Score this lead using ${scoringMode} criteria:

Contact: ${JSON.stringify(context.fields, null, 2)}
Interactions: ${JSON.stringify(context.recentInteractions, null, 2)}
Deals: ${JSON.stringify(context.currentDeals, null, 2)}

${scoringMode} Criteria:
- SQL: Sales Qualified Lead (demonstrated need, budget, timeline)
- PQL: Product Qualified Lead (active product usage, engagement)
- MQL: Marketing Qualified Lead (profile fit, engagement signals)

Provide:
1. Score (0-100)
2. Qualification level (${scoringMode})
3. Top 3 reasons for this score
4. Next steps to increase score

Return as JSON: {score, level, reasons: [], next_steps: []}`;
  }

  static getEmailComposePrompt(contact: any, goal: string, tone: string = "professional"): string {
    return `Write a concise outbound email to this lead.

Contact: ${JSON.stringify(contact.fields, null, 2)}
Goal: ${goal}
Tone: ${tone}
Constraints: Maximum 150 words, don't invent facts not in CRM data

Email should include:
- Personalized greeting
- Value proposition relevant to their role/company
- Clear call-to-action
- Professional sign-off

Return as JSON: {subject, body}`;
  }

  static getSalesPlaybookPrompt(deal: any, contact: any, stage: string): string {
    return `Generate a step-by-step sales playbook for closing this deal.

Deal Details: ${JSON.stringify(deal.details, null, 2)}
Contact Info: ${JSON.stringify(contact.fields, null, 2)}
Current Stage: ${stage}
Timeframe: Next 30 days

Include:
1. 5-step action plan
2. Key stakeholders to engage
3. Risk mitigation strategies
4. Communication templates for each step
5. Success metrics

Return as JSON with structured playbook`;
  }

  static getWebResearchPrompt(contact: any, company: any): string {
    return `Conduct web research for sales intelligence.

Target: ${contact.fields.name} (${contact.fields.title}) at ${contact.fields.company}
Domain: ${company.website || 'unknown'}

Find recent, relevant information (last 12 months) including:
- Company news, funding, product launches
- Executive changes or promotions
- Industry trends affecting their business
- Technology stack changes
- Competitive positioning

Focus on signals useful for sales conversations.

Return as JSON: {findings: [], citations: [], recommendations: []}`;
  }

  static getDealHealthPrompt(deal: any, interactions: any[]): string {
    return `Assess deal health and provide actionable insights.

Deal: ${JSON.stringify(deal.details, null, 2)}
Recent Activity: ${JSON.stringify(interactions.slice(-10), null, 2)}

Evaluate:
1. Overall health status (Green/Yellow/Red)
2. Risk score (0-100)
3. Top 3 risk factors
4. Top 3 actions to accelerate or rescue
5. Recommended timeline adjustments

Return as JSON with health assessment and recommendations`;
  }
}

// Main SmartAIOrchestrator class
export class SmartAIOrchestrator {
  private monitoring = getMonitoringService();

  async executeTask(
    task: AiTask,
    params: Record<string, any>,
    context?: { userId?: string; personaId?: string }
  ): Promise<any> {
    const startTime = Date.now();
    const model = pickModel(task);

    try {
      // Build appropriate context
      const crmContext = await this.buildTaskContext(task, params);

      // Get persona if specified
      const persona = context?.personaId ? SDR_PERSONAS.find(p => p.id === context.personaId) : null;

      // Get prompt template
      const prompt = this.getTaskPrompt(task, crmContext, params);

      // Execute AI call (placeholder - would integrate with actual OpenAI service)
      const result = await this.callAI(model, prompt, task);

      // Track performance
      this.monitoring.trackAIFunctionCall(
        task,
        Date.now() - startTime,
        result.success,
        context?.userId,
        { model, persona: persona?.id }
      );

      return result;

    } catch (error) {
      this.monitoring.trackAIFunctionCall(
        task,
        Date.now() - startTime,
        false,
        context?.userId,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }

  private async buildTaskContext(task: AiTask, params: Record<string, any>): Promise<any> {
    switch (task) {
      case "contact_analyze":
      case "lead_score":
        return await CRMContextBuilder.buildContactSnapshot(params.contactId);

      case "sales_playbook":
      case "deal_health":
        const dealData = await CRMContextBuilder.buildDealSnapshot(params.dealId);
        const contactData = await CRMContextBuilder.buildContactSnapshot(params.contactId);
        return { deal: dealData, contact: contactData };

      case "email_compose":
      case "meeting_invite":
      case "proposal_email":
        return await CRMContextBuilder.buildContactSnapshot(params.contactId);

      case "trend_analysis":
      case "prediction":
      case "insights_generation":
        return await CRMContextBuilder.buildGlobalAnalyticsSnapshot(params.workspaceId);

      case "web_research":
        const researchContact = await CRMContextBuilder.buildContactSnapshot(params.contactId);
        // Would need company context here
        return { contact: researchContact, company: {} };

      default:
        return params;
    }
  }

  private getTaskPrompt(task: AiTask, context: any, params: Record<string, any>): string {
    switch (task) {
      case "contact_analyze":
        return PromptTemplates.getContactAnalysisPrompt(context);

      case "lead_score":
        return PromptTemplates.getLeadScoringPrompt(context, params.scoringMode);

      case "email_compose":
        return PromptTemplates.getEmailComposePrompt(context, params.goal, params.tone);

      case "sales_playbook":
        return PromptTemplates.getSalesPlaybookPrompt(
          context.deal,
          context.contact,
          params.currentStage
        );

      case "web_research":
        return PromptTemplates.getWebResearchPrompt(context.contact, context.company);

      case "deal_health":
        return PromptTemplates.getDealHealthPrompt(context.deal, context.interactions || []);

      default:
        return `Execute ${task} with context: ${JSON.stringify(context)} and params: ${JSON.stringify(params)}`;
    }
  }

  private async callAI(model: string, prompt: string, task: AiTask): Promise<any> {
    try {
      // Import OpenAI service dynamically
      const { useRealOpenAI } = await import('./realOpenAIService');

      // Use real OpenAI service for GPT-5.2 models
      const openaiService = useRealOpenAI();

      // Create a wrapper that maps to the expected interface
      const response = await this.callOpenAIWithModel(openaiService, model, prompt, task);

      // Parse and validate response
      const content = response;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      // For tasks that expect JSON responses, parse and validate
      if (this.taskExpectsJSON(task)) {
        try {
          const parsed = JSON.parse(content);
          return { success: true, data: parsed };
        } catch (parseError) {
          console.warn(`Failed to parse JSON response for task ${task}:`, parseError);
          // Return a structured error response
          return {
            success: false,
            error: 'AI response was not in expected JSON format',
            rawResponse: content
          };
        }
      }

      // For text-based responses
      return { success: true, data: content };

    } catch (error) {
      console.error(`AI call failed for task ${task}:`, error);

      // Return structured error response
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI service unavailable',
        task,
        model
      };
    }
  }

  private async callOpenAIWithModel(openaiService: any, model: string, prompt: string, task: AiTask): Promise<string> {
    // This is a placeholder - in reality, you'd need to implement the actual OpenAI API call
    // For now, we'll simulate the call and return mock data based on the task

    console.log(`Calling ${model} for task: ${task}`);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Return mock responses based on task type
    // In production, this would make actual API calls to OpenAI
    return this.getMockResponse(task);
  }

  private getTemperatureForTask(task: AiTask): number {
    // Lower temperature for analytical/factual tasks, higher for creative tasks
    switch (task) {
      case "email_compose":
      case "meeting_invite":
      case "proposal_email":
        return 0.7; // More creative for personalized communication

      case "contact_analyze":
      case "lead_score":
      case "deal_health":
      case "risk_assessment":
        return 0.3; // More analytical and consistent

      case "sales_playbook":
      case "automation_suggestions":
      case "insights_generation":
        return 0.5; // Balanced creativity and analysis

      default:
        return 0.4; // Default balanced temperature
    }
  }

  private getMaxTokensForTask(task: AiTask): number {
    // Allocate appropriate token limits based on task complexity
    switch (task) {
      case "trend_analysis":
      case "intelligence_engine":
      case "insights_generation":
        return 4000; // Complex analytical responses

      case "sales_playbook":
      case "web_research":
        return 3000; // Detailed multi-step responses

      case "contact_analyze":
      case "deal_health":
        return 2000; // Comprehensive but focused responses

      case "email_compose":
      case "meeting_invite":
      case "proposal_email":
        return 1500; // Concise communication responses

      default:
        return 2000; // Default token limit
    }
  }

  private taskExpectsJSON(task: AiTask): boolean {
    // Tasks that should return structured JSON responses
    const jsonTasks: AiTask[] = [
      "contact_analyze",
      "lead_score",
      "sales_playbook",
      "deal_health",
      "web_research",
      "trend_analysis",
      "prediction",
      "risk_assessment",
      "insights_generation",
      "intelligence_engine"
    ];

    return jsonTasks.includes(task);
  }

  // Legacy mock responses for fallback (keeping for reference)
  private getMockResponse(task: AiTask): any {
    const mockResponses: Record<AiTask, any> = {
      contact_analyze: {
        success: true,
        data: {
          summary: "High-potential CTO at growing SaaS company showing strong interest in automation solutions.",
          score: 78,
          next_action: "Schedule technical deep-dive demo focusing on integration capabilities.",
          risks: ["Competitor evaluation in progress", "Budget approval pending Q2"]
        }
      },
      lead_score: {
        success: true,
        data: {
          score: 85,
          level: "SQL",
          reasons: ["Active product usage", "Budget allocated", "Timeline: Q2"],
          next_steps: ["Technical demo", "Stakeholder alignment", "Proposal preparation"]
        }
      },
      email_compose: {
        success: true,
        data: {
          subject: "Accelerating TechCorp's Digital Transformation",
          body: "Hi John,\n\nI noticed TechCorp's recent focus on automation solutions aligns perfectly with our enterprise platform. As CTO, you'd be interested in how we've helped similar companies reduce integration time by 60%.\n\nWould you be available for a 15-minute call this week to discuss your specific requirements?\n\nBest,\n[Your Name]"
        }
      },
      sales_playbook: {
        success: true,
        data: {
          steps: [
            "Technical validation with engineering team",
            "ROI presentation to CFO",
            "Legal review of contract terms",
            "Stakeholder sign-off and implementation planning"
          ],
          stakeholders: ["CTO", "CFO", "Legal", "Engineering Lead"],
          risks: ["Budget approval timeline", "Technical integration complexity"],
          timeline: "Close within 3 weeks"
        }
      },
      deal_health: {
        success: true,
        data: {
          status: "Green",
          risk_score: 25,
          risk_factors: ["Slight delay in technical evaluation", "Budget approval in progress"],
          actions: ["Follow up on technical requirements", "Provide additional case studies", "Schedule stakeholder alignment call"],
          recommendations: ["Maintain weekly check-ins", "Provide implementation timeline"]
        }
      },
      web_research: {
        success: true,
        data: {
          findings: [
            "TechCorp raised $15M Series A in Q4 2023",
            "Expanded engineering team by 40% in 2023",
            "Launched AI-powered analytics platform in Q1 2024"
          ],
          citations: [
            { url: "https://techcrunch.com/techcorp-funding", title: "TechCorp Raises $15M" },
            { url: "https://linkedin.com/company/techcorp", title: "Company Updates" }
          ],
          recommendations: ["Focus on AI integration capabilities", "Highlight scalability for growing teams"]
        }
      },
      // Default response for other tasks
      trend_analysis: { success: true, data: { trends: [], insights: [] } },
      intelligence_engine: { success: true, data: { insights: [], recommendations: [] } },
      prediction: { success: true, data: { forecasts: [], probabilities: [] } },
      automation_suggestions: { success: true, data: { suggestions: [] } },
      enrichment: { success: true, data: { enrichedData: {} } },
      meeting_invite: { success: true, data: { subject: "", body: "" } },
      proposal_email: { success: true, data: { subject: "", body: "" } },
      communication_optimize: { success: true, data: { analysis: {}, suggestions: [] } },
      discovery_questions: { success: true, data: { questions: [] } },
      insights_generation: { success: true, data: { insights: [] } },
      risk_assessment: { success: true, data: { risks: [], mitigations: [] } },
      sdr_persona: { success: true, data: { persona: null } }
    };

    return mockResponses[task] || { success: false, error: "Task not implemented" };
  }

  // SDR Persona management
  getAvailablePersonas(): SDRPersona[] {
    return SDR_PERSONAS;
  }

  getPersona(personaId: string): SDRPersona | null {
    return SDR_PERSONAS.find(p => p.id === personaId) || null;
  }

  suggestPersonaForLead(contactData: any, companyData: any): SDRPersona {
    // Simple logic - in production, this could use AI to match
    const industry = companyData.industry?.toLowerCase() || '';

    if (industry.includes('saas') || industry.includes('software')) {
      return SDR_PERSONAS.find(p => p.id === 'dean_closer')!;
    } else if (industry.includes('consulting') || industry.includes('professional')) {
      return SDR_PERSONAS.find(p => p.id === 'maya_educator')!;
    } else {
      return SDR_PERSONAS.find(p => p.id === 'sarah_nurturer')!;
    }
  }
}

// Singleton instance
let smartAIInstance: SmartAIOrchestrator | null = null;

export const getSmartAIOrchestrator = (): SmartAIOrchestrator => {
  if (!smartAIInstance) {
    smartAIInstance = new SmartAIOrchestrator();
  }
  return smartAIInstance;
};

export { SDR_PERSONAS };