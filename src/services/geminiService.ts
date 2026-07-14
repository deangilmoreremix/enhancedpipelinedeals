import { Contact } from '../types/contact';
import { AIContactAnalysis } from '../types/contact';
import { AI_MODELS, getModelById } from '../config/aiModels';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

interface GeminiService {
  analyzeContact: (contact: Contact, modelId?: string) => Promise<AIContactAnalysis>;
  generateEmail: (contact: Contact, context?: string, modelId?: string) => Promise<string>;
  getInsights: (contact: Contact, modelId?: string) => Promise<string[]>;
  generateDealSummary: (dealData: any, modelId?: string) => Promise<string>;
  suggestNextActions: (dealData: any, modelId?: string) => Promise<string[]>;
  researchCompany: (companyName: string, domain?: string, modelId?: string) => Promise<any>;
  findContactInfo: (personName: string, companyName?: string, modelId?: string) => Promise<any>;
  getAvailableModels: () => typeof AI_MODELS;
}

class RealGeminiService implements GeminiService {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor() {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!this.apiKey) {
      console.warn('Gemini API key not found. Using mock responses.');
    }
  }

  getAvailableModels() {
    return AI_MODELS.filter(model => model.provider === 'gemini');
  }

  private getModelId(modelId?: string): string {
    if (modelId) return modelId;
    return import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash';
  }

  private async makeRequest(prompt: string, systemInstruction?: string, modelId?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const selectedModelId = this.getModelId(modelId);
    const model = getModelById(selectedModelId);

    if (!model || model.provider !== 'gemini') {
      throw new Error(`Invalid Gemini model: ${selectedModelId}`);
    }

    try {
      const requestBody = {
        contents: [{
          parts: [{
            text: systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: model.family === 'gemma' ? 40 : 64,
          topP: 0.95,
          maxOutputTokens: Math.min(model.maxTokens, 2048),
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      const response = await fetch(
        `${this.baseUrl}/models/${selectedModelId}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: GeminiResponse = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response candidates from Gemini API');
      }

      return data.candidates[0]?.content?.parts[0]?.text || '';
    } catch (error) {
      console.error(`Gemini API request failed for model ${selectedModelId}:`, error);
      throw error;
    }
  }

  async analyzeContact(contact: Contact, modelId?: string): Promise<AIContactAnalysis> {
    try {
      const selectedModelId = this.getModelId(modelId);
      const model = getModelById(selectedModelId);

      const prompt = `
        Analyze this sales contact and provide a detailed assessment:

        Contact Information:
        - Name: ${contact.name}
        - Title: ${contact.title}
        - Company: ${contact.company}
        - Industry: ${contact.industry || 'Unknown'}
        - Status: ${contact.status}
        - Recent interactions: ${contact.lastConnected || 'None'}
        - Interest Level: ${contact.interestLevel}
        - Sources: ${contact.sources.join(', ')}
        - Custom Fields: ${JSON.stringify(contact.customFields || {})}
        - Notes: ${contact.notes || 'No notes'}

        Provide a JSON response with the following structure:
        {
          "score": <number between 0-100>,
          "insights": ["insight1", "insight2", "insight3"],
          "recommendations": ["recommendation1", "recommendation2"],
          "riskFactors": ["risk1", "risk2"]
        }

        Base the score on factors like company size, industry, contact seniority, engagement level, and data completeness.
        ${model?.family === 'gemma' ? 'Focus on clear, actionable insights that directly help with sales strategy.' : ''}
      `;

      const systemInstruction = `You are an expert sales analyst using ${model?.name || selectedModelId}. Provide detailed, actionable insights about sales contacts that will help close more deals.`;

      const response = await this.makeRequest(prompt, systemInstruction, selectedModelId);
      const analysis = JSON.parse(response);
      return {
        score: Math.min(100, Math.max(0, analysis.score)),
        insights: analysis.insights || [],
        recommendations: analysis.recommendations || [],
        riskFactors: analysis.riskFactors || []
      };
    } catch (error) {
      console.error('Failed to analyze contact with Gemini:', error);
      return this.generateBasicAnalysis(contact);
    }
  }

  async generateEmail(contact: Contact, context?: string, modelId?: string): Promise<string> {
    try {
      const selectedModelId = this.getModelId(modelId);
      const model = getModelById(selectedModelId);

      const prompt = `
        Generate a professional sales email for this contact:

        Contact: ${contact.name} (${contact.title} at ${contact.company})
        Context: ${context || 'General follow-up'}
        Industry: ${contact.industry || 'Unknown'}
        Interest Level: ${contact.interestLevel}
        Recent interactions: ${contact.lastConnected || 'None'}

        Create a personalized, professional email that:
        1. Addresses them by name and title
        2. References their company and industry
        3. Provides clear value proposition
        4. Has a compelling call-to-action
        5. Is concise, respectful, and persuasive

        Format as a complete email with subject line.
        ${model?.family === 'gemma' ? 'Keep the email concise and direct.' : ''}
      `;

      const systemInstruction = `You are an expert sales copywriter using ${model?.name || selectedModelId}. Write high-converting, personalized sales emails.`;

      const response = await this.makeRequest(prompt, systemInstruction, selectedModelId);
      return response;
    } catch (error) {
      console.error('Failed to generate email with Gemini:', error);
      return this.generateBasicEmail(contact, context);
    }
  }

  async getInsights(contact: Contact, modelId?: string): Promise<string[]> {
    try {
      const selectedModelId = this.getModelId(modelId);
      const model = getModelById(selectedModelId);

      const maxInsights = model?.family === 'gemma' ? 4 : 6;

      const prompt = `
        Generate ${maxInsights} actionable insights about this sales contact:

        ${contact.name} - ${contact.title} at ${contact.company}
        Status: ${contact.status}
        Interest: ${contact.interestLevel}
        Industry: ${contact.industry || 'Unknown'}
        Sources: ${(contact.sources || []).join(', ')}
        Recent interactions: ${contact.lastConnected || 'None'}

        Provide insights as a JSON array of strings.
        Focus on sales strategy, timing, approach recommendations.
        Each insight should be specific and actionable.
        ${model?.family === 'gemma' ? 'Keep insights concise and practical.' : ''}
      `;

      const systemInstruction = `You are a sales strategist using ${model?.name || selectedModelId} with expertise in B2B relationship building.`;

      const response = await this.makeRequest(prompt, systemInstruction, selectedModelId);
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to get insights with Gemini:', error);
      return this.generateBasicInsights(contact);
    }
  }

  async generateDealSummary(dealData: any, modelId?: string): Promise<string> {
    try {
      const selectedModelId = this.getModelId(modelId);
      const model = getModelById(selectedModelId);

      const prompt = `
        Create a comprehensive deal summary:

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

        Provide a clear, actionable summary highlighting:
        - Key opportunities and strengths
        - Potential risks or challenges
        - Critical next steps
        - Timeline considerations
        ${model?.family === 'gemma' ? 'Keep the summary concise and focused on actionable items.' : ''}
      `;

      const systemInstruction = `You are a sales manager using ${model?.name || selectedModelId} with expertise in deal analysis.`;

      const response = await this.makeRequest(prompt, systemInstruction, selectedModelId);
      return response;
    } catch (error) {
      console.error('Failed to generate deal summary with Gemini:', error);
      return `Deal Summary: ${dealData.title} with ${dealData.company} valued at $${dealData.value?.toLocaleString()}. Currently in ${dealData.stage} stage with ${dealData.probability}% probability.`;
    }
  }

  async suggestNextActions(dealData: any, modelId?: string): Promise<string[]> {
    try {
      const selectedModelId = this.getModelId(modelId);
      const model = getModelById(selectedModelId);

      const maxActions = model?.family === 'gemma' ? 4 : 6;

      const prompt = `
        Suggest ${maxActions} next actions for this deal:

        Deal: ${dealData.title}
        Stage: ${dealData.stage}
        Probability: ${dealData.probability}%
        Value: $${dealData.value?.toLocaleString()}
        Priority: ${dealData.priority}
        Due Date: ${dealData.dueDate ? new Date(dealData.dueDate).toLocaleDateString() : 'Not set'}
        Notes: ${dealData.notes || 'No notes'}
        Last Activity: ${dealData.lastActivity || 'None'}

        Provide ${maxActions} specific, actionable next steps as a JSON array of strings.
        Focus on actions that will move the deal forward.
        ${model?.family === 'gemma' ? 'Make actions specific and immediately actionable.' : ''}
      `;

      const systemInstruction = `You are a sales coach using ${model?.name || selectedModelId} with expertise in deal progression.`;

      const response = await this.makeRequest(prompt, systemInstruction, selectedModelId);
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to suggest next actions with Gemini:', error);
      return this.generateBasicNextActions(dealData);
    }
  }

  async researchCompany(companyName: string, domain?: string, modelId?: string): Promise<any> {
    try {
      const selectedModelId = this.getModelId(modelId);
      const model = getModelById(selectedModelId);

      const prompt = `
        Research and provide information about this company:

        Company Name: ${companyName}
        Domain: ${domain || 'Unknown'}

        Provide detailed information in JSON format:
        {
          "name": "${companyName}",
          "industry": "industry classification",
          "description": "detailed company description",
          "keyFacts": ["fact1", "fact2", "fact3"],
          "businessModel": "description of business model",
          "potentialNeeds": ["need1", "need2", "need3"],
          "salesApproach": "recommended approach for selling to this company",
          "keyDecisionMakers": ["typical roles that make decisions"],
          "competitiveLandscape": ["main competitors"]
        }
        ${model?.family === 'gemma' ? 'Focus on actionable business intelligence.' : ''}
      `;

      const systemInstruction = `You are a business intelligence analyst using ${model?.name || selectedModelId}.`;

      const response = await this.makeRequest(prompt, systemInstruction, selectedModelId);
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to research company with Gemini:', error);
      return this.generateBasicCompanyInfo(companyName, domain);
    }
  }

  async findContactInfo(personName: string, companyName?: string, modelId?: string): Promise<any> {
    try {
      const selectedModelId = this.getModelId(modelId);
      const model = getModelById(selectedModelId);

      const prompt = `
        Provide strategic advice for connecting with this person:

        Person: ${personName}
        Company: ${companyName || 'Unknown'}

        Provide strategic advice in JSON format:
        {
          "name": "${personName}",
          "likelyRole": "probable job function/seniority",
          "contactStrategy": "best approach for initial contact",
          "valueProposition": "what would likely interest them",
          "communicationStyle": "recommended communication approach",
          "bestContactTimes": ["optimal times to reach out"],
          "iceBreakers": ["conversation starters", "topics of interest"],
          "emailTips": ["subject line suggestions", "email structure"],
          "meetingTopics": ["discussion points for first meeting"]
        }
        ${model?.family === 'gemma' ? 'Focus on practical, immediately actionable advice.' : ''}
      `;

      const systemInstruction = `You are a sales development expert using ${model?.name || selectedModelId}.`;

      const response = await this.makeRequest(prompt, systemInstruction, selectedModelId);
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to find contact info with Gemini:', error);
      return this.generateBasicContactInfo(personName, companyName);
    }
  }

  // Fallback methods for when API is unavailable
  private generateBasicAnalysis(contact: Contact): AIContactAnalysis {
    let score = 50;
    const insights: string[] = [];
    const recommendations: string[] = [];
    const riskFactors: string[] = [];

    if (contact.interestLevel === 'hot') score += 30;
    else if (contact.interestLevel === 'medium') score += 15;

    if (contact.status === 'customer') score += 20;
    else if (contact.status === 'prospect') score += 10;

    if (contact.sources && contact.sources.includes('Referral')) score += 15;
    if (contact.customFields && Object.keys(contact.customFields).length > 0) score += 10;

    insights.push('Analysis completed with available data');
    recommendations.push('Consider gathering more contact information');

    return { score: Math.min(100, score), insights, recommendations, riskFactors };
  }

  private generateBasicEmail(contact: Contact, context?: string): string {
    return `Subject: Following up on our conversation about ${contact.company}

Hi ${contact.firstName || contact.name},

I hope this email finds you well. I wanted to follow up on our recent discussion about ${contact.company}'s ${context || 'business objectives'}.

Given your role as ${contact.title}, I believe our solution could provide significant value to your team.

Would you be available for a brief 15-minute call this week to explore how we can help ${contact.company} achieve its goals?

Best regards,
[Your Name]`;
  }

  private generateBasicInsights(contact: Contact): string[] {
    const insights: string[] = [];

    if (contact.interestLevel === 'hot') {
      insights.push('🔥 High interest level - priority for immediate follow-up');
    }

    if (contact.sources && contact.sources.includes('Referral')) {
      insights.push('🤝 Referral source indicates higher trust and conversion potential');
    }

    if (contact.status === 'customer') {
      insights.push('✅ Existing customer - focus on expansion and upselling opportunities');
    }

    insights.push('📊 Consider enriching contact data for better targeting');

    return insights;
  }

  private generateBasicNextActions(dealData: any): string[] {
    const actions: string[] = [];

    switch (dealData.stage) {
      case 'qualification':
        actions.push('Schedule detailed discovery call', 'Send qualification questionnaire', 'Research decision-making process');
        break;
      case 'proposal':
        actions.push('Follow up on proposal status', 'Schedule presentation meeting', 'Address any concerns');
        break;
      case 'negotiation':
        actions.push('Review contract terms', 'Schedule final discussion with stakeholders', 'Prepare pricing alternatives');
        break;
      default:
        actions.push('Schedule follow-up meeting', 'Send relevant case studies', 'Connect with key stakeholders');
    }

    return actions;
  }

  private generateBasicCompanyInfo(companyName: string, domain?: string): any {
    return {
      name: companyName,
      industry: 'Technology',
      description: `${companyName} is a company in their industry with growth potential and business needs that align with our solutions.`,
      keyFacts: ['Established business', 'Growth-oriented', 'Technology-focused'],
      businessModel: 'B2B services and solutions',
      potentialNeeds: ['Efficiency improvements', 'Cost optimization', 'Technology modernization'],
      salesApproach: 'Focus on value proposition and ROI demonstration'
    };
  }

  private generateBasicContactInfo(personName: string, companyName?: string): any {
    return {
      name: personName,
      likelyRole: 'Business professional',
      contactStrategy: 'Professional outreach with value-focused messaging',
      valueProposition: 'Solutions that drive business growth and efficiency',
      communicationStyle: 'Professional and respectful approach',
      bestContactTimes: ['Tuesday-Thursday 10am-3pm'],
      iceBreakers: ['Industry trends', 'Business challenges', 'Growth opportunities'],
      emailTips: ['Clear value proposition', 'Personalized content', 'Strong call-to-action']
    };
  }
}

export const useGeminiAI = (): GeminiService => {
  return new RealGeminiService();
};

export { RealGeminiService };
export type { GeminiService };