import { Contact } from '../types/contact';
import { AIContactAnalysis } from '../types/contact';

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface OpenAIService {
  analyzeContact: (contact: Contact, modelId?: string) => Promise<AIContactAnalysis>;
  generateEmail: (contact: Contact, context?: string, modelId?: string) => Promise<string>;
  getInsights: (contact: Contact, modelId?: string) => Promise<string[]>;
  generateDealSummary: (dealData: any, modelId?: string) => Promise<string>;
  suggestNextActions: (dealData: any, modelId?: string) => Promise<string[]>;
}

class RealOpenAIService implements OpenAIService {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';
  private defaultModel: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    this.defaultModel = import.meta.env.VITE_OPENAI_MODEL || 'gpt-5';
    
    if (!this.apiKey) {
      console.warn('OpenAI API key not found. Using mock responses.');
    }
  }

  private async makeRequest(messages: Array<{ role: string; content: string }>, modelId?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const model = modelId || this.defaultModel;
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages,
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data: OpenAIResponse = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('OpenAI API request failed:', error);
      throw error;
    }
  }

  async analyzeContact(contact: Contact, modelId?: string): Promise<AIContactAnalysis> {
    try {
      const prompt = `
        Analyze this sales contact and provide a detailed assessment:
        
        Contact Information:
        - Name: ${contact.name}
        - Title: ${contact.title}
        - Company: ${contact.company}
        - Industry: ${contact.industry || 'Unknown'}
        - Status: ${contact.status}
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
      `;

      const response = await this.makeRequest([
        { role: 'system', content: 'You are an expert sales analyst. Provide detailed, actionable insights about sales contacts.' },
        { role: 'user', content: prompt }
      ]);

      // Parse JSON response
      const analysis = JSON.parse(response);
      return {
        score: Math.min(100, Math.max(0, analysis.score)),
        insights: analysis.insights || [],
        recommendations: analysis.recommendations || [],
        riskFactors: analysis.riskFactors || []
      };
    } catch (error) {
      console.error('Failed to analyze contact:', error);
      // Fallback to basic analysis
      return this.generateBasicAnalysis(contact);
    }
  }

  async generateEmail(contact: Contact, context?: string): Promise<string> {
    try {
      const prompt = `
        Generate a professional sales email for this contact:
        
        Contact: ${contact.name} (${contact.title} at ${contact.company})
        Context: ${context || 'General follow-up'}
        Industry: ${contact.industry || 'Unknown'}
        Previous notes: ${contact.notes || 'No previous notes'}
        
        Create a personalized, professional email that:
        1. Addresses them by name
        2. References their company and role
        3. Provides value proposition
        4. Has a clear call-to-action
        5. Is concise and respectful
        
        Format as a complete email with subject line.
      `;

      const response = await this.makeRequest([
        { role: 'system', content: 'You are an expert sales professional. Write engaging, personalized sales emails that get responses.' },
        { role: 'user', content: prompt }
      ]);

      return response;
    } catch (error) {
      console.error('Failed to generate email:', error);
      return this.generateBasicEmail(contact, context);
    }
  }

  async getInsights(contact: Contact): Promise<string[]> {
    try {
      const prompt = `
        Generate 3-5 quick insights about this sales contact:
        
        ${contact.name} - ${contact.title} at ${contact.company}
        Status: ${contact.status}
        Interest: ${contact.interestLevel}
        Sources: ${(contact.sources || []).join(', ')}
        
        Provide actionable insights as a JSON array of strings.
        Focus on sales strategy, timing, and approach recommendations.
      `;

      const response = await this.makeRequest([
        { role: 'system', content: 'You are a sales strategist. Provide quick, actionable insights.' },
        { role: 'user', content: prompt }
      ]);

      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to get insights:', error);
      return this.generateBasicInsights(contact);
    }
  }

  async generateDealSummary(dealData: any): Promise<string> {
    try {
      const prompt = `
        Summarize this deal opportunity:
        
        Deal: ${dealData.title}
        Company: ${dealData.company}
        Value: $${dealData.value?.toLocaleString()}
        Stage: ${dealData.stage}
        Probability: ${dealData.probability}%
        Notes: ${dealData.notes || 'No notes'}
        
        Provide a concise summary highlighting key points, opportunities, and risks.
      `;

      const response = await this.makeRequest([
        { role: 'system', content: 'You are a sales analyst. Provide clear, actionable deal summaries.' },
        { role: 'user', content: prompt }
      ]);

      return response;
    } catch (error) {
      console.error('Failed to generate deal summary:', error);
      return `Deal Summary: ${dealData.title} with ${dealData.company} valued at $${dealData.value?.toLocaleString()}. Currently in ${dealData.stage} stage with ${dealData.probability}% probability.`;
    }
  }

  async suggestNextActions(dealData: any): Promise<string[]> {
    try {
      const prompt = `
        Suggest next actions for this deal:
        
        Deal: ${dealData.title}
        Stage: ${dealData.stage}
        Probability: ${dealData.probability}%
        Value: $${dealData.value?.toLocaleString()}
        Due Date: ${dealData.dueDate ? new Date(dealData.dueDate).toLocaleDateString() : 'Not set'}
        Notes: ${dealData.notes || 'No notes'}
        
        Provide 3-5 specific next actions as a JSON array of strings.
        Focus on actions that will move the deal forward.
      `;

      const response = await this.makeRequest([
        { role: 'system', content: 'You are a sales coach. Provide specific, actionable next steps.' },
        { role: 'user', content: prompt }
      ]);

      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to suggest next actions:', error);
      return this.generateBasicNextActions(dealData);
    }
  }

  // Fallback methods for when API is unavailable
  private generateBasicAnalysis(contact: Contact): AIContactAnalysis {
    let score = 50;
    const insights: string[] = [];
    const recommendations: string[] = [];
    const riskFactors: string[] = [];

    // Basic scoring logic
    if (contact.interestLevel === 'hot') score += 30;
    else if (contact.interestLevel === 'medium') score += 15;
    
    if (contact.status === 'customer') score += 20;
    else if (contact.status === 'prospect') score += 10;

    if (contact.sources.includes('Referral')) score += 15;
    if (contact.customFields && Object.keys(contact.customFields).length > 0) score += 10;

    // Generate basic insights
    if (score >= 80) {
      insights.push('High-value prospect with strong potential');
      recommendations.push('Schedule immediate follow-up');
    } else if (score >= 60) {
      insights.push('Moderate potential, needs nurturing');
      recommendations.push('Add to targeted campaign');
    }

    return { score: Math.min(100, score), insights, recommendations, riskFactors };
  }

  private generateBasicEmail(contact: Contact, context?: string): string {
    return `Subject: Following up on our conversation

Hi ${contact.firstName || contact.name},

I hope this email finds you well. I wanted to follow up on our recent discussion about ${contact.company}'s ${context || 'business needs'}.

Based on our conversation, I believe our solution could be a great fit for your ${contact.title} role.

Would you be available for a brief call this week to discuss how we can help ${contact.company} achieve its goals?

Best regards,
[Your Name]`;
  }

  private generateBasicInsights(contact: Contact): string[] {
    const insights: string[] = [];
    
    if (contact.interestLevel === 'hot') {
      insights.push('🔥 High interest level - priority follow-up');
    }
    
    if (contact.sources.includes('Referral')) {
      insights.push('🤝 Referral source - higher trust level');
    }
    
    if (contact.status === 'customer') {
      insights.push('✅ Existing customer - expansion opportunity');
    }

    return insights;
  }

  private generateBasicNextActions(dealData: any): string[] {
    const actions: string[] = [];
    
    switch (dealData.stage) {
      case 'qualification':
        actions.push('Schedule discovery call', 'Send qualification questionnaire');
        break;
      case 'proposal':
        actions.push('Follow up on proposal', 'Schedule presentation');
        break;
      case 'negotiation':
        actions.push('Review contract terms', 'Schedule final discussion');
        break;
    }

    return actions;
  }
}

export const useRealOpenAI = (): OpenAIService => {
  return new RealOpenAIService();
};