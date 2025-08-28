/**
 * Enhanced Intelligent AI Service with GPT-5 Integration
 * Smart routing between OpenAI GPT-5 and Gemini 2.0 models
 * Routes through secure AI Gateway
 */

import { useEnhancedOpenAI } from './enhancedOpenAIService';
import { useEnhancedGemini } from './enhancedGeminiService';
import { getAIGatewayService } from './aiGatewayService';

interface TaskRoute {
  primary: 'openai' | 'gemini';
  primaryModel: string;
  fallback: 'openai' | 'gemini';
  fallbackModel: string;
  reason: string;
}

interface EnhancedIntelligentAIService {
  analyzeContact: (contact: any, priority?: 'speed' | 'quality' | 'cost') => Promise<any>;
  generateEmail: (contact: any, context?: string, priority?: 'speed' | 'quality' | 'cost') => Promise<string>;
  researchCompany: (companyName: string, domain?: string, priority?: 'speed' | 'quality' | 'cost') => Promise<any>;
  researchContact: (personName: string, companyName?: string, priority?: 'speed' | 'quality' | 'cost') => Promise<any>;
  generateDealSummary: (dealData: any, priority?: 'speed' | 'quality' | 'cost') => Promise<string>;
  suggestNextActions: (dealData: any, priority?: 'speed' | 'quality' | 'cost') => Promise<string[]>;
  getInsights: (data: any, priority?: 'speed' | 'quality' | 'cost') => Promise<string[]>;
  getSystemStatus: () => Promise<{ status: string; availableProviders: string[] }>;
}

class EnhancedIntelligentAIService implements EnhancedIntelligentAIService {
  private openaiService = useEnhancedOpenAI();
  private geminiService = useEnhancedGemini();
  private gateway = getAIGatewayService();

  // Enhanced task routing with GPT-5 prioritization
  private taskRouting: Record<string, TaskRoute> = {
    'contact-analysis': {
      primary: 'openai',
      primaryModel: 'gpt-5', // GPT-5 for advanced reasoning
      fallback: 'gemma',
      fallbackModel: 'gemma-2-27b-it',
      reason: 'GPT-5 excels at nuanced psychological analysis and pattern recognition'
    },
    'email-generation': {
      primary: 'openai',
      primaryModel: 'gpt-5', // GPT-5 for creative and personalized writing
      fallback: 'gemma',
      fallbackModel: 'gemma-2-9b-it',
      reason: 'GPT-5 superior for creative writing and personalization'
    },
    'company-research': {
      primary: 'openai',
      primaryModel: 'gpt-5', // GPT-5 for comprehensive research
      fallback: 'gemma',
      fallbackModel: 'gemma-2-27b-it',
      reason: 'GPT-5 provides comprehensive research with advanced reasoning'
    },
    'deal-summary': {
      primary: 'openai',
      primaryModel: 'gpt-5', // GPT-5 for comprehensive business analysis
      fallback: 'gemma',
      fallbackModel: 'gemma-2-27b-it',
      reason: 'GPT-5 provides comprehensive and actionable business summaries'
    },
    'next-actions': {
      primary: 'openai',
      primaryModel: 'gpt-5-mini', // GPT-5 Mini for efficient recommendations
      fallback: 'gemma',
      fallbackModel: 'gemma-2-9b-it',
      reason: 'GPT-5 Mini optimized for specific, actionable recommendations'
    },
    'insights': {
      primary: 'openai',
      primaryModel: 'gpt-5', // GPT-5 for creative insights
      fallback: 'gemma',
      fallbackModel: 'gemma-2-27b-it',
      reason: 'GPT-5 better for creative insights and pattern recognition'
    },
    'contact-research': {
      primary: 'openai',
      primaryModel: 'gpt-5-mini', // GPT-5 Mini for contact research
      fallback: 'gemma',
      fallbackModel: 'gemma-2-9b-it',
      reason: 'GPT-5 Mini provides intelligent contact research with reasoning'
    },
    'social-media-discovery': {
      primary: 'openai',
      primaryModel: 'gpt-5-mini', // GPT-5 Mini for social discovery
      fallback: 'gemma',
      model: 'gemma-2-27b-it', // Gemma optimized for structured data extraction
      fallbackModel: 'gemma-2-9b-it',
      reason: 'GPT-5 Mini with Gemma fallback for social media channel identification'
    },
    'app-enrichment': {
      primary: 'openai',
      primaryModel: 'gpt-5', // GPT-5 for comprehensive app analysis
      fallback: 'gemma',
      model: 'gemma-2-27b-it', // Gemma for comprehensive app data analysis
      fallbackModel: 'gemma-2-27b-it',
      reason: 'GPT-5 with Gemma fallback for app metadata and feature analysis'
    },
    'channel-identification': {
      primary: 'openai',
      primaryModel: 'gpt-5-nano', // GPT-5 Nano for efficient channel identification
      fallback: 'gemma',
      model: 'gemma-2-9b-it', // Fast Gemma for channel discovery
      fallbackModel: 'gemma-2-9b-it',
      reason: 'GPT-5 Nano with Gemma fallback for social platform identification'
    }
  };

  private getOptimalRoute(taskType: string, priority: 'speed' | 'quality' | 'cost' = 'quality'): TaskRoute {
    const baseRoute = this.taskRouting[taskType];
    
    if (!baseRoute) {
      return {
        primary: 'openai',
        primaryModel: 'gpt-5',
        fallback: 'gemma',
        fallbackModel: 'gemma-2-27b-it',
        reason: 'Default routing for unknown task'
      };
    }

    // Adjust routing based on priority
    if (priority === 'speed') {
      if (baseRoute.primary === 'openai') {
        return { ...baseRoute, primaryModel: 'gpt-5-mini' };
      } else {
        return { ...baseRoute, primaryModel: 'gemini-1.5-flash' };
      }
    } else if (priority === 'cost') {
      if (baseRoute.primary === 'openai') {
        return { ...baseRoute, primaryModel: 'gpt-5-nano' };
      } else {
        return { ...baseRoute, primaryModel: 'gemma-2-2b-it' };
      }
    }

    return baseRoute;
  }

  private async executeTask(taskType: string, data: any, options: { priority?: 'speed' | 'quality' | 'cost' } = {}): Promise<any> {
    const route = this.getOptimalRoute(taskType, options.priority);
    
    console.log(`🤖 Enhanced AI Task: ${taskType} → ${route.primary} (${route.primaryModel}) - ${route.reason}`);

    try {
      // Try primary service
      if (route.primary === 'openai') {
        return await this.executeOpenAITask(taskType, data, route.primaryModel);
      } else {
        return await this.executeGeminiTask(taskType, data, route.primaryModel);
      }
    } catch (error) {
      if (typeof error?.message === 'string' && error.message.includes('AI_FALLBACK')) {
      }
      
      try {
        // Try fallback service
        if (route.fallback === 'openai') {
          return await this.executeOpenAITask(taskType, data, route.fallbackModel);
        } else {
          try {
            return this.generateLocalFallback(taskType, data);
          } catch (fallbackGenerationError) {
            console.error(`❌ Local fallback generation failed for task: ${taskType}`, fallbackGenerationError);
            throw new Error(`All AI services and fallbacks failed for task: ${taskType}`);
          }
        }
      } catch (fallbackError) {
        console.error(`❌ Both AI services failed for task: ${taskType}`, fallbackError);
        try {
          return this.generateLocalFallback(taskType, data);
        } catch (fallbackGenerationError) {
          console.error(`❌ Local fallback generation failed for task: ${taskType}`, fallbackGenerationError);
          throw new Error(`All AI services and fallbacks failed for task: ${taskType}`);
        }
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
      case 'psychological-profile':
        return await this.openaiService.generatePsychologicalProfile(data, model);
      case 'detailed-score-analysis':
        return await this.openaiService.generateDetailedScoreAnalysis(data, model);
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
      case 'social-media-discovery':
        return await this.geminiService.discoverSocialChannels(data, model);
      case 'app-enrichment':
        return await this.geminiService.enrichAppData(data, model);
      case 'channel-identification':
        return await this.geminiService.identifyChannels(data, model);
      default:
        throw new Error(`Unsupported Gemini task: ${taskType}`);
    }
  }

  private generateLocalFallback(taskType: string, data: any): any {
    console.log(`🔄 Using local fallback for ${taskType}`);
    
    switch (taskType) {
      case 'contact-analysis':
        return {
          score: 60,
          insights: ['Contact data available for analysis'],
          recommendations: ['Schedule follow-up meeting'],
          riskFactors: ['AI analysis temporarily unavailable'],
          reasoningPath: 'Local fallback analysis',
          confidenceLevel: 30
        };
      case 'email-generation':
        return `Subject: Following up

Hi ${data.contact?.firstName || data.contact?.name || 'there'},

I wanted to follow up on our previous conversation about ${data.contact?.company || 'your business'}.

Best regards,
[Your Name]`;
      case 'insights':
        return ['Follow up within 24 hours', 'Research company background', 'Prepare value proposition'];
      case 'deal-summary':
        return `Deal: ${data.title || 'Untitled'} with ${data.company || 'Unknown Company'}. Enhanced AI analysis temporarily unavailable.`;
      case 'next-actions':
        return ['Schedule follow-up call', 'Send additional information', 'Connect with stakeholders'];
      default:
        return 'Enhanced AI analysis temporarily unavailable. Please try again later.';
    }
  }

  // Public interface methods
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
  
  async provideSalesCoaching(context: any, priority: 'speed' | 'quality' | 'cost' = 'quality') {
    return this.executeTask('sales-coaching', context, { priority });
  }
  
  async handleObjection(objection: string, context: any, priority: 'speed' | 'quality' | 'cost' = 'quality') {
    return this.executeTask('objection-handling', { objection, context }, { priority });
  }
  
  async analyzeConversation(conversationData: any, priority: 'speed' | 'quality' | 'cost' = 'quality') {
    return this.executeTask('conversation-analysis', conversationData, { priority });
  }

  async getSystemStatus() {
    try {
      // Get gateway health status
      const gatewayHealth = await this.gateway.healthCheck();
      
      // Determine overall status based on gateway health
      let overallStatus: 'healthy' | 'degraded' | 'down';
      let availableProviders: string[] = [];
      let errorMessage: string | undefined;

      if (gatewayHealth.status === 'healthy') {
        overallStatus = 'healthy';
        availableProviders = gatewayHealth.providers;
      } else if (gatewayHealth.status === 'degraded') {
        overallStatus = 'degraded';
        availableProviders = gatewayHealth.providers;
        errorMessage = gatewayHealth.error;
      } else {
        overallStatus = 'down';
        availableProviders = [];
        errorMessage = gatewayHealth.error;
      }

      return {
        overall: overallStatus,
        availableProviders,
        routing: this.getTaskRouting(),
        ...(errorMessage && { error: errorMessage })
      };
    } catch (error) {
      console.warn('System status check failed:', error);
      return {
        overall: 'down' as const,
        availableProviders: [],
        error: error.message || 'System status check failed',
        routing: []
      };
    }
  }

  getTaskRouting() {
    return Object.entries(this.taskRouting).map(([task, route]) => ({
      task,
      primaryModel: `${route.primary} (${route.primaryModel})`,
      fallbackModel: `${route.fallback} (${route.fallbackModel})`,
      reason: route.reason
    }));
  }
}

// Singleton instance
let enhancedIntelligentAI: EnhancedIntelligentAIService | null = null;

export const getEnhancedIntelligentAI = (): EnhancedIntelligentAIService => {
  if (!enhancedIntelligentAI) {
    enhancedIntelligentAI = new EnhancedIntelligentAIService();
  }
  return enhancedIntelligentAI;
};

export { EnhancedIntelligentAIService };