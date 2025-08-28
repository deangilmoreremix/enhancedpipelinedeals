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
      console.log(`✉️ Enhanced Email Generation with ${selectedModel}`);

      const systemMessage = {
        role: 'system',
        content: `You are an expert sales copywriter using ${selectedModel} with advanced reasoning and creativity. Write high-converting, personalized sales emails that get responses and drive action while maintaining professionalism. Use advanced reasoning to tailor the message based on the contact's profile, role, and company context.`
      };

      const userMessage = {
        role: 'user',
        content: `
          Generate a professional, personalized sales email using advanced reasoning and creativity:
          
          Contact: ${contact.name} (${contact.title} at ${contact.company})
          Context: ${context || 'General follow-up'}
          Industry: ${contact.industry || 'Unknown'}
          Interest Level: ${contact.interestLevel}
          Status: ${contact.status}
          Sources: ${(contact.sources || []).join(', ')}
          Previous notes: ${contact.notes || 'No previous notes'}
          Recent interactions: ${contact.lastConnected || 'None'}
          
          Using your advanced reasoning capabilities:
          1. Analyze the contact's role and likely pain points
          2. Craft a message that resonates with their specific situation
          3. Use industry-specific language and references
          4. Create a compelling value proposition tailored to their role
          5. Include a strong, contextually appropriate call-to-action
          6. Adapt tone based on the contact's profile and interaction history
          
          Create a personalized, professional email that:
          - Addresses them appropriately for their seniority level
          - References their company and industry context
          - Provides clear value proposition tailored to their role
          - Has a compelling call-to-action appropriate for their interest level
          - Is the right length and tone for the context
          - Shows understanding of their likely challenges and priorities
          
          Format as a complete email with subject line.
        `
      };

      const response = await this.makeGatewayRequest(
        [systemMessage, userMessage],
        'email-generation',
        selectedModel,
        { maxTokens: 800 }
      );

      return response;
    } catch (error) {
      console.error('Enhanced email generation failed:', error);
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
      console.log(`📊 Detailed Score Analysis with ${selectedModel}`);

      const systemMessage = {
        role: 'system',
        content: `You are a sales data analyst using ${selectedModel} with advanced reasoning capabilities. Provide detailed, narrative explanations for contact scores that help sales teams understand the 'why' behind the numbers.`
      };

      const userMessage = {
        role: 'user',
        content: `
          Generate a detailed score analysis for this contact using advanced reasoning:
          
          Contact: ${contact.name}
          Title: ${contact.title}
          Company: ${contact.company}
          Industry: ${contact.industry || 'Unknown'}
          Status: ${contact.status}
          Interest Level: ${contact.interestLevel}
          Current AI Score: ${contact.aiScore || 'Not scored'}
          Sources: ${contact.sources.join(', ')}
          Custom Fields: ${JSON.stringify(contact.customFields || {})}
          Notes: ${contact.notes || 'No notes'}
          
          Using your advanced reasoning capabilities:
          1. Calculate a nuanced score considering all available factors
          2. Provide a detailed narrative explaining the reasoning
          3. Identify specific factors that positively and negatively impact the score
          4. Highlight opportunities and warning flags
          5. Suggest specific actions to improve the contact's potential
          
          Provide your analysis in JSON format:
          {
            "score": <number between 0-100>,
            "narrative": "detailed explanation of why this contact received this score",
            "keyFactors": [
              {
                "factor": "factor name",
                "impact": "positive|negative|neutral",
                "weight": <number representing importance>,
                "explanation": "detailed explanation"
              }
            ],
            "warningFlags": ["warning1", "warning2"],
            "opportunityFlags": ["opportunity1", "opportunity2"],
            "recommendedActions": ["action1", "action2"],
            "generatedAt": "${new Date().toISOString()}",
            "aiProvider": "${selectedModel}"
          }
        `
      };

      const response = await this.makeGatewayRequest(
        [systemMessage, userMessage],
        'detailed-score-analysis',
        selectedModel,
        { maxTokens: 1500 }
      );

      return JSON.parse(response);
    } catch (error) {
      console.error('Detailed score analysis failed:', error);
      return this.generateFallbackScoreAnalysis(contact);
    }
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