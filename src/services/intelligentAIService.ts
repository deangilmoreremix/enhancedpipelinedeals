interface AITask {
  type: 'contact-analysis' | 'email-generation' | 'company-research' | 'deal-summary' | 'next-actions' | 'insights' | 'contact-research';
  priority: 'speed' | 'quality' | 'cost';
  complexity: 'low' | 'medium' | 'high';
}

interface ModelPreference {
  primary: 'openai' | 'gemini';
  model: string;
  fallback: 'openai' | 'gemini';
  fallbackModel: string;
  reason: string;
}

class IntelligentAIService {
  // Define which AI service is best for each task type
  private taskRouting: Record<string, ModelPreference> = {
    'contact-analysis': {
      primary: 'openai', // Changed to prefer OpenAI for contact analysis
      model: 'gpt-5', // Prioritize GPT-5 for deep analysis
      fallback: 'gemini',
      fallbackModel: 'gemini-1.5-pro',
      reason: 'OpenAI GPT-5 excels at nuanced data analysis and scoring'
    },
    'email-generation': {
      primary: 'openai',
      model: 'gpt-5', // Prioritize GPT-5 for creative writing and personalization
      fallback: 'gemini',
      fallbackModel: 'gemini-1.5-pro',
      reason: 'OpenAI superior for creative writing and personalization'
    },
    'company-research': {
      primary: 'gemini',
      model: 'gemini-1.5-pro', // Gemini strong for factual research
      fallback: 'openai',
      fallbackModel: 'gpt-5', // Fallback to GPT-5
      reason: 'Gemini better for factual research and comprehensive analysis'
    },
    'deal-summary': {
      primary: 'openai',
      model: 'gpt-5', // Prioritize GPT-5 for comprehensive and actionable summaries
      fallback: 'gemini',
      fallbackModel: 'gemini-1.5-pro',
      reason: 'OpenAI GPT-5 provides comprehensive and actionable business summaries'
    },
    'next-actions': {
      primary: 'openai',
      model: 'gpt-5-mini', // GPT-5 Mini for efficient, adaptive recommendations
      fallback: 'gemini',
      fallbackModel: 'gemma-2-9b-it',
      reason: 'GPT-5 Mini optimized for specific, actionable recommendations'
    },
    'insights': {
      primary: 'openai',
      model: 'gpt-5', // Prioritize GPT-5 for creative insights and pattern recognition
      fallback: 'gemini',
      fallbackModel: 'gemini-1.5-pro',
      reason: 'OpenAI better for creative insights and pattern recognition'
    },
    'contact-research': {
      primary: 'gemini',
      model: 'gemini-1.5-flash',
      fallback: 'openai',
      fallbackModel: 'gpt-5-nano', // Fallback to GPT-5 Nano for cost-efficient contact research
      reason: 'Gemini faster for contact information and strategy research'
    }
  };

  private openaiService: any;
  private geminiService: any;

  constructor(openaiService: any, geminiService: any) {
    this.openaiService = openaiService;
    this.geminiService = geminiService;
  }

  private getOptimalModel(taskType: string, priority: 'speed' | 'quality' | 'cost' = 'quality'): ModelPreference {
    const basePreference = this.taskRouting[taskType];
    
    if (!basePreference) {
      // Default fallback
      return {
        primary: 'gemini',
        model: 'gemini-2.0-flash-exp',
        fallback: 'openai',
        fallbackModel: 'gpt-4o-mini',
        reason: 'Default routing for unknown task'
      };
    }

    // Adjust based on priority
    if (priority === 'speed') {
      // Prefer faster models
      if (basePreference.primary === 'openai') {
        return {
          ...basePreference,
          model: 'gpt-5-mini', // Faster OpenAI model
        };
      } else {
        return {
          ...basePreference,
          model: 'gemini-1.5-flash', // Faster Gemini model
        };
      }
    } else if (priority === 'cost') {
      // Prefer lower cost models
      if (basePreference.primary === 'openai') {
        return {
          ...basePreference,
          model: 'gpt-5-nano', // Lower cost OpenAI model
        };
      } else {
        return {
          ...basePreference,
          model: 'gemma-2-2b-it', // Lower cost Gemma model
        };
      }
    }

    return basePreference;
  }

  async executeTask(taskType: string, data: any, options: { priority?: 'speed' | 'quality' | 'cost' } = {}): Promise<any> {
    const modelPref = this.getOptimalModel(taskType, options.priority);
    
    console.log(`🤖 AI Task: ${taskType} → Using ${modelPref.primary} (${modelPref.model}) - ${modelPref.reason}`);

    try {
      // Try primary model first
      if (modelPref.primary === 'openai') {
        return await this.executeOpenAITask(taskType, data, modelPref.model);
      } else {
        return await this.executeGeminiTask(taskType, data, modelPref.model);
      }
    } catch (error) {
      console.warn(`❌ Primary model failed, trying fallback: ${modelPref.fallback} (${modelPref.fallbackModel})`);
      
      try {
        // Try fallback model
        if (modelPref.fallback === 'openai') {
          return await this.executeOpenAITask(taskType, data, modelPref.fallbackModel);
        } else {
          return await this.executeGeminiTask(taskType, data, modelPref.fallbackModel);
        }
      } catch (fallbackError) {
        console.error(`❌ Both AI services failed for task: ${taskType}`, fallbackError);
        return this.generateFallbackResponse(taskType, data);
      }
    }
  }

  private async executeOpenAITask(taskType: string, data: any, model: string): Promise<any> {
    switch (taskType) {
      case 'contact-analysis':
        return await this.openaiService.analyzeContact(data, model);
      case 'email-generation':
        return await this.openaiService.generateEmail(data.contact, data.context, model);
      case 'insights':
        return await this.openaiService.getInsights(data, model);
      case 'deal-summary':
        return await this.openaiService.generateDealSummary(data, model);
      case 'next-actions':
        return await this.openaiService.suggestNextActions(data, model);
      default:
        throw new Error(`Unsupported OpenAI task: ${taskType}`);
    }
  }

  private async executeGeminiTask(taskType: string, data: any, model: string): Promise<any> {
    switch (taskType) {
      case 'contact-analysis':
        return await this.geminiService.analyzeContact(data, model);
      case 'email-generation':
        return await this.geminiService.generateEmail(data.contact, data.context, model);
      case 'company-research':
        return await this.geminiService.researchCompany(data.companyName, data.domain, model);
      case 'contact-research':
        return await this.geminiService.findContactInfo(data.personName, data.companyName, model);
      case 'deal-summary':
        return await this.geminiService.generateDealSummary(data, model);
      case 'next-actions':
        return await this.geminiService.suggestNextActions(data, model);
      case 'insights':
        return await this.geminiService.getInsights(data, model);
      default:
        throw new Error(`Unsupported Gemini task: ${taskType}`);
    }
  }

  private generateFallbackResponse(taskType: string, data: any): any {
    // Provide basic fallback responses when all AI services fail
    switch (taskType) {
      case 'contact-analysis':
        return {
          score: 60,
          insights: ['Contact data available for analysis'],
          recommendations: ['Schedule follow-up meeting'],
          riskFactors: ['Limited information available']
        };
      case 'email-generation':
        return `Subject: Following up

Hi ${data.contact?.firstName || data.contact?.name || 'there'},

I wanted to follow up on our previous conversation about ${data.contact?.company || 'your business'}.

I believe our solution could provide value to your team. Would you be available for a brief call this week?

Best regards,
[Your Name]`;
      case 'insights':
        return ['Follow up within 24 hours', 'Research company background', 'Prepare value proposition'];
      case 'deal-summary':
        return `Deal: ${data.title || 'Untitled'} with ${data.company || 'Unknown Company'}. Value: $${data.value?.toLocaleString() || 0}. Status: ${data.stage || 'Unknown'}`;
      case 'next-actions':
        return ['Schedule follow-up call', 'Send additional information', 'Connect with decision maker'];
      default:
        return 'AI analysis temporarily unavailable. Please try again later.';
    }
  }

  // Public methods for different AI tasks
  async analyzeContact(contact: any, priority: 'speed' | 'quality' | 'cost' = 'quality') {
    return this.executeTask('contact-analysis', contact, { priority });
  }

  async generateEmail(contact: any, context?: string, priority: 'speed' | 'quality' | 'cost' = 'quality') {
    return this.executeTask('email-generation', { contact, context }, { priority });
  }

  async researchCompany(companyName: string, domain?: string, priority: 'speed' | 'quality' | 'cost' = 'quality') {
    return this.executeTask('company-research', { companyName, domain }, { priority });
  }

  async researchContact(personName: string, companyName?: string, priority: 'speed' | 'quality' | 'cost' = 'speed') {
    return this.executeTask('contact-research', { personName, companyName }, { priority });
  }

  async generateDealSummary(dealData: any, priority: 'speed' | 'quality' | 'cost' = 'quality') {
    return this.executeTask('deal-summary', dealData, { priority });
  }

  async suggestNextActions(dealData: any, priority: 'speed' | 'quality' | 'cost' = 'quality') {
    return this.executeTask('next-actions', dealData, { priority });
  }

  async getInsights(data: any, priority: 'speed' | 'quality' | 'cost' = 'quality') {
    return this.executeTask('insights', data, { priority });
  }

  // Utility method to get routing information
  getTaskRouting() {
    return Object.entries(this.taskRouting).map(([task, pref]) => ({
      task,
      primaryModel: `${pref.primary} (${pref.model})`,
      fallbackModel: `${pref.fallback} (${pref.fallbackModel})`,
      reason: pref.reason
    }));
  }
}

export { IntelligentAIService };