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
  | "risk_assessment"
  // Phase 7 AI Enhancements
  | "deal_scoring"
  | "competitor_analysis"
  | "deal_insights"
  | "automated_note_taking"
  | "natural_language_query"
  | "data_enrichment"
  | "record_classification"
  | "summary_generation"
  | "custom_prompt_execution";

// Model routing based on task complexity
export function pickModel(task: AiTask): string {
  switch (task) {
    case "trend_analysis":
    case "intelligence_engine":
    case "prediction":
    case "risk_assessment":
    case "insights_generation":
    case "competitor_analysis":
    case "deal_insights":
    case "summary_generation":
      return "gpt-5.2-pro"; // Heavy analytics & cross-panel intelligence

    case "sales_playbook":
    case "deal_health":
    case "automation_suggestions":
    case "contact_analyze":
    case "lead_score":
    case "communication_optimize":
    case "web_research":
    case "enrichment":
    case "deal_scoring":
    case "record_classification":
    case "data_enrichment":
    case "custom_prompt_execution":
      return "gpt-5.2-thinking"; // Multi-step reasoning tasks

    case "automated_note_taking":
    case "natural_language_query":
    case "email_compose":
    case "meeting_invite":
    case "proposal_email":
    case "discovery_questions":
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

  // Phase 7 AI Enhancement Prompts
  static getDealScoringPrompt(deal: any, contact: any, interactions: any[]): string {
    return `Score this deal for sales qualification using comprehensive criteria.

Deal Details: ${JSON.stringify(deal, null, 2)}
Contact Info: ${JSON.stringify(contact, null, 2)}
Recent Interactions: ${JSON.stringify(interactions.slice(-20), null, 2)}

Analyze and score based on:
1. Contact qualification (title, company size, budget signals, timeline)
2. Deal progression (stage, velocity, stakeholder engagement)
3. Competition (identified competitors, positioning, threats)
4. Company fit (industry, use case, technical requirements)
5. Buying signals (questions asked, objections raised, decision criteria)

Return JSON with:
- overallScore (0-100)
- qualificationLevel ("cold"|"warm"|"hot"|"qualified"|"sales_ready")
- scoringFactors array with detailed analysis
- confidence (0-100)`;
  }

  static getCompetitorAnalysisPrompt(deal: any, company: any, marketData: any): string {
    return `Analyze competitive landscape for this deal.

Deal: ${JSON.stringify(deal, null, 2)}
Target Company: ${JSON.stringify(company, null, 2)}
Market Context: ${JSON.stringify(marketData, null, 2)}

Identify:
1. Primary competitors and their relative strength
2. Competitive positioning (leading/competitive/challenged/losing)
3. Specific threats and opportunities
4. Strategic recommendations to win

Return comprehensive competitor analysis as JSON with competitors array, positioning, threats, opportunities, and recommendations.`;
  }

  static getDealInsightsPrompt(deal: any, contact: any, timeline: any[], analytics: any): string {
    return `Generate comprehensive deal insights and recommendations.

Deal: ${JSON.stringify(deal, null, 2)}
Contact: ${JSON.stringify(contact, null, 2)}
Timeline: ${JSON.stringify(timeline.slice(-15), null, 2)}
Analytics: ${JSON.stringify(analytics, null, 2)}

Provide:
1. Progression insights (positive/neutral/concerning patterns)
2. Risk assessments with severity and mitigation
3. Action recommendations with priorities and timeframes
4. Predictive metrics for next 30-90 days
5. Communication suggestions for stakeholders

Return structured JSON with all insight categories and confidence scores.`;
  }

  static getAutomatedNoteTakingPrompt(communication: any, deal: any, contact: any): string {
    return `Generate automated notes and insights from communication.

Communication: ${JSON.stringify(communication, null, 2)}
Deal Context: ${JSON.stringify(deal, null, 2)}
Contact: ${JSON.stringify(contact, null, 2)}

Create:
1. Concise summary of the communication
2. Key points and takeaways
3. Sentiment analysis (positive/neutral/negative/mixed)
4. Action items with priorities and assignees
5. Follow-up recommendations with timing
6. Relevant tags for categorization

Return JSON with summary, keyPoints, sentiment, actionItems, followUps, and tags.`;
  }

  static getNaturalLanguageQueryPrompt(query: string, context: any, availableData: any): string {
    return `Parse and execute natural language query against CRM data.

User Query: "${query}"

Context: ${JSON.stringify(context, null, 2)}
Available Data Types: ${JSON.stringify(availableData, null, 2)}

1. Parse intent (find/count/analyze/compare/predict/summarize/create/update/delete)
2. Identify target entity type (deal/contact/company)
3. Extract filters, aggregations, and sorting requirements
4. Execute appropriate data operations
5. Format results with insights and suggested actions

Return JSON with parsedIntent, executed queries, results, and recommendations.`;
  }

  static getDataEnrichmentPrompt(entity: any, entityType: string, enrichmentType: string): string {
    return `Enrich ${entityType} data from public sources.

Entity: ${JSON.stringify(entity, null, 2)}
Entity Type: ${entityType}
Enrichment Type: ${enrichmentType}

Based on available data, enrich with:
- Social profiles and professional networks
- Firmographic data (size, revenue, industry details)
- Technographic data (technology stack, tools used)
- Intent signals (recent activities, content consumption)
- News and company updates

Return enriched data with confidence scores and source attribution.`;
  }

  static getRecordClassificationPrompt(entity: any, entityType: string, classificationSchema: any): string {
    return `Classify ${entityType} record into categories.

Entity: ${JSON.stringify(entity, null, 2)}
Entity Type: ${entityType}
Classification Schema: ${JSON.stringify(classificationSchema, null, 2)}

Analyze and classify based on:
- Industry and business type
- Company size and growth stage
- Technology adoption level
- Buying behavior patterns
- Risk and opportunity factors

Return primary category, secondary categories, detailed classifications with confidence scores, and reasoning.`;
  }

  static getSummaryGenerationPrompt(entity: any, entityType: string, summaryType: string): string {
    return `Generate ${summaryType} summary for ${entityType}.

Entity: ${JSON.stringify(entity, null, 2)}
Summary Type: ${summaryType}

Create appropriate summary format:
- executive: High-level overview for leadership
- detailed: Comprehensive analysis with all key information
- bullet_points: Key facts and takeaways
- timeline: Chronological summary of events
- risk_analysis: Focus on risks, opportunities, and recommendations

Include key insights, recommendations, and confidence score.`;
  }

  static getCustomPromptExecutionPrompt(template: any, variables: Record<string, any>): string {
    return `Execute custom AI prompt template.

Template: ${JSON.stringify(template, null, 2)}
Variables: ${JSON.stringify(variables, null, 2)}

Execute the prompt template with provided variables and return the AI-generated response according to the template specifications.`;
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
      case "deal_scoring":
      case "deal_insights":
        const dealData = await CRMContextBuilder.buildDealSnapshot(params.dealId);
        const contactData = await CRMContextBuilder.buildContactSnapshot(params.contactId);
        return { deal: dealData, contact: contactData };

      case "competitor_analysis":
        const compDealData = await CRMContextBuilder.buildDealSnapshot(params.dealId);
        const compContactData = await CRMContextBuilder.buildContactSnapshot(params.contactId);
        // Would need market data here
        return { deal: compDealData, contact: compContactData, marketData: {} };

      case "automated_note_taking":
        const noteDealData = await CRMContextBuilder.buildDealSnapshot(params.dealId);
        const noteContactData = await CRMContextBuilder.buildContactSnapshot(params.contactId);
        return {
          deal: noteDealData,
          contact: noteContactData,
          communication: params.communication
        };

      case "email_compose":
      case "meeting_invite":
      case "proposal_email":
        return await CRMContextBuilder.buildContactSnapshot(params.contactId);

      case "trend_analysis":
      case "prediction":
      case "insights_generation":
        return await CRMContextBuilder.buildGlobalAnalyticsSnapshot(params.workspaceId);

      case "natural_language_query":
        return {
          query: params.query,
          context: params.context || {},
          availableData: params.availableData || {}
        };

      case "data_enrichment":
      case "record_classification":
      case "summary_generation":
        return {
          entity: params.entity,
          entityType: params.entityType,
          [task.replace('_', '') + 'Type']: params[task.replace('_', '') + 'Type']
        };

      case "custom_prompt_execution":
        return {
          template: params.template,
          variables: params.variables
        };

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

      // Phase 7 AI Enhancements
      case "deal_scoring":
        return PromptTemplates.getDealScoringPrompt(context.deal, context.contact, context.interactions || []);

      case "competitor_analysis":
        return PromptTemplates.getCompetitorAnalysisPrompt(context.deal, context.contact, context.marketData);

      case "deal_insights":
        return PromptTemplates.getDealInsightsPrompt(context.deal, context.contact, context.timeline || [], context.analytics || {});

      case "automated_note_taking":
        return PromptTemplates.getAutomatedNoteTakingPrompt(context.communication, context.deal, context.contact);

      case "natural_language_query":
        return PromptTemplates.getNaturalLanguageQueryPrompt(context.query, context.context, context.availableData);

      case "data_enrichment":
        return PromptTemplates.getDataEnrichmentPrompt(context.entity, context.entityType, context.enrichmentType);

      case "record_classification":
        return PromptTemplates.getRecordClassificationPrompt(context.entity, context.entityType, context.classificationSchema);

      case "summary_generation":
        return PromptTemplates.getSummaryGenerationPrompt(context.entity, context.entityType, context.summaryType);

      case "custom_prompt_execution":
        return PromptTemplates.getCustomPromptExecutionPrompt(context.template, context.variables);

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
      "intelligence_engine",
      // Phase 7 AI Enhancements
      "deal_scoring",
      "competitor_analysis",
      "deal_insights",
      "automated_note_taking",
      "natural_language_query",
      "data_enrichment",
      "record_classification",
      "summary_generation",
      "custom_prompt_execution"
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
      // Phase 7 AI Enhancements
      deal_scoring: {
        success: true,
        data: {
          overallScore: 82,
          qualificationLevel: "qualified",
          scoringFactors: [
            {
              id: "contact_qual",
              name: "Contact Qualification",
              category: "contact",
              score: 88,
              weight: 0.3,
              evidence: ["CTO title", "Enterprise company", "Recent funding round"],
              reasoning: "High-level decision maker at well-funded company",
              confidence: 90
            },
            {
              id: "deal_progress",
              name: "Deal Progression",
              category: "engagement",
              score: 75,
              weight: 0.25,
              evidence: ["Multiple stakeholder meetings", "Technical demo completed"],
              reasoning: "Good engagement but timeline concerns",
              confidence: 85
            }
          ],
          confidence: 87
        }
      },
      competitor_analysis: {
        success: true,
        data: {
          primaryCompetitors: [
            {
              id: "comp1",
              name: "CompetitorX",
              strength: 75,
              keyAdvantages: ["Lower pricing", "Faster implementation"],
              keyDisadvantages: ["Limited customization", "Smaller support team"],
              recentActivity: ["New partnership announced", "Price reduction"],
              pricingStrategy: "Volume-based discounts"
            }
          ],
          competitivePosition: "competitive",
          threats: [
            {
              id: "threat1",
              type: "pricing",
              severity: "medium",
              description: "Competitor offering 20% discount for similar solution",
              mitigationStrategies: ["Emphasize total cost of ownership", "Highlight superior support"],
              probability: 60
            }
          ],
          opportunities: [
            {
              id: "opp1",
              type: "gap",
              potential: "high",
              description: "Competitor lacks advanced AI features we offer",
              exploitationStrategy: ["Demo AI capabilities", "Share customer success stories"],
              expectedValue: 25000
            }
          ],
          recommendations: ["Accelerate timeline", "Increase competitive intelligence monitoring", "Strengthen value proposition"]
        }
      },
      deal_insights: {
        success: true,
        data: {
          progressionInsights: [
            {
              id: "insight1",
              insight: "Deal velocity has slowed by 40% in last 2 weeks",
              type: "concerning",
              category: "timeline",
              confidence: 85,
              supportingEvidence: ["Last contact 12 days ago", "No response to last proposal"],
              actionable: true
            }
          ],
          riskAssessments: [
            {
              id: "risk1",
              risk: "Competitor evaluation may be causing delay",
              severity: "medium",
              probability: 70,
              impact: "high",
              mitigationStrategies: ["Schedule competitive positioning call", "Provide detailed comparison"],
              monitoringRequired: true
            }
          ],
          actionRecommendations: [
            {
              id: "action1",
              action: "Schedule urgent check-in call with decision maker",
              priority: "high",
              timeframe: "immediate",
              expectedOutcome: "Re-engage stalled deal and identify blocking issues",
              requiredResources: ["SDR time", "Product demo access"],
              successMetrics: ["Meeting scheduled", "Objections identified"]
            }
          ],
          predictiveMetrics: [
            {
              id: "metric1",
              metric: "Close Probability",
              currentValue: 65,
              predictedValue: 45,
              confidence: 75,
              timeframe: "30 days",
              trend: "decreasing",
              factors: ["Slowing velocity", "Competitor involvement", "Budget approval delay"]
            }
          ],
          communicationSuggestions: [
            {
              id: "comm1",
              type: "call",
              recipient: "CTO",
              timing: "Tomorrow morning",
              subject: "Following up on TechCorp's automation requirements",
              keyPoints: ["Address any concerns", "Reiterate value proposition", "Schedule next steps"],
              tone: "professional",
              expectedResponse: "Meeting confirmation or updated timeline"
            }
          ]
        }
      },
      automated_note_taking: {
        success: true,
        data: {
          summary: "CTO expressed strong interest in automation platform but concerned about integration timeline. Requested detailed ROI analysis and competitor comparison.",
          keyPoints: [
            "Current system causing 20 hours/week manual work",
            "Budget approved for Q2 implementation",
            "Key decision criteria: ROI, ease of use, support quality",
            "Competitor evaluation in progress"
          ],
          sentiment: "positive",
          actionItems: [
            {
              id: "action1",
              description: "Prepare detailed ROI analysis showing 300%+ return",
              priority: "high",
              assignee: "Sales Engineer",
              dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
              status: "pending"
            },
            {
              id: "action2",
              description: "Create competitor feature comparison document",
              priority: "medium",
              assignee: "SDR",
              dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
              status: "pending"
            }
          ],
          followUps: [
            {
              id: "followup1",
              type: "email",
              description: "Send ROI analysis and competitor comparison",
              timing: "End of week",
              priority: "high"
            },
            {
              id: "followup2",
              type: "call",
              description: "Schedule technical demo with engineering team",
              timing: "Next week",
              priority: "medium"
            }
          ],
          tags: ["budget_approved", "roi_focus", "competitor_comparison", "timeline_concern"]
        }
      },
      natural_language_query: {
        success: true,
        data: {
          parsedIntent: {
            action: "find",
            entityType: "deal",
            filters: { stage: "negotiation", value: { min: 50000 } },
            aggregations: ["total_value", "count"],
            sorting: { value: "desc" }
          },
          results: [
            {
              type: "data",
              data: {
                deals: [
                  { id: "deal1", company: "TechCorp", value: 75000, stage: "negotiation" },
                  { id: "deal2", company: "DataSys", value: 60000, stage: "negotiation" }
                ],
                summary: { totalValue: 135000, count: 2 }
              },
              confidence: 95
            },
            {
              type: "insight",
              insight: "Two high-value deals in negotiation stage, representing $135K in potential revenue",
              confidence: 90
            }
          ]
        }
      },
      data_enrichment: {
        success: true,
        data: {
          enrichedData: {
            socialProfiles: {
              linkedin: "https://linkedin.com/in/john-doe",
              twitter: "https://twitter.com/johndoetech"
            },
            firmographic: {
              employeeCount: 150,
              revenue: 15000000,
              industry: "Software Development",
              founded: 2018
            },
            technographic: {
              crm: "Salesforce",
              marketing: "HubSpot",
              analytics: "Mixpanel"
            }
          },
          confidence: 85,
          sources: ["LinkedIn", "Crunchbase", "BuiltWith"]
        }
      },
      record_classification: {
        success: true,
        data: {
          classifications: [
            {
              category: "Technology",
              subcategory: "SaaS",
              confidence: 95,
              reasoning: "Company provides cloud-based software solutions",
              tags: ["saas", "cloud", "technology"],
              metadata: { growthStage: "Series A" }
            },
            {
              category: "Enterprise",
              subcategory: "Mid-Market",
              confidence: 88,
              reasoning: "Company size and revenue indicate mid-market enterprise",
              tags: ["enterprise", "mid-market"],
              metadata: { employeeRange: "100-500" }
            }
          ],
          primaryCategory: "Technology",
          secondaryCategories: ["Enterprise", "SaaS"],
          confidence: 92
        }
      },
      summary_generation: {
        success: true,
        data: {
          content: "TechCorp is a Series A SaaS company with 150 employees, founded in 2018. They provide cloud-based automation solutions and have recently raised $15M in funding. Current deal value is $75K in the negotiation stage.",
          keyInsights: [
            "Strong growth trajectory with recent funding",
            "Mid-market enterprise with established product",
            "Active in automation space with technical requirements"
          ],
          recommendations: [
            "Focus on ROI and technical integration benefits",
            "Address timeline concerns with implementation plan",
            "Highlight competitive advantages in AI capabilities"
          ],
          wordCount: 87,
          confidence: 90
        }
      },
      custom_prompt_execution: {
        success: true,
        data: {
          response: "Custom prompt executed successfully with provided variables.",
          executionDetails: {
            model: "gpt-5.2-thinking",
            tokens: 150,
            processingTime: 1200
          }
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