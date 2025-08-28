/**
 * Enhanced Gemini Service with GPT-5 fallback integration
 * Routes through secure AI Gateway and supports Gemini 2.0 features
 */

import { Contact } from '../types/contact';
import { AIContactAnalysis } from '../types/contact';
import { getAIGatewayService } from './aiGatewayService';
import { getModelById } from '../config/aiModels';

interface GeminiService {
  analyzeContact: (contact: Contact, modelId?: string) => Promise<AIContactAnalysis>;
  generateEmail: (contact: Contact, context?: string, modelId?: string) => Promise<string>;
  getInsights: (contact: Contact, modelId?: string) => Promise<string[]>;
  generateDealSummary: (dealData: any, modelId?: string) => Promise<string>;
  suggestNextActions: (dealData: any, modelId?: string) => Promise<string[]>;
  researchCompany: (companyName: string, domain?: string, modelId?: string) => Promise<any>;
  findContactInfo: (personName: string, companyName?: string, modelId?: string) => Promise<any>;
  isAvailable: () => Promise<boolean>;
}

class EnhancedGeminiService implements GeminiService {
  private gateway = getAIGatewayService();
  private defaultModel = 'gemini-2.0-flash-exp'; // Use latest Gemini model

  private getModelId(modelId?: string): string {
    return modelId || import.meta.env.VITE_GEMINI_MODEL || this.defaultModel;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.gateway.healthCheck();
      return health.providers.includes('gemini');
    } catch {
      return false;
    }
  }

  private async makeGatewayRequest(
    prompt: string,
    taskType: string,
    modelId?: string,
    systemInstruction?: string,
    options: any = {}
  ): Promise<string> {
    // Route to specific edge function based on task type
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    const functionMap: Record<string, string> = {
      'company-research': 'company-researcher',
      'contact-research': 'company-researcher',
      'social-media-discovery': 'social-discovery',
      'app-enrichment': 'social-discovery',
      'channel-identification': 'social-discovery'
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
        prompt,
        systemInstruction,
        taskType,
        modelId: this.getModelId(modelId),
        ...options
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`AI service error: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    } else if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    
    throw new Error('Invalid response format from AI service');
  }

  async analyzeContact(contact: Contact, modelId?: string): Promise<AIContactAnalysis> {
    try {
      const selectedModel = this.getModelId(modelId);
      const model = getModelById(selectedModel);
      
      console.log(`🔍 Enhanced Gemini Contact Analysis with ${selectedModel}`);

      const systemInstruction = `You are an expert sales analyst using ${model?.name || selectedModel} with comprehensive research capabilities. Provide detailed, actionable insights about sales contacts that will help close more deals. Use your research and analysis capabilities to identify patterns and opportunities.`;

      const prompt = `
        Analyze this sales contact and provide a detailed assessment using Gemini's enhanced capabilities:
        
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
        
        Using Gemini's research and reasoning capabilities:
        1. Analyze industry context and market trends affecting this contact
        2. Evaluate their role's typical challenges and decision-making process
        3. Consider company size and technology adoption patterns
        4. Assess engagement patterns and buying signals
        5. Identify competitive landscape and timing factors
        
        Provide a comprehensive JSON response:
        {
          "score": <number between 0-100>,
          "insights": ["insight1", "insight2", "insight3"],
          "recommendations": ["recommendation1", "recommendation2"],
          "riskFactors": ["risk1", "risk2"],
          "industryContext": "relevant industry insights",
          "marketTiming": "assessment of market timing factors",
          "competitiveFactors": ["factor1", "factor2"]
        }
        
        Focus on actionable insights that leverage Gemini's research capabilities.
      `;

      const response = await this.makeGatewayRequest(
        prompt,
        'contact-analysis',
        selectedModel,
        systemInstruction,
        { temperature: 0.3, maxTokens: 1500 }
      );

      const analysis = JSON.parse(response);
      return {
        score: Math.min(100, Math.max(0, analysis.score)),
        insights: analysis.insights || [],
        recommendations: analysis.recommendations || [],
        riskFactors: analysis.riskFactors || [],
        industryContext: analysis.industryContext,
        marketTiming: analysis.marketTiming,
        competitiveFactors: analysis.competitiveFactors
      };
    } catch (error) {
      console.error('Enhanced Gemini contact analysis failed:', error);
      return this.generateFallbackAnalysis(contact);
    }
  }

  async generateEmail(contact: Contact, context?: string, modelId?: string): Promise<string> {
    try {
      const selectedModel = this.getModelId(modelId);
      const model = getModelById(selectedModel);
      
      console.log(`📧 Enhanced Gemini Email Generation with ${selectedModel}`);

      const systemInstruction = `You are an expert sales copywriter using ${model?.name || selectedModel} with comprehensive research and writing capabilities. Write high-converting, personalized sales emails that get responses and drive action while maintaining professionalism.`;

      const prompt = `
        Generate a professional sales email using Gemini's enhanced capabilities:
        
        Contact: ${contact.name} (${contact.title} at ${contact.company})
        Context: ${context || 'General follow-up'}
        Industry: ${contact.industry || 'Unknown'}
        Interest Level: ${contact.interestLevel}
        Status: ${contact.status}
        Sources: ${(contact.sources || []).join(', ')}
        Previous notes: ${contact.notes || 'No previous notes'}
        Recent interactions: ${contact.lastConnected || 'None'}
        
        Using Gemini's research and writing capabilities:
        1. Research industry-specific challenges and trends
        2. Understand the contact's role and typical responsibilities
        3. Craft messaging that resonates with their specific situation
        4. Use appropriate language and tone for their industry and role
        5. Include relevant, industry-specific value propositions
        6. Create compelling calls-to-action based on their interest level
        
        Create a personalized, professional email that:
        - Uses industry-appropriate language and references
        - Addresses their likely pain points and challenges
        - Provides value proposition tailored to their specific role
        - Has a compelling call-to-action appropriate for their interest level
        - Demonstrates understanding of their company and industry context
        - Is the optimal length and tone for their profile
        
        Format as a complete email with subject line.
      `;

      const response = await this.makeGatewayRequest(
        prompt,
        'email-generation',
        selectedModel,
        systemInstruction,
        { temperature: 0.7, maxTokens: 800 }
      );

      return response;
    } catch (error) {
      console.error('Enhanced Gemini email generation failed:', error);
      return this.generateFallbackEmail(contact, context);
    }
  }

  async getInsights(contact: Contact, modelId?: string): Promise<string[]> {
    try {
      const selectedModel = this.getModelId(modelId);
      const model = getModelById(selectedModel);
      
      console.log(`💡 Enhanced Gemini Insights with ${selectedModel}`);

      const maxInsights = model?.family === 'Gemini 2.0' ? 8 : 6;

      const systemInstruction = `You are a sales strategist using ${model?.name || selectedModel} with comprehensive research capabilities. Provide specific, actionable insights that sales teams can immediately implement.`;

      const prompt = `
        Generate ${maxInsights} strategic insights about this sales contact using Gemini's research capabilities:
        
        Contact: ${contact.name} - ${contact.title} at ${contact.company}
        Status: ${contact.status}
        Interest: ${contact.interestLevel}
        Industry: ${contact.industry || 'Unknown'}
        Sources: ${(contact.sources || []).join(', ')}
        Recent interactions: ${contact.lastConnected || 'None'}
        Custom data: ${JSON.stringify(contact.customFields || {})}
        
        Using Gemini's research and analysis capabilities:
        1. Research industry trends affecting their business
        2. Analyze their role's typical challenges and priorities
        3. Consider market timing and competitive factors
        4. Evaluate their company's likely technology adoption patterns
        5. Assess their position in the buying journey
        6. Identify strategic opportunities and timing
        
        Provide insights as a JSON array of strings.
        Focus on sales strategy, timing, approach recommendations, and strategic opportunities.
        Each insight should be specific, actionable, and leverage industry knowledge.
      `;

      const response = await this.makeGatewayRequest(
        prompt,
        'insights-generation',
        selectedModel,
        systemInstruction,
        { temperature: 0.6, maxTokens: 1200 }
      );

      return JSON.parse(response);
    } catch (error) {
      console.error('Enhanced Gemini insights failed:', error);
      return this.generateFallbackInsights(contact);
    }
  }

  async generateDealSummary(dealData: any, modelId?: string): Promise<string> {
    try {
      const selectedModel = this.getModelId(modelId);
      console.log(`📋 Enhanced Gemini Deal Summary with ${selectedModel}`);

      const systemInstruction = `You are a sales manager using Gemini with comprehensive research and analysis capabilities. Create clear, actionable deal summaries that help sales teams focus on what matters most.`;

      const prompt = `
        Create a comprehensive deal summary using Gemini's research capabilities:
        
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
        
        Using Gemini's research and analysis capabilities:
        1. Research the company's industry and market position
        2. Analyze competitive factors and market timing
        3. Evaluate the deal's strategic importance
        4. Consider implementation and resource requirements
        5. Assess stakeholder dynamics and decision processes
        
        Provide a clear, actionable summary highlighting:
        - Executive summary with key points
        - Market context and competitive positioning
        - Strategic opportunities and risks
        - Critical next steps with timelines
        - Resource and stakeholder considerations
        
        Format as a structured, scannable summary.
      `;

      const response = await this.makeGatewayRequest(
        prompt,
        'deal-summary',
        selectedModel,
        systemInstruction,
        { temperature: 0.4, maxTokens: 1000 }
      );

      return response;
    } catch (error) {
      console.error('Enhanced Gemini deal summary failed:', error);
      return `Deal Summary: ${dealData.title} with ${dealData.company} valued at $${dealData.value?.toLocaleString()}. Currently in ${dealData.stage} stage.`;
    }
  }

  async suggestNextActions(dealData: any, modelId?: string): Promise<string[]> {
    try {
      const selectedModel = this.getModelId(modelId);
      const model = getModelById(selectedModel);
      
      console.log(`🎯 Enhanced Gemini Next Actions with ${selectedModel}`);

      const maxActions = model?.family === 'Gemini 2.0' ? 8 : 6;

      const systemInstruction = `You are a sales coach using Gemini with comprehensive research and strategic capabilities. Suggest specific actions that sales teams can take immediately to advance deals.`;

      const prompt = `
        Suggest ${maxActions} strategic next actions for this deal using Gemini's research capabilities:
        
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
        
        Using Gemini's research and strategic analysis:
        1. Research industry best practices for this deal stage
        2. Consider competitive timing and market factors
        3. Evaluate stakeholder engagement requirements
        4. Assess resource allocation and timeline optimization
        5. Identify risk mitigation strategies
        6. Consider value enhancement opportunities
        
        Provide ${maxActions} specific, actionable next steps as a JSON array of strings.
        Focus on actions that will:
        - Move the deal forward effectively
        - Increase probability of closure
        - Address potential risks proactively
        - Optimize timing and resource allocation
        - Leverage market opportunities
        
        Each action should be immediately actionable with specific details.
      `;

      const response = await this.makeGatewayRequest(
        prompt,
        'next-actions',
        selectedModel,
        systemInstruction,
        { temperature: 0.5, maxTokens: 1000 }
      );

      return JSON.parse(response);
    } catch (error) {
      console.error('Enhanced Gemini next actions failed:', error);
      return this.generateFallbackNextActions(dealData);
    }
  }

  async researchCompany(companyName: string, domain?: string, modelId?: string): Promise<any> {
    try {
      const selectedModel = this.getModelId(modelId);
      console.log(`🏢 Enhanced Company Research with ${selectedModel}`);

      const systemInstruction = `You are a business intelligence analyst using Gemini with comprehensive research capabilities. Provide detailed, accurate information that helps sales teams understand prospects better.`;

      const prompt = `
        Research and provide comprehensive information about this company using Gemini's research capabilities:
        
        Company Name: ${companyName}
        Domain: ${domain || 'Unknown'}
        
        Using Gemini's research capabilities:
        1. Analyze the company's industry and market position
        2. Research recent business developments and news
        3. Identify potential business challenges and opportunities
        4. Evaluate technology adoption patterns
        5. Assess competitive landscape and positioning
        6. Research key decision makers and organizational structure
        
        Provide detailed information in JSON format:
        {
          "name": "${companyName}",
          "industry": "industry classification",
          "description": "comprehensive company description",
          "keyFacts": ["fact1", "fact2", "fact3"],
          "businessModel": "description of business model",
          "targetMarket": "their target customers",
          "potentialNeeds": ["need1", "need2", "need3"],
          "salesApproach": "recommended approach for selling to this company",
          "keyDecisionMakers": ["typical roles that make decisions"],
          "competitiveLandscape": ["main competitors"],
          "recentTrends": ["industry trends affecting this company"],
          "technologyAdoption": "assessment of their tech adoption patterns",
          "businessChallenges": ["challenge1", "challenge2"],
          "marketOpportunities": ["opportunity1", "opportunity2"],
          "recommendedTiming": "optimal timing for outreach"
        }
      `;

      const response = await this.makeGatewayRequest(
        prompt,
        'company-research',
        selectedModel,
        systemInstruction,
        { temperature: 0.3, maxTokens: 1500 }
      );

      return JSON.parse(response);
    } catch (error) {
      console.error('Enhanced company research failed:', error);
      return this.generateFallbackCompanyInfo(companyName, domain);
    }
  }

  async findContactInfo(personName: string, companyName?: string, modelId?: string): Promise<any> {
    try {
      const selectedModel = this.getModelId(modelId);
      console.log(`👤 Enhanced Contact Research with ${selectedModel}`);

      const systemInstruction = `You are a sales development expert using Gemini with comprehensive research capabilities. Provide strategic advice for connecting with prospects effectively.`;

      const prompt = `
        Provide strategic insights for connecting with this person using Gemini's research capabilities:
        
        Person: ${personName}
        Company: ${companyName || 'Unknown'}
        
        Using Gemini's research and analysis capabilities:
        1. Analyze their likely role and responsibilities
        2. Research industry-specific communication preferences
        3. Identify optimal outreach strategies
        4. Consider their probable challenges and priorities
        5. Assess their influence within the organization
        6. Evaluate timing and context factors
        
        Provide strategic advice in JSON format:
        {
          "name": "${personName}",
          "likelyRole": "probable job function/seniority",
          "contactStrategy": "best approach for initial contact",
          "valueProposition": "what would likely interest them",
          "communicationStyle": "recommended communication approach",
          "bestContactTimes": ["optimal times to reach out"],
          "iceBreakers": ["conversation starters", "topics of interest"],
          "socialMediaTips": ["LinkedIn approach", "other platforms"],
          "emailTips": ["subject line suggestions", "email structure"],
          "meetingTopics": ["discussion points for first meeting"],
          "industryContext": "relevant industry considerations",
          "roleSpecificApproach": "approach tailored to their specific role"
        }
      `;

      const response = await this.makeGatewayRequest(
        prompt,
        'contact-research',
        selectedModel,
        systemInstruction,
        { temperature: 0.4, maxTokens: 1200 }
      );

      return JSON.parse(response);
    } catch (error) {
      console.error('Enhanced contact research failed:', error);
      return this.generateFallbackContactInfo(personName, companyName);
    }
  }

  // Fallback methods
  private generateFallbackResponse(taskType: string, prompt: string): string {
    switch (taskType) {
      case 'contact-analysis':
        return JSON.stringify({
          score: 60,
          insights: ['Contact data available for analysis'],
          recommendations: ['Schedule follow-up meeting'],
          riskFactors: ['Limited analysis available'],
          industryContext: 'Industry research unavailable',
          marketTiming: 'Market timing analysis unavailable'
        });
      case 'email-generation':
        return `Subject: Following up on our conversation

Hi there,

I wanted to follow up on our previous discussion about your business needs.

Would you be available for a brief call this week?

Best regards,
[Your Name]`;
      default:
        return 'Gemini analysis temporarily unavailable. Please try again later.';
    }
  }

  private generateFallbackAnalysis(contact: Contact): AIContactAnalysis {
    let score = 50;
    if (contact.interestLevel === 'hot') score += 30;
    if (contact.status === 'customer') score += 20;
    if (contact.sources.includes('Referral')) score += 15;

    return {
      score: Math.min(100, score),
      insights: ['Basic analysis available'],
      recommendations: ['Consider scheduling follow-up'],
      riskFactors: ['Enhanced analysis unavailable']
    };
  }

  private generateFallbackEmail(contact: Contact, context?: string): string {
    return `Subject: Following up on our conversation

Hi ${contact.firstName || contact.name.split(' ')[0]},

I hope this email finds you well. I wanted to follow up regarding ${contact.company}'s ${context || 'business objectives'}.

Would you be available for a brief call this week?

Best regards,
[Your Name]`;
  }

  private generateFallbackInsights(contact: Contact): string[] {
    return ['Schedule follow-up call', 'Research company background', 'Prepare value proposition'];
  }

  private generateFallbackNextActions(dealData: any): string[] {
    switch (dealData.stage) {
      case 'qualification':
        return ['Schedule discovery call', 'Research requirements', 'Identify stakeholders'];
      case 'proposal':
        return ['Follow up on proposal', 'Address questions', 'Schedule presentation'];
      case 'negotiation':
        return ['Review terms', 'Schedule final meeting', 'Prepare alternatives'];
      default:
        return ['Schedule follow-up', 'Send materials', 'Connect with stakeholders'];
    }
  }

  private generateFallbackCompanyInfo(companyName: string, domain?: string): any {
    return {
      name: companyName,
      industry: 'Technology',
      description: `${companyName} is a company with business potential.`,
      keyFacts: ['Established business', 'Growth-oriented'],
      businessModel: 'B2B services',
      potentialNeeds: ['Efficiency improvements', 'Cost optimization'],
      salesApproach: 'Value-focused approach',
      technologyAdoption: 'Standard adoption patterns',
      businessChallenges: ['Market competition', 'Operational efficiency'],
      marketOpportunities: ['Digital transformation', 'Process improvement']
    };
  }

  private generateFallbackContactInfo(personName: string, companyName?: string): any {
    return {
      name: personName,
      likelyRole: 'Business professional',
      contactStrategy: 'Professional outreach',
      valueProposition: 'Business growth solutions',
      communicationStyle: 'Professional approach',
      bestContactTimes: ['Business hours'],
      iceBreakers: ['Industry trends', 'Business challenges'],
      industryContext: 'Standard industry considerations',
      roleSpecificApproach: 'Professional engagement strategy'
    };
  }

  private generateFallbackSocialChannels(appData: any): any {
    const companyName = appData.name || appData.companyName || 'Unknown';
    const handle = companyName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    
    return {
      socialChannels: {
        linkedin: `https://linkedin.com/company/${handle}`,
        twitter: `https://twitter.com/${handle}`,
        facebook: `https://facebook.com/${handle}`,
        instagram: `https://instagram.com/${handle}`,
        youtube: `https://youtube.com/c/${handle}`,
        github: appData.industry === 'Technology' ? `https://github.com/${handle}` : null
      },
      brandedHashtags: [`#${handle}`, `#${companyName.replace(/\s+/g, '')}`],
      confidence: 40,
      verificationStatus: 'Fallback mode - manual verification required'
    };
  }

  private generateFallbackAppData(appData: any): any {
    return {
      enhancedDescription: `${appData.name || 'Application'} provides business solutions for modern enterprises.`,
      primaryCategory: 'Business Software',
      keyFeatures: ['Core functionality', 'User management', 'Analytics'],
      targetAudience: 'Business professionals',
      socialChannels: this.generateFallbackSocialChannels(appData).socialChannels,
      competitorAnalysis: ['Similar solutions in the market'],
      confidence: 30,
      enhancedBy: 'Fallback Mode'
    };
  }

  private generateFallbackChannels(companyData: any): any {
    const companyName = companyData.name || companyData.companyName || 'Unknown';
    const handle = companyName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    
    return {
      discoveredChannels: {
        linkedin: {
          url: `https://linkedin.com/company/${handle}`,
          handle: handle,
          confidence: 60,
          verified: 'Unknown'
        },
        twitter: {
          url: `https://twitter.com/${handle}`,
          handle: `@${handle}`,
          confidence: 50,
          verified: 'Unknown'
        },
        facebook: {
          url: `https://facebook.com/${handle}`,
          handle: handle,
          confidence: 45,
          verified: 'Unknown'
        }
      },
      prioritizedChannels: ['LinkedIn', 'Twitter', 'Facebook'],
      confidence: 45,
      enhancedBy: 'Fallback Mode'
    };
  }
}

export const useEnhancedGemini = (): GeminiService => {
  return new EnhancedGeminiService();
};

export { EnhancedGeminiService };
export type { GeminiService };