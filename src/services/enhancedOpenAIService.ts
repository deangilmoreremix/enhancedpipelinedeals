/**
 * Enhanced OpenAI Service with GPT-5 integration
 * Routes through secure AI Gateway and supports advanced features
 */

import { Contact } from '../types/contact';
import { AIContactAnalysis } from '../types/contact';
import { getAIGatewayService } from './aiGatewayService';
import { getModelById } from '../config/aiModels';

interface OpenAIService {
  analyzeContact: (contact: Contact, modelId?: string) => Promise<AIContactAnalysis>;
  generateEmail: (contact: Contact, context?: string, modelId?: string) => Promise<string>;
  getInsights: (contact: Contact, modelId?: string) => Promise<string[]>;
  generateDealSummary: (dealData: any, modelId?: string) => Promise<string>;
  suggestNextActions: (dealData: any, modelId?: string) => Promise<string[]>;
  generatePsychologicalProfile: (contact: Contact, modelId?: string) => Promise<any>;
  generateDetailedScoreAnalysis: (contact: Contact, modelId?: string) => Promise<any>;
  generateStreamingAnalysis: (contact: Contact, onChunk?: (chunk: string) => void) => Promise<any>;
  isAvailable: () => Promise<boolean>;
}

class EnhancedOpenAIService implements OpenAIService {
  private gateway = getAIGatewayService();
  private defaultModel = 'gpt-5'; // Prioritize GPT-5 for enhanced reasoning

  private getModelId(modelId?: string): string {
    return modelId || import.meta.env.VITE_OPENAI_MODEL || this.defaultModel;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.gateway.healthCheck();
      return health.status === 'healthy' || health.status === 'degraded';
    } catch {
      return false;
    }
  }

  private async makeGatewayRequest(
    messages: Array<{ role: string; content: string }>,
    taskType: string,
    modelId?: string,
    options: any = {}
  ): Promise<string> {
    // Extract contact from options for Edge Function
    const { contact, ...requestOptions } = options;
    
    // Route to specific edge function based on task type
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    const functionMap: Record<string, string> = {
      'contact-analysis': 'contact-analyzer',
      'psychological-profile': 'contact-analyzer',
      'detailed-score-analysis': 'contact-analyzer',
      'email-generation': 'email-generator',
      'deal-summary': 'deal-analyzer',
      'next-actions': 'deal-analyzer',
      'insights-generation': 'contact-analyzer',
      'sales-coaching': 'sales-coach',
      'objection-handling': 'sales-coach'
    };

    const functionName = functionMap[taskType] || 'ai-gateway';
    const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        messages,
        taskType,
        modelId: this.getModelId(modelId),
        contact, // Include contact object for Edge Functions that need it
        ...requestOptions
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`AI service error: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    
    throw new Error('Invalid response format from AI service');
  }

  async analyzeContact(contact: Contact, modelId?: string): Promise<AIContactAnalysis> {
    try {
      const selectedModel = this.getModelId(modelId);
      console.log(`🧠 Enhanced Contact Analysis with ${selectedModel}`);

      const systemMessage = {
        role: 'system',
        content: `You are an expert sales analyst using ${selectedModel} with advanced reasoning capabilities. Provide detailed, actionable insights about sales contacts that help close more deals. Use your enhanced reasoning to analyze patterns and provide nuanced recommendations.`
      };

      const userMessage = {
        role: 'user',
        content: `
          Analyze this sales contact and provide a comprehensive assessment using advanced reasoning:
          
          Contact Information:
          - Name: ${contact.name}
          - Title: ${contact.title}
          - Company: ${contact.company}
          - Industry: ${contact.industry || 'Unknown'}
          - Status: ${contact.status}
          - Interest Level: ${contact.interestLevel}
          - Sources: ${(contact.sources || []).join(', ')}
          - Custom Fields: ${JSON.stringify(contact.customFields || {})}
          - Notes: ${contact.notes || 'No notes'}
          - Recent interactions: ${contact.lastConnected || 'None'}
          
          Using your advanced reasoning capabilities, provide a detailed analysis that includes:
          1. A nuanced scoring explanation that considers subtle indicators
          2. Pattern recognition from the available data
          3. Strategic insights based on the contact's role and industry
          4. Predictive recommendations for engagement
          
          Provide your response in the following JSON structure:
          {
            "score": <number between 0-100>,
            "insights": ["insight1", "insight2", "insight3"],
            "recommendations": ["recommendation1", "recommendation2"],
            "riskFactors": ["risk1", "risk2"],
            "reasoningPath": "explanation of how you arrived at this analysis",
            "confidenceLevel": <number between 0-100>
          }
          
          Base the score on advanced pattern recognition considering company size, industry trends, contact seniority, engagement level, data completeness, and subtle behavioral indicators.
        `
      };

      const response = await this.makeGatewayRequest(
        [systemMessage, userMessage],
        'contact-analysis',
        selectedModel,
        { maxTokens: 1500, contact }
      );

      const analysis = JSON.parse(response);
      return {
        score: Math.min(100, Math.max(0, analysis.score)),
        insights: analysis.insights || [],
        recommendations: analysis.recommendations || [],
        riskFactors: analysis.riskFactors || [],
        reasoningPath: analysis.reasoningPath,
        confidenceLevel: analysis.confidenceLevel
      };
    } catch (error) {
      console.error('Enhanced contact analysis failed:', error);
      return this.generateFallbackAnalysis(contact);
    }
  }

  async generateEmail(contact: Contact, context?: string, modelId?: string): Promise<string> {
    try {
      const selectedModel = this.getModelId(modelId);
      console.log(`✉️ Enhanced Email Generation with ${selectedModel} - Advanced Reasoning Mode`);

      // Advanced reasoning with structured analysis
      const analysisMessage = {
        role: 'system',
        content: `You are an expert sales strategist using ${selectedModel} with advanced reasoning capabilities. First analyze the contact's profile using structured reasoning, then generate a personalized email. Use chain-of-thought reasoning to understand their motivations, challenges, and optimal communication approach.

REASONING FRAMEWORK:
1. Contact Role Analysis: Evaluate seniority, decision-making power, and likely priorities
2. Industry Context: Understand sector-specific challenges and opportunities
3. Communication Strategy: Determine optimal tone, length, and messaging approach
4. Value Proposition Alignment: Match solution benefits to their specific pain points
5. Psychological Triggers: Identify emotional and logical drivers for this contact
6. Competitive Positioning: Consider how to differentiate from alternatives
7. Timing and Urgency: Assess appropriate level of urgency for their situation
8. Risk Mitigation: Anticipate potential objections and concerns

Provide your analysis in a structured format before generating the email.`
      };

      const analysisPrompt = {
        role: 'user',
        content: `Analyze this contact and generate a personalized sales email using advanced reasoning:

CONTACT PROFILE:
- Name: ${contact.name}
- Title: ${contact.title}
- Company: ${contact.company}
- Industry: ${contact.industry || 'Unknown'}
- Status: ${contact.status}
- Interest Level: ${contact.interestLevel}
- Sources: ${(contact.sources || []).join(', ')}
- Previous Notes: ${contact.notes || 'No previous notes'}
- Recent Interactions: ${contact.lastConnected || 'None'}
- Custom Fields: ${JSON.stringify(contact.customFields || {})}

CONTEXT: ${context || 'General follow-up'}

CHAIN-OF-THOUGHT ANALYSIS:
1. What is this contact's primary role and responsibilities?
2. What are their likely pain points and priorities given their position?
3. How should I adapt my communication style for their seniority level?
4. What industry-specific references or language would resonate?
5. What is the optimal level of detail and technical depth?
6. How can I create urgency without being pushy?
7. What psychological triggers are most likely to motivate this contact?
8. How should I position our value proposition for maximum impact?

Based on your analysis, generate a personalized email that demonstrates deep understanding of their situation and provides compelling value.

RESPONSE FORMAT:
First, provide your reasoning analysis in <analysis> tags, then provide the email in <email> tags.`
      };

      // Use structured output for advanced reasoning
      const response = await this.makeGatewayRequest(
        [analysisMessage, analysisPrompt],
        'email-generation',
        selectedModel,
        {
          maxTokens: 1200,
          temperature: 0.7,
          response_format: { type: "text" } // Enable structured reasoning
        }
      );

      // Extract email from structured response
      const emailMatch = response.match(/<email>([\s\S]*?)<\/email>/);
      if (emailMatch) {
        return emailMatch[1].trim();
      }

      // Fallback: try to extract from subject line pattern
      const lines = response.split('\n');
      const subjectIndex = lines.findIndex(line => line.toLowerCase().includes('subject:'));
      if (subjectIndex !== -1) {
        return lines.slice(subjectIndex).join('\n').trim();
      }

      return response;
    } catch (error) {
      console.error('Enhanced email generation with advanced reasoning failed:', error);
      return this.generateFallbackEmail(contact, context);
    }
  }

  async getInsights(contact: Contact, modelId?: string): Promise<string[]> {
    try {
      const selectedModel = this.getModelId(modelId);
      console.log(`💡 Enhanced Insights Generation with ${selectedModel}`);

      const model = getModelById(selectedModel);
      const maxInsights = model?.family === 'GPT-5' ? 8 : 6; // More insights for GPT-5

      const systemMessage = {
        role: 'system',
        content: `You are a sales strategist using ${selectedModel} with advanced reasoning capabilities. Provide specific, actionable insights that sales teams can immediately implement. Use your enhanced reasoning to identify subtle patterns and opportunities.`
      };

      const userMessage = {
        role: 'user',
        content: `
          Generate ${maxInsights} strategic insights about this sales contact using advanced reasoning:
          
          Contact: ${contact.name} - ${contact.title} at ${contact.company}
          Status: ${contact.status}
          Interest: ${contact.interestLevel}
          Industry: ${contact.industry || 'Unknown'}
          Sources: ${(contact.sources || []).join(', ')}
          Recent interactions: ${contact.lastConnected || 'None'}
          Custom data: ${JSON.stringify(contact.customFields || {})}
          Notes: ${contact.notes || 'No notes'}
          
          Using your advanced reasoning capabilities:
          1. Analyze patterns in their data that might not be immediately obvious
          2. Consider industry-specific factors and trends
          3. Evaluate their role's typical challenges and priorities
          4. Identify subtle engagement indicators
          5. Predict likely objections or concerns
          6. Suggest strategic approaches based on their profile
          
          Provide insights as a JSON array of strings.
          Focus on sales strategy, timing, approach recommendations, and hidden opportunities.
          Each insight should be specific, actionable, and demonstrate deep understanding.
        `
      };

      const response = await this.makeGatewayRequest(
        [systemMessage, userMessage],
        'insights-generation',
        selectedModel,
        { maxTokens: 1200 }
      );

      return JSON.parse(response);
    } catch (error) {
      console.error('Enhanced insights generation failed:', error);
      return this.generateFallbackInsights(contact);
    }
  }

  async generateDealSummary(dealData: any, modelId?: string): Promise<string> {
    try {
      const selectedModel = this.getModelId(modelId);
      console.log(`📋 Enhanced Deal Summary with ${selectedModel}`);

      const systemMessage = {
        role: 'system',
        content: `You are a sales manager using ${selectedModel} with advanced reasoning capabilities. Create comprehensive, actionable deal summaries that help sales teams focus on what matters most. Use advanced reasoning to identify patterns and strategic insights.`
      };

      const userMessage = {
        role: 'user',
        content: `
          Create a comprehensive deal summary using advanced reasoning:
          
          Deal: ${dealData.title}
          Company: ${dealData.company}
          Contact: ${dealData.contact}
          Value: $${dealData.value?.toLocaleString()}
          Stage: ${dealData.stage}
          Probability: ${dealData.probability}%
          Priority: ${dealData.priority}
          Due Date: ${dealData.dueDate ? new Date(dealData.dueDate).toLocaleDateString() : 'Not set'}
          Notes: ${dealData.notes || 'No notes'}
          Last Activity: ${dealData.lastActivity || 'None'}
          Tags: ${(dealData.tags || []).join(', ')}
          
          Using your advanced reasoning capabilities:
          1. Analyze the deal's current position and trajectory
          2. Identify hidden risks and opportunities
          3. Consider competitive factors and market timing
          4. Evaluate stakeholder engagement and influence
          5. Assess timeline feasibility and resource requirements
          6. Predict likely outcomes and contingencies
          
          Provide a clear, actionable summary highlighting:
          - Executive summary (2-3 sentences)
          - Key opportunities and competitive advantages
          - Potential risks and mitigation strategies
          - Critical next steps with timelines
          - Resource requirements and stakeholder engagement needs
          - Timeline considerations and milestone recommendations
          
          Format as a structured, easy-to-scan summary.
        `
      };

      const response = await this.makeGatewayRequest(
        [systemMessage, userMessage],
        'deal-summary',
        selectedModel,
        { maxTokens: 1000 }
      );

      return response;
    } catch (error) {
      console.error('Enhanced deal summary failed:', error);
      return this.generateFallbackDealSummary(dealData);
    }
  }

  async suggestNextActions(dealData: any, modelId?: string): Promise<string[]> {
    try {
      const selectedModel = this.getModelId(modelId);
      console.log(`🎯 Enhanced Next Actions with ${selectedModel}`);

      const model = getModelById(selectedModel);
      const maxActions = model?.family === 'GPT-5' ? 8 : 6; // More actions for GPT-5

      const systemMessage = {
        role: 'system',
        content: `You are a sales coach using ${selectedModel} with advanced reasoning capabilities. Suggest specific actions that sales teams can take immediately to advance deals. Use advanced reasoning to prioritize actions based on deal context and likelihood of success.`
      };

      const userMessage = {
        role: 'user',
        content: `
          Suggest ${maxActions} strategic next actions for this deal using advanced reasoning:
          
          Deal: ${dealData.title}
          Stage: ${dealData.stage}
          Probability: ${dealData.probability}%
          Value: $${dealData.value?.toLocaleString()}
          Priority: ${dealData.priority}
          Due Date: ${dealData.dueDate ? new Date(dealData.dueDate).toLocaleDateString() : 'Not set'}
          Notes: ${dealData.notes || 'No notes'}
          Last Activity: ${dealData.lastActivity || 'None'}
          Company: ${dealData.company}
          Contact: ${dealData.contact}
          
          Using your advanced reasoning capabilities:
          1. Analyze the current deal dynamics and momentum
          2. Consider the contact's role and decision-making power
          3. Evaluate timing and competitive factors
          4. Assess risk factors that need immediate attention
          5. Identify the most impactful actions for this specific situation
          6. Prioritize actions by likelihood of advancing the deal
          
          Provide ${maxActions} specific, actionable next steps as a JSON array of strings.
          Focus on actions that will:
          - Move the deal forward to the next stage
          - Increase probability of closure
          - Address any potential risks
          - Maintain momentum and engagement
          - Leverage the specific context of this deal
          
          Each action should be immediately actionable and include specific details.
        `
      };

      const response = await this.makeGatewayRequest(
        [systemMessage, userMessage],
        'next-actions',
        selectedModel,
        { maxTokens: 1000 }
      );

      return JSON.parse(response);
    } catch (error) {
      console.error('Enhanced next actions failed:', error);
      return this.generateFallbackNextActions(dealData);
    }
  }

  async generatePsychologicalProfile(contact: Contact, modelId?: string): Promise<any> {
    try {
      const selectedModel = this.getModelId(modelId);
      console.log(`🧠 Psychological Profile Generation with ${selectedModel}`);

      const systemMessage = {
        role: 'system',
        content: `You are an expert sales psychologist using ${selectedModel} with advanced reasoning capabilities. Analyze contacts to understand their personality, communication preferences, and decision-making patterns. Use advanced reasoning to infer psychological traits from available data.`
      };

      const userMessage = {
        role: 'user',
        content: `
          Generate a detailed psychological profile for this contact using advanced reasoning:
          
          Contact: ${contact.name}
          Title: ${contact.title}
          Company: ${contact.company}
          Industry: ${contact.industry || 'Unknown'}
          Status: ${contact.status}
          Interest Level: ${contact.interestLevel}
          Sources: ${contact.sources.join(', ')}
          Notes: ${contact.notes || 'No notes'}
          Last Connected: ${contact.lastConnected || 'Unknown'}
          
          Using your advanced reasoning capabilities:
          1. Infer personality traits from their role and industry
          2. Analyze communication preferences based on interaction patterns
          3. Predict decision-making style from their position and context
          4. Identify likely motivations and psychological triggers
          5. Anticipate potential objections and resistance points
          6. Assess their influence level within their organization
          
          Provide a comprehensive psychological profile in JSON format:
          {
            "personalityTraits": ["trait1", "trait2", "trait3"],
            "communicationStyle": "formal|casual|technical|relationship-focused",
            "decisionMakingStyle": "analytical|intuitive|consensus-driven|authoritative",
            "motivations": ["motivation1", "motivation2"],
            "potentialObjections": ["objection1", "objection2"],
            "psychologicalTriggers": ["trigger1", "trigger2"],
            "influenceLevel": "high|medium|low",
            "riskTolerance": "high|medium|low",
            "urgencyLevel": "immediate|planned|exploratory",
            "generatedAt": "${new Date().toISOString()}",
            "confidence": <number between 0-100>,
            "reasoningPath": "explanation of the reasoning process"
          }
        `
      };

      const response = await this.makeGatewayRequest(
        [systemMessage, userMessage],
        'psychological-profile',
        selectedModel,
        { maxTokens: 1200 }
      );

      return JSON.parse(response);
    } catch (error) {
      console.error('Psychological profile generation failed:', error);
      return this.generateFallbackProfile(contact);
    }
  }

  async generateDetailedScoreAnalysis(contact: Contact, modelId?: string): Promise<any> {
    try {
      const selectedModel = this.getModelId(modelId);
      console.log(`📊 Detailed Score Analysis with ${selectedModel} - Advanced Reasoning`);

      const systemMessage = {
        role: 'system',
        content: `You are an expert sales strategist using ${selectedModel} with advanced reasoning and tool-calling capabilities. Analyze contacts using structured reasoning frameworks and provide actionable insights.

AVAILABLE TOOLS:
1. analyze_contact_profile - Deep psychological and behavioral analysis
2. calculate_engagement_score - Quantitative engagement metrics
3. predict_conversion_probability - Statistical conversion modeling
4. identify_risk_factors - Risk assessment and mitigation
5. suggest_optimization_actions - Actionable improvement recommendations

Use these tools systematically to build a comprehensive analysis.`
      };

      const userMessage = {
        role: 'user',
        content: `Perform a comprehensive contact analysis using advanced reasoning and available tools:

CONTACT DATA:
- Name: ${contact.name}
- Title: ${contact.title}
- Company: ${contact.company}
- Industry: ${contact.industry || 'Unknown'}
- Status: ${contact.status}
- Interest Level: ${contact.interestLevel}
- Current AI Score: ${contact.aiScore || 'Not scored'}
- Sources: ${contact.sources.join(', ')}
- Custom Fields: ${JSON.stringify(contact.customFields || {})}
- Notes: ${contact.notes || 'No notes'}
- Last Connected: ${contact.lastConnected || 'Unknown'}

ANALYSIS FRAMEWORK:
1. Use analyze_contact_profile to understand psychological drivers
2. Use calculate_engagement_score for quantitative assessment
3. Use predict_conversion_probability for statistical modeling
4. Use identify_risk_factors for risk mitigation
5. Use suggest_optimization_actions for actionable recommendations

Provide a structured analysis with:
- Executive summary of contact potential
- Detailed factor breakdown with weights and impacts
- Risk assessment and mitigation strategies
- Specific optimization recommendations
- Predictive insights for next 30/60/90 days

Format as structured JSON with clear reasoning paths.`
      };

      const response = await this.makeGatewayRequest(
        [systemMessage, userMessage],
        'detailed-score-analysis',
        selectedModel,
        {
          maxTokens: 2000,
          temperature: 0.3,
          tools: this.getAnalysisTools(),
          tool_choice: "auto"
        }
      );

      return JSON.parse(response);
    } catch (error) {
      console.error('Advanced detailed score analysis failed:', error);
      return this.generateFallbackScoreAnalysis(contact);
    }
  }

  // Advanced tool definitions for enhanced reasoning
  private getAnalysisTools() {
    return [
      {
        type: "function",
        function: {
          name: "analyze_contact_profile",
          description: "Perform deep psychological and behavioral analysis of contact",
          parameters: {
            type: "object",
            properties: {
              contactData: { type: "object" },
              analysisDepth: { type: "string", enum: ["basic", "detailed", "comprehensive"] }
            },
            required: ["contactData"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "calculate_engagement_score",
          description: "Calculate quantitative engagement metrics",
          parameters: {
            type: "object",
            properties: {
              interactionHistory: { type: "array" },
              timeFrame: { type: "string", enum: ["7d", "30d", "90d", "all"] }
            },
            required: ["interactionHistory"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "predict_conversion_probability",
          description: "Predict statistical conversion probability",
          parameters: {
            type: "object",
            properties: {
              contactProfile: { type: "object" },
              historicalData: { type: "array" },
              predictionHorizon: { type: "string", enum: ["30d", "60d", "90d"] }
            },
            required: ["contactProfile"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "identify_risk_factors",
          description: "Identify and assess risk factors",
          parameters: {
            type: "object",
            properties: {
              contactData: { type: "object" },
              riskThreshold: { type: "string", enum: ["low", "medium", "high"] }
            },
            required: ["contactData"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "suggest_optimization_actions",
          description: "Suggest actionable optimization recommendations",
          parameters: {
            type: "object",
            properties: {
              currentScore: { type: "number" },
              targetScore: { type: "number" },
              timeFrame: { type: "string", enum: ["immediate", "short_term", "long_term"] }
            },
            required: ["currentScore"]
          }
        }
      }
    ];
  }

  // Advanced reasoning with streaming for real-time insights
  async generateStreamingAnalysis(contact: Contact, onChunk?: (chunk: string) => void): Promise<any> {
    try {
      const selectedModel = this.getModelId();
      console.log(`🌊 Streaming Analysis with ${selectedModel} - Advanced Reasoning`);

      const systemMessage = {
        role: 'system',
        content: `You are an expert sales analyst using ${selectedModel} with advanced streaming reasoning capabilities. Provide real-time analysis with step-by-step reasoning that streams insights as you process them.

STREAMING ANALYSIS FRAMEWORK:
1. Initial Data Assessment (stream first insights)
2. Pattern Recognition (stream identified patterns)
3. Risk Analysis (stream risk factors as identified)
4. Opportunity Identification (stream opportunities)
5. Predictive Modeling (stream predictions)
6. Action Recommendations (stream final recommendations)

Use streaming to provide immediate value while building comprehensive analysis.`
      };

      const userMessage = {
        role: 'user',
        content: `Perform streaming analysis of this contact with real-time insights:

CONTACT: ${contact.name} (${contact.title} at ${contact.company})
INDUSTRY: ${contact.industry || 'Unknown'}
STATUS: ${contact.status} | INTEREST: ${contact.interestLevel}
SCORE: ${contact.aiScore || 'Not scored'}

Begin streaming analysis immediately with initial assessment, then provide progressive insights.`
      };

      const response = await this.makeStreamingGatewayRequest(
        [systemMessage, userMessage],
        'streaming-analysis',
        selectedModel,
        onChunk
      );

      return JSON.parse(response);
    } catch (error) {
      console.error('Streaming analysis failed:', error);
      return this.generateFallbackAnalysis(contact);
    }
  }

  // Streaming request method for real-time responses
  private async makeStreamingGatewayRequest(
    messages: Array<{ role: string; content: string }>,
    taskType: string,
    modelId?: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/ai-gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        messages,
        taskType,
        modelId: this.getModelId(modelId),
        stream: true,
        onChunk
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`AI streaming error: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }

    throw new Error('Invalid streaming response format from AI service');
  }

  // Fallback methods for when AI gateway is unavailable
  private generateFallbackResponse(taskType: string, messages: any[]): string {
    const contact = messages.find(m => m.content.includes('Contact:'));
    
    switch (taskType) {
      case 'contact-analysis':
        return JSON.stringify({
          score: 60,
          insights: ['Contact data available for analysis'],
          recommendations: ['Schedule follow-up meeting'],
          riskFactors: ['Limited AI analysis available'],
          reasoningPath: 'Fallback analysis based on basic heuristics',
          confidenceLevel: 40
        });
      case 'email-generation':
        return `Subject: Following up on our conversation

Hi there,

I wanted to follow up on our previous discussion about your business needs.

I believe our solution could provide value to your team. Would you be available for a brief call this week?

Best regards,
[Your Name]`;
      default:
        return 'AI analysis temporarily unavailable. Please try again later.';
    }
  }

  private generateFallbackAnalysis(contact: Contact): AIContactAnalysis {
    let score = 50;
    if (contact.interestLevel === 'hot') score += 30;
    if (contact.status === 'customer') score += 20;
    if (contact.sources.includes('Referral')) score += 15;

    return {
      score: Math.min(100, score),
      insights: ['Fallback analysis based on available data'],
      recommendations: ['Consider scheduling follow-up'],
      riskFactors: ['Limited analysis available'],
      reasoningPath: 'Basic heuristic analysis',
      confidenceLevel: 40
    };
  }

  private generateFallbackEmail(contact: Contact, context?: string): string {
    return `Subject: Following up on our conversation

Hi ${contact.firstName || contact.name.split(' ')[0]},

I hope this email finds you well. I wanted to follow up on our recent discussion about ${contact.company}'s ${context || 'business needs'}.

Given your role as ${contact.title}, I believe our solution could provide significant value to your team.

Would you be available for a brief 15-minute call this week to explore how we can help ${contact.company} achieve its objectives?

Best regards,
[Your Name]`;
  }

  private generateFallbackInsights(contact: Contact): string[] {
    const insights = ['Follow up within 24 hours', 'Research company background'];
    if (contact.interestLevel === 'hot') {
      insights.push('High priority - immediate action required');
    }
    return insights;
  }

  private generateFallbackDealSummary(dealData: any): string {
    return `## Deal Summary: ${dealData.title}

**Company:** ${dealData.company}
**Value:** $${dealData.value?.toLocaleString()}
**Stage:** ${dealData.stage}
**Probability:** ${dealData.probability}%

Basic analysis available. Enhanced AI analysis temporarily unavailable.`;
  }

  private generateFallbackNextActions(dealData: any): string[] {
    switch (dealData.stage) {
      case 'qualification':
        return ['Schedule discovery call', 'Send qualification questionnaire', 'Research decision makers'];
      case 'proposal':
        return ['Follow up on proposal', 'Schedule presentation meeting', 'Address concerns'];
      case 'negotiation':
        return ['Review contract terms', 'Schedule stakeholder meeting', 'Prepare alternatives'];
      default:
        return ['Schedule follow-up', 'Send relevant materials', 'Connect with stakeholders'];
    }
  }

  private generateFallbackProfile(contact: Contact): any {
    return {
      personalityTraits: ['Professional', 'Goal-oriented'],
      communicationStyle: 'formal',
      decisionMakingStyle: 'analytical',
      motivations: ['Business growth', 'Efficiency'],
      potentialObjections: ['Cost', 'Implementation time'],
      psychologicalTriggers: ['ROI', 'Case studies'],
      influenceLevel: 'medium',
      riskTolerance: 'medium',
      urgencyLevel: 'planned',
      generatedAt: new Date().toISOString(),
      confidence: 40,
      reasoningPath: 'Fallback profile based on role and industry patterns'
    };
  }

  private generateFallbackScoreAnalysis(contact: Contact): any {
    return {
      score: contact.aiScore || 60,
      narrative: `Basic analysis for ${contact.name}. Enhanced AI analysis temporarily unavailable.`,
      keyFactors: [
        {
          factor: 'Basic Data Available',
          impact: 'neutral',
          weight: 50,
          explanation: 'Standard contact information is available for analysis.'
        }
      ],
      warningFlags: ['Enhanced analysis unavailable'],
      opportunityFlags: ['Contact ready for engagement'],
      recommendedActions: ['Schedule follow-up', 'Research company needs'],
      generatedAt: new Date().toISOString(),
      aiProvider: 'Fallback Analysis'
    };
  }
}

export const useEnhancedOpenAI = (): OpenAIService => {
  return new EnhancedOpenAIService();
};

export { EnhancedOpenAIService };
export type { OpenAIService };