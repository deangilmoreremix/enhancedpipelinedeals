import { callAI } from './aiClient';

interface AITask {
  type: 'contact-analysis' | 'email-generation' | 'company-research' | 'deal-summary' | 'next-actions' | 'insights' | 'contact-research';
  priority: 'speed' | 'quality' | 'cost';
  complexity: 'low' | 'medium' | 'high';
}

type Tier = 'fast' | 'default' | 'deep';

interface ModelPreference {
  tier: Tier;
  reason: string;
}

// Tasks whose answers are structured JSON; everything else returns text.
const JSON_TASKS = new Set(['contact-analysis', 'insights', 'next-actions', 'company-research', 'contact-research']);

class IntelligentAIService {
  // Routing by task. Concrete OpenAI models (gpt-6-astra / gpt-6.1-sol / gpt-6-luna) are owned by the server.
  private taskRouting: Record<string, ModelPreference> = {
    'contact-analysis': { tier: 'default', reason: 'Nuanced data analysis and scoring' },
    'email-generation': { tier: 'default', reason: 'Creative writing and personalization' },
    'company-research': { tier: 'default', reason: 'Factual research and comprehensive analysis' },
    'deal-summary': { tier: 'default', reason: 'Comprehensive and actionable business summaries' },
    'next-actions': { tier: 'fast', reason: 'Efficient, specific recommendations' },
    'insights': { tier: 'default', reason: 'Pattern recognition and insights' },
    'contact-research': { tier: 'fast', reason: 'Fast contact information and strategy research' },
  };

  private getOptimalModel(taskType: string, priority: 'speed' | 'quality' | 'cost' = 'quality'): ModelPreference {
    const base = this.taskRouting[taskType] ?? { tier: 'default' as Tier, reason: 'Default routing for unknown task' };
    if (priority === 'speed' || priority === 'cost') return { ...base, tier: 'fast' };
    return base;
  }

  async executeTask(taskType: string, data: any, options: { priority?: 'speed' | 'quality' | 'cost' } = {}): Promise<any> {
    const pref = this.getOptimalModel(taskType, options.priority);
    try {
      return await this.executeOpenAITask(taskType, data, pref.tier);
    } catch (error) {
      console.error(`❌ AI task failed: ${taskType}`, error);
      return this.generateFallbackResponse(taskType, data);
    }
  }

  private async executeOpenAITask(taskType: string, data: any, tier: Tier): Promise<any> {
    const wantsJSON = JSON_TASKS.has(taskType);
    const prompt = this.generatePrompt(taskType, data) +
      (wantsJSON && taskType !== 'contact-analysis' ? '\n\nReturn a single JSON object; list-type answers go in {"items": [...]}.' : '');
    const result = await callAI('chat', {
      instructions: `You are an AI assistant specialized in sales and business analysis.${wantsJSON ? ' Respond with a single JSON object only.' : ''}`,
      input: prompt,
      json: wantsJSON,
      tier,
    } as any);

    if (!wantsJSON) return result.text;
    const parsed = result.data;
    if (parsed == null) throw new Error('AI response was not valid JSON');
    return Array.isArray(parsed?.items) ? parsed.items : parsed;
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
      primaryModel: `openai (${pref.tier} tier)`,
      fallbackModel: 'static fallback',
      reason: pref.reason
    }));
  }
}

export { IntelligentAIService };