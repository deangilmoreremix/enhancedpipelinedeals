/**
 * OpenAI Function Calling Service
 * Integrates OpenAI Function Calling API with existing CRM components
 * Enhances existing interactions without changing visual design
 */

import OpenAI from 'openai';

interface AIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

interface EnhancementContext {
  entityType: 'contact' | 'deal' | 'company';
  action: string;
  componentId?: string;
  userId?: string;
  timestamp?: number;
}

interface EnhancementResult {
  enhanced: boolean;
  functionCalled?: string;
  result?: any;
  response?: string;
  originalAction: string;
  error?: string;
}

class OpenAIFunctionCallingService {
  private openai: OpenAI | null = null;
  private functions: AIFunction[] = [];
  private isInitialized = false;

  constructor() {
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        console.warn('⚠️ OpenAI API key not found, function calling will be disabled');
        return;
      }

      this.openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true // Required for client-side usage
      });

      this.initializeFunctions();
      this.isInitialized = true;
      console.log('✅ OpenAI Function Calling service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI Function Calling service:', error);
    }
  }

  private initializeFunctions(): void {
    this.functions = [
      {
        name: 'analyze_contact_profile',
        description: 'Comprehensive contact analysis with behavioral insights and scoring',
        parameters: {
          type: 'object',
          properties: {
            contactId: {
              type: 'string',
              description: 'Unique identifier for the contact'
            },
            analysisType: {
              type: 'string',
              enum: ['behavioral', 'engagement', 'risk', 'opportunity', 'comprehensive'],
              description: 'Type of analysis to perform'
            },
            includeWebResearch: {
              type: 'boolean',
              description: 'Include web research for additional insights'
            },
            depth: {
              type: 'string',
              enum: ['basic', 'detailed', 'comprehensive'],
              description: 'Analysis depth level'
            }
          },
          required: ['contactId']
        }
      },
      {
        name: 'comprehensive_deal_analysis',
        description: 'Multi-factor deal scoring and analysis with predictive insights',
        parameters: {
          type: 'object',
          properties: {
            dealId: {
              type: 'string',
              description: 'Deal identifier'
            },
            analysisFactors: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['probability', 'value', 'timeline', 'competition', 'stakeholder', 'risk']
              },
              description: 'Factors to analyze'
            },
            includeMarketResearch: {
              type: 'boolean',
              description: 'Include market and competitor research'
            },
            includeStakeholderAnalysis: {
              type: 'boolean',
              description: 'Include stakeholder influence analysis'
            }
          },
          required: ['dealId']
        }
      },
      {
        name: 'generate_personalized_email',
        description: 'Create tailored email content based on recipient analysis',
        parameters: {
          type: 'object',
          properties: {
            contactId: {
              type: 'string',
              description: 'Recipient contact identifier'
            },
            emailPurpose: {
              type: 'string',
              enum: ['introduction', 'followup', 'proposal', 'negotiation', 'closing', 'nurture', 'reengagement'],
              description: 'Purpose of the email'
            },
            tone: {
              type: 'string',
              enum: ['professional', 'casual', 'friendly', 'formal', 'enthusiastic', 'urgent'],
              description: 'Desired email tone'
            },
            includePersonalization: {
              type: 'boolean',
              description: 'Include personalized details from contact analysis'
            },
            keyPoints: {
              type: 'array',
              items: { type: 'string' },
              description: 'Key points to include in the email'
            }
          },
          required: ['contactId', 'emailPurpose']
        }
      },
      {
        name: 'enrich_contact_data',
        description: 'Enhance contact information with external data sources',
        parameters: {
          type: 'object',
          properties: {
            contactId: {
              type: 'string',
              description: 'Contact to enrich'
            },
            enrichmentTypes: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['social', 'company', 'professional', 'personal', 'news']
              },
              description: 'Types of enrichment to perform'
            },
            includeVerification: {
              type: 'boolean',
              description: 'Verify data accuracy'
            },
            maxSources: {
              type: 'number',
              description: 'Maximum sources to query',
              default: 5
            }
          },
          required: ['contactId']
        }
      },
      {
        name: 'predict_deal_outcome',
        description: 'Predict deal win/loss probability with reasoning',
        parameters: {
          type: 'object',
          properties: {
            dealId: {
              type: 'string',
              description: 'Deal to predict outcome for'
            },
            confidenceLevel: {
              type: 'boolean',
              description: 'Include confidence intervals'
            },
            includeFactors: {
              type: 'boolean',
              description: 'Include key influencing factors'
            },
            timeHorizon: {
              type: 'string',
              enum: ['1week', '1month', '3months'],
              description: 'Prediction time horizon'
            }
          },
          required: ['dealId']
        }
      },
      {
        name: 'optimize_deal_strategy',
        description: 'Generate optimized deal strategy and next steps',
        parameters: {
          type: 'object',
          properties: {
            dealId: {
              type: 'string',
              description: 'Deal to optimize'
            },
            currentStage: {
              type: 'string',
              description: 'Current deal stage'
            },
            timeConstraint: {
              type: 'string',
              enum: ['urgent', 'normal', 'flexible'],
              description: 'Time constraints'
            },
            riskTolerance: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Risk tolerance level'
            }
          },
          required: ['dealId']
        }
      },
      {
        name: 'generate_call_script',
        description: 'Create AI-powered call scripts for different scenarios',
        parameters: {
          type: 'object',
          properties: {
            contactId: {
              type: 'string',
              description: 'Contact for the call'
            },
            callPurpose: {
              type: 'string',
              enum: ['introduction', 'followup', 'discovery', 'objection', 'closing', 'support', 'nurture'],
              description: 'Purpose of the call'
            },
            callLength: {
              type: 'string',
              enum: ['brief', 'normal', 'detailed'],
              description: 'Expected call length'
            },
            includeObjectionHandling: {
              type: 'boolean',
              description: 'Include objection responses'
            },
            keyPoints: {
              type: 'array',
              items: { type: 'string' },
              description: 'Key points to cover'
            }
          },
          required: ['contactId', 'callPurpose']
        }
      }
    ];
  }

  async enhanceExistingInteraction(
    userAction: string,
    context: EnhancementContext,
    entityData: any
  ): Promise<EnhancementResult> {
    if (!this.isInitialized || !this.openai) {
      return {
        enhanced: false,
        originalAction: userAction,
        error: 'OpenAI Function Calling service not initialized'
      };
    }

    try {
      // Create natural language prompt based on existing interaction
      const prompt = this.createPromptFromAction(userAction, context, entityData);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant integrated into a CRM system. Enhance user interactions using available functions without changing the interface. Focus on providing valuable insights and automating routine tasks.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        functions: this.functions,
        function_call: 'auto',
        temperature: 0.7,
        max_tokens: 1000
      });

      const message = response.choices[0].message;

      if (message.function_call) {
        const functionName = message.function_call.name;
        const functionArgs = JSON.parse(message.function_call.arguments);

        console.log(`🔧 OpenAI Function Call: ${functionName}`, functionArgs);

        // Execute the function using existing AI services
        const result = await this.executeFunction(functionName, functionArgs, context);

        return {
          enhanced: true,
          functionCalled: functionName,
          result: result,
          originalAction: userAction
        };
      }

      // No function call, return direct response
      return {
        enhanced: false,
        response: message.content || 'Action processed successfully',
        originalAction: userAction
      };

    } catch (error) {
      console.error('OpenAI Function Calling failed:', error);
      return {
        enhanced: false,
        originalAction: userAction,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private createPromptFromAction(action: string, context: EnhancementContext, entityData: any): string {
    const entityName = entityData.name || entityData.title || 'Unknown';
    const entityType = context.entityType;

    const prompts = {
      'card-click': `User clicked on ${entityType} card for ${entityName}. Provide relevant insights and analysis to enhance their understanding.`,
      'analyze-button': `User clicked the analyze button for ${entityType}: ${entityName}. Perform comprehensive analysis and provide actionable insights.`,
      'email-button': `User wants to send an email to ${entityName} from ${entityData.company || 'their company'}. Generate personalized, effective email content.`,
      'enrich-button': `User wants to enrich data for ${entityName}. Find additional information, insights, and opportunities.`,
      'call-button': `User wants to call ${entityName}. Prepare call context, talking points, and potential objections to handle.`,
      'natural-language-query': `User asked: "${context.action}". Provide helpful response using available CRM data and functions.`,
      'form-submit': `User is submitting a form related to ${entityName}. Validate data and provide enhancement suggestions.`,
      'search-query': `User searched for: "${context.action}". Find relevant ${entityType}s and provide search insights.`,
      'filter-apply': `User applied filters for ${entityType}s. Analyze the filtered data and provide insights.`,
      'export-request': `User wants to export ${entityType} data. Optimize the export and suggest additional valuable data to include.`,
      'import-upload': `User uploaded data to import. Analyze the data and suggest improvements or validations needed.`
    };

    return prompts[action as keyof typeof prompts] ||
           `Enhance this ${action} interaction for ${entityType}: ${entityName}. Provide valuable insights and automation.`;
  }

  private async executeFunction(
    functionName: string,
    args: any,
    context: EnhancementContext
  ): Promise<any> {
    try {
      // Integrate with existing AI Function Orchestrator
      const { getAIFunctionOrchestrator } = await import('./aiFunctionOrchestrator');
      const orchestrator = getAIFunctionOrchestrator();

      return await orchestrator.executeFunction(functionName, args, {
        userId: context.userId || 'openai-enhanced',
        componentId: context.componentId || 'existing-ui-integration',
        entityType: context.entityType,
        entityId: args.contactId || args.dealId || context.entityType + '_unknown',
        timestamp: context.timestamp || Date.now()
      });
    } catch (error) {
      console.error(`Function execution failed for ${functionName}:`, error);

      // Fallback to local implementation if orchestrator fails
      return this.fallbackFunctionExecution(functionName, args);
    }
  }

  private fallbackFunctionExecution(functionName: string, args: any): any {
    console.log(`🔄 Using fallback for ${functionName}`);

    switch (functionName) {
      case 'analyze_contact_profile':
        return {
          score: 65,
          insights: ['Contact analysis temporarily unavailable'],
          recommendations: ['Try again in a few moments'],
          riskFactors: ['AI service temporarily offline'],
          reasoningPath: 'Fallback analysis',
          confidenceLevel: 40
        };

      case 'comprehensive_deal_analysis':
        return {
          probability: 50,
          insights: ['Deal analysis temporarily unavailable'],
          recommendations: ['Basic deal tracking active'],
          riskFactors: ['AI analysis offline'],
          confidenceLevel: 35
        };

      case 'generate_personalized_email':
        return {
          subject: `Follow-up regarding our discussion`,
          body: `Hi ${args.contactId ? 'there' : 'valued contact'},

I wanted to follow up on our previous conversation. Please let me know if there's anything specific you'd like to discuss.

Best regards,
Your CRM Team`,
          personalization: ['Basic template used'],
          confidence: 30
        };

      case 'enrich_contact_data':
        return {
          enrichedData: {},
          sources: [],
          confidence: 25,
          message: 'Data enrichment temporarily unavailable'
        };

      default:
        return {
          message: 'Function temporarily unavailable',
          fallback: true
        };
    }
  }

  // Check if service is ready
  isReady(): boolean {
    return this.isInitialized && !!this.openai;
  }

  // Get available functions for debugging
  getAvailableFunctions(): string[] {
    return this.functions.map(f => f.name);
  }

  // Force reinitialize (useful for debugging)
  async reinitialize(): Promise<void> {
    this.isInitialized = false;
    this.openai = null;
    await this.initializeService();
  }
}

// Singleton instance
let openAIFunctionService: OpenAIFunctionCallingService | null = null;

export const getOpenAIFunctionService = (): OpenAIFunctionCallingService => {
  if (!openAIFunctionService) {
    openAIFunctionService = new OpenAIFunctionCallingService();
  }
  return openAIFunctionService;
};

export type { EnhancementContext, EnhancementResult };