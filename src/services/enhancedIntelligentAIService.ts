/**
 * Enhanced Intelligent AI Service with GPT-5 Integration
 * Smart routing between OpenAI GPT-5 and Gemini 2.0 models
 * Routes through secure AI Gateway
 */

import { useEnhancedOpenAI } from './enhancedOpenAIService';
import { useEnhancedGemini } from './enhancedGeminiService';
import { getAIGatewayService } from './aiGatewayService';
import { getWebSearchService } from './webSearchService';
import { getCitationService } from './citationService';
import { CitationSource } from '../types/citation';

interface TaskRoute {
  primary: 'openai';
  primaryModel: string;
  fallback: 'openai';
  fallbackModel: string;
  reason: string;
}

class EnhancedIntelligentAIService {
  private openaiService = useEnhancedOpenAI();
  private geminiService = useEnhancedGemini();
  private gateway = getAIGatewayService();

  // Enhanced task routing with GPT-5 prioritization
  private taskRouting: Record<string, TaskRoute> = {
    'contact-analysis': {
      primary: 'openai',
      primaryModel: 'gpt-5', // GPT-5 for advanced reasoning
      fallback: 'openai',
      fallbackModel: 'gpt-5-mini',
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
      fallback: 'openai',
      fallbackModel: 'gemma-2-9b-it',
      reason: 'GPT-5 Mini optimized for specific, actionable recommendations'
    },
    'insights': {
      primary: 'openai',
      primaryModel: 'gpt-5', // GPT-5 for creative insights
      fallback: 'openai',
      fallbackModel: 'gemma-2-27b-it',
      reason: 'GPT-5 better for creative insights and pattern recognition'
    },
    'contact-research': {
      primary: 'openai',
      primaryModel: 'gpt-5-mini', // GPT-5 Mini for contact research
      fallback: 'openai',
      fallbackModel: 'gpt-4o-mini',
      reason: 'GPT-5 Mini provides intelligent contact research with reasoning'
    },
    'social-media-discovery': {
      primary: 'openai',
      primaryModel: 'gpt-5-mini', // GPT-5 Mini for social discovery
      fallback: 'openai',
      fallbackModel: 'gpt-4o-mini',
      reason: 'GPT-5 Mini with OpenAI fallback for social media channel identification'
    },
    'app-enrichment': {
      primary: 'openai',
      primaryModel: 'gpt-5', // GPT-5 for comprehensive app analysis
      fallback: 'openai',
      fallbackModel: 'gpt-5-mini',
      reason: 'GPT-5 with OpenAI fallback for app metadata and feature analysis'
    },
    'channel-identification': {
      primary: 'openai',
      primaryModel: 'gpt-5-nano', // GPT-5 Nano for efficient channel identification
      fallback: 'openai',
      fallbackModel: 'gpt-4o-mini',
      reason: 'GPT-5 Nano with OpenAI fallback for social platform identification'
    }
  };

  private getOptimalRoute(taskType: string, priority: 'speed' | 'quality' | 'cost' = 'quality'): TaskRoute {
    const baseRoute = this.taskRouting[taskType];
    
    if (!baseRoute) {
      return {
        primary: 'openai',
        primaryModel: 'gpt-5',
        fallback: 'openai',
        fallbackModel: 'gpt-5-mini',
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
      // Try primary OpenAI service
      return await this.executeOpenAITask(taskType, data, route.primaryModel);
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string' && (error as any).message.includes('AI_FALLBACK')) {
      }

      try {
        // Try fallback OpenAI service
        return await this.executeOpenAITask(taskType, data, route.fallbackModel);
      } catch (fallbackError) {
        console.error(`❌ OpenAI services failed for task: ${taskType}`, fallbackError);
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
      case 'deal-summary':
        return await this.openaiService.generateDealSummary(data, model);
      case 'next-actions':
        return await this.openaiService.suggestNextActions(data, model);
      case 'insights':
        return await this.openaiService.getInsights(data, model);
      case 'psychological-profile':
        return await this.openaiService.generatePsychologicalProfile(data, model);
      case 'detailed-score-analysis':
        return await this.openaiService.generateDetailedScoreAnalysis(data, model);
      // For unsupported tasks, use fallback
      case 'company-research':
      case 'contact-research':
      case 'social-media-discovery':
      case 'app-enrichment':
      case 'channel-identification':
      case 'sales-coaching':
      case 'objection-handling':
      case 'conversation-analysis':
      default:
        console.log(`Task ${taskType} not supported by OpenAI service, using fallback`);
        return this.generateLocalFallback(taskType, data);
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
        error: (error && typeof error === 'object' && 'message' in error) ? (error as any).message : 'System status check failed',
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

  // GPT-5 Enhanced methods with web search and citations
  async analyzeContactWithResearch(contact: any, includeWebSearch: boolean = false, priority: 'speed' | 'quality' | 'cost' = 'quality'): Promise<any> {
    try {
      let analysis = await this.analyzeContact(contact, priority);

      if (includeWebSearch) {
        console.log(`🔍 Enhancing contact analysis with web search for ${contact.name}`);

        const webSearchService = getWebSearchService();
        const searchQuery = `${contact.name} ${contact.title} ${contact.company} professional background`;

        const searchResults = await webSearchService.searchWithAI(
          searchQuery,
          'You are a research assistant. Find professional information about this contact.',
          `Research this professional: ${contact.name}, ${contact.title} at ${contact.company}. Find their background, achievements, and professional information.`,
          {
            contextSize: 'medium',
            maxResults: 5,
            includeSources: true
          }
        );

        // Enhance the analysis with web search results
        analysis.webResearch = {
          sources: searchResults.citations,
          searchTime: searchResults.searchTime,
          query: searchQuery
        };

        // Add citation tracking
        const citationService = getCitationService();
        await citationService.trackCitations('contact', contact.id, searchResults.citations);
      }

      return analysis;
    } catch (error) {
      console.error('Contact analysis with research failed:', error);
      return await this.analyzeContact(contact, priority);
    }
  }

  async researchCompanyWithCitations(companyName: string, industry?: string, priority: 'speed' | 'quality' | 'cost' = 'quality'): Promise<any> {
    try {
      console.log(`🏢 Researching company with citations: ${companyName}`);

      const webSearchService = getWebSearchService();
      const searchQuery = `${companyName} ${industry || ''} company information business overview`;

      const searchResults = await webSearchService.searchWithAI(
        searchQuery,
        'You are a business research analyst. Provide comprehensive company information with citations.',
        `Research this company: ${companyName}. Provide business overview, industry position, recent developments, and key information.`,
        {
          contextSize: 'high',
          maxResults: 8,
          includeSources: true
        }
      );

      // Create enhanced company research data
      const companyData = {
        name: companyName,
        industry: industry || 'Unknown',
        searchResults: searchResults.results,
        citations: searchResults.citations,
        searchTime: searchResults.searchTime,
        generatedAt: new Date().toISOString(),
        aiProvider: 'GPT-5 with Web Search'
      };

      // Track citations
      const citationService = getCitationService();
      await citationService.trackCitations('company', companyName, searchResults.citations);

      return companyData;
    } catch (error) {
      console.error('Company research with citations failed:', error);
      return this.generateLocalFallback('company-research', { companyName, industry });
    }
  }

  async generateEmailWithPersonalization(contact: any, context?: string, includeResearch: boolean = false, priority: 'speed' | 'quality' | 'cost' = 'quality'): Promise<string> {
    try {
      let emailContext = context;

      if (includeResearch) {
        console.log(`📧 Enhancing email with research for ${contact.name}`);

        const webSearchService = getWebSearchService();
        const searchQuery = `${contact.name} ${contact.company} recent news professional background`;

        const searchResults = await webSearchService.searchWithAI(
          searchQuery,
          'You are a sales research assistant. Find personalized information for email outreach.',
          `Find recent information about ${contact.name} at ${contact.company} that could be relevant for personalized outreach.`,
          {
            contextSize: 'medium',
            maxResults: 3,
            includeSources: true
          }
        );

        // Add research context to email generation
        const researchContext = searchResults.results.map(r => r.snippet).join(' ');
        emailContext = `${context || ''}\n\nRecent research: ${researchContext}`.trim();
      }

      return await this.generateEmail(contact, emailContext, priority);
    } catch (error) {
      console.error('Email generation with personalization failed:', error);
      return await this.generateEmail(contact, context, priority);
    }
  }

  async analyzeDealWithMarketResearch(dealData: any, includeCompetitorAnalysis: boolean = false, priority: 'speed' | 'quality' | 'cost' = 'quality'): Promise<any> {
    try {
      console.log(`📊 Analyzing deal with market research: ${dealData.title}`);

      const webSearchService = getWebSearchService();
      const searchQueries = [
        `${dealData.company} company news recent developments`,
        `${dealData.company} ${dealData.contact} professional background`
      ];

      if (includeCompetitorAnalysis) {
        searchQueries.push(`${dealData.company} competitors market position`);
      }

      const searchPromises = searchQueries.map(query =>
        webSearchService.searchWithAI(
          query,
          'You are a market research analyst. Provide competitive intelligence and market insights.',
          `Analyze market position and recent developments for ${dealData.company}.`,
          {
            contextSize: 'high',
            maxResults: 5,
            includeSources: true
          }
        )
      );

      const searchResults = await Promise.all(searchPromises);

      // Generate enhanced deal summary
      const dealSummary = await this.generateDealSummary(dealData, priority);

      // Combine with market research
      const enhancedAnalysis = {
        ...dealSummary,
        marketResearch: {
          companyNews: searchResults[0]?.results || [],
          contactBackground: searchResults[1]?.results || [],
          competitorAnalysis: includeCompetitorAnalysis ? searchResults[2]?.results || [] : [],
          allCitations: searchResults.flatMap(r => r.citations),
          searchTime: searchResults.reduce((total, r) => total + r.searchTime, 0)
        },
        generatedAt: new Date().toISOString(),
        aiProvider: 'GPT-5 with Market Research'
      };

      // Track citations
      const citationService = getCitationService();
      const allCitations = searchResults.flatMap(r => r.citations);
      await citationService.trackCitations('deal', dealData.id, allCitations);

      return enhancedAnalysis;
    } catch (error) {
      console.error('Deal analysis with market research failed:', error);
      return await this.generateDealSummary(dealData, priority);
    }
  }

  async getCitationsForEntity(entityType: 'contact' | 'deal' | 'company', entityId: string): Promise<any> {
    try {
      const citationService = getCitationService();
      return await citationService.getCitations(entityType, entityId);
    } catch (error) {
      console.error('Failed to get citations for entity:', error);
      return { citations: [], totalCount: 0 };
    }
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