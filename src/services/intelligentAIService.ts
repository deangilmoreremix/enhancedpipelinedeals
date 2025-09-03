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
      primary: 'openai',
      model: 'gpt-5', // GPT-5 for deep analysis and scoring
      fallback: 'gemini',
      fallbackModel: 'gemini-1.5-pro',
      reason: 'GPT-5 excels at nuanced data analysis and scoring'
    },
    'email-generation': {
      primary: 'openai',
      model: 'gpt-5', // GPT-5 for creative writing and personalization
      fallback: 'gemini',
      fallbackModel: 'gemini-1.5-pro',
      reason: 'GPT-5 superior for creative writing and personalization'
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
      model: 'gpt-5', // GPT-5 for comprehensive and actionable summaries
      fallback: 'gemini',
      fallbackModel: 'gemini-1.5-pro',
      reason: 'GPT-5 provides comprehensive and actionable business summaries'
    },
    'next-actions': {
      primary: 'openai',
      model: 'gpt-5-mini', // GPT-5 Mini for efficient, adaptive recommendations
      fallback: 'gemini',
      fallbackModel: 'gemini-1.5-flash',
      reason: 'GPT-5 Mini optimized for specific, actionable recommendations'
    },
    'insights': {
      primary: 'openai',
      model: 'gpt-5', // GPT-5 for creative insights and pattern recognition
      fallback: 'gemini',
      fallbackModel: 'gemini-1.5-pro',
      reason: 'GPT-5 better for creative insights and pattern recognition'
    },
    'contact-research': {
      primary: 'gemini',
      model: 'gemini-1.5-flash',
      fallback: 'openai',
      fallbackModel: 'gpt-5-nano', // GPT-5 Nano for cost-efficient contact research
      reason: 'Gemini faster for contact information and strategy research'
    }
  };

  constructor() {
    // No longer need individual AI services - using edge functions
  }

  private getOptimalModel(taskType: string, priority: 'speed' | 'quality' | 'cost' = 'quality'): ModelPreference {
    const basePreference = this.taskRouting[taskType];
    
    if (!basePreference) {
      // Default fallback
      return {
        primary: 'gemini',
        model: 'gemini-2.0-flash-exp',
        fallback: 'openai',
        fallbackModel: 'gpt-5-mini',
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
    const prompt = this.generatePrompt(taskType, data);
    const messages = [
      { role: "system", content: "You are an AI assistant specialized in sales and business analysis." },
      { role: "user", content: prompt }
    ];

    return await this.callAIGateway('openai', model, taskType, { messages, temperature: 0.7 });
  }

  private async executeGeminiTask(taskType: string, data: any, model: string): Promise<any> {
    const prompt = this.generatePrompt(taskType, data);

    return await this.callAIGateway('gemini', model, taskType, {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 64,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    });
  }

  private generatePrompt(taskType: string, data: any): string {
    switch (taskType) {
      case 'contact-analysis':
        return `Analyze this contact for sales potential:
Name: ${data.name || data.firstName + ' ' + data.lastName}
Email: ${data.email}
Company: ${data.company}
Title: ${data.title}
Industry: ${data.industry}

Provide a JSON response with:
{
  "score": <0-100>,
  "insights": ["key insight 1", "key insight 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "riskFactors": ["risk 1", "risk 2"]
}`;

      case 'email-generation':
        return `Generate a professional sales email to:
${data.contact?.firstName || data.contact?.name || 'Contact'} at ${data.contact?.company || 'Company'}

Context: ${data.context || 'Following up on our previous conversation'}

Make it personalized and compelling. Include subject line and body.`;

      case 'company-research':
        return `Research this company:
Company: ${data.companyName}
Domain: ${data.domain}

Provide information about their industry, size, and business focus.`;

      case 'deal-summary':
        return `Summarize this deal:
Title: ${data.title}
Company: ${data.company}
Value: $${data.value}
Stage: ${data.stage}

Provide a comprehensive summary with key insights.`;

      case 'next-actions':
        return `Suggest next actions for this deal:
${JSON.stringify(data, null, 2)}

Provide 3-5 specific, actionable next steps.`;

      case 'insights':
        return `Generate insights from this data:
${JSON.stringify(data, null, 2)}

Provide key insights and recommendations.`;

      default:
        return `Process this request: ${JSON.stringify({ taskType, data }, null, 2)}`;
    }
  }

  private async callAIGateway(provider: string, model: string, taskType: string, aiRequestData: any): Promise<any> {
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
        provider,
        model,
        taskType,
        aiRequestData
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`AI Gateway error: ${errorData.error || response.statusText}`);
    }

    const result = await response.json();

    // Extract the actual response from the AI API
    if (result.choices && result.choices[0]) {
      // OpenAI format
      return JSON.parse(result.choices[0].message.content);
    } else if (result.candidates && result.candidates[0]) {
      // Gemini format
      return JSON.parse(result.candidates[0].content.parts[0].text);
    } else {
      return result;
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