/**
 * AI Function Orchestrator - Manages function calling for enhanced AI capabilities
 * Provides seamless integration with existing UI components without design changes
 */

interface AIFunction {
  name: string;
  description: string;
  category: 'contact' | 'deal' | 'communication' | 'analytics' | 'automation' | 'system';
  parameters: FunctionParameter[];
  handler: FunctionHandler;
  requiresConfirmation: boolean;
  fallbackBehavior: 'skip' | 'basic' | 'manual';
  estimatedDuration: number; // in milliseconds
  cacheable: boolean;
  priority: 'low' | 'medium' | 'high';
}

interface FunctionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: (value: any) => boolean;
  validationMessage?: string;
}

interface FunctionHandler {
  execute: (params: Record<string, any>, context?: FunctionContext) => Promise<FunctionResult>;
  validate?: (params: Record<string, any>) => Promise<ValidationResult>;
  cleanup?: (result: FunctionResult) => Promise<void>;
}

interface FunctionContext {
  userId?: string;
  sessionId?: string;
  componentId?: string;
  entityType?: 'contact' | 'deal' | 'company';
  entityId?: string;
  timestamp: number;
  userAgent?: string;
}

interface FunctionResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    tokensUsed?: number;
    cost?: number;
    citations?: any[];
    confidence?: number;
  };
  suggestions?: string[];
  nextActions?: FunctionCall[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface FunctionCall {
  function: string;
  parameters: Record<string, any>;
  priority: 'low' | 'medium' | 'high';
  delay?: number; // milliseconds
}

interface OrchestratorStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageExecutionTime: number;
  cacheHitRate: number;
  activeFunctions: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetTime) {
      this.limits.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  getRemainingRequests(key: string): number {
    const entry = this.limits.get(key);
    if (!entry || Date.now() > entry.resetTime) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - entry.count);
  }
}

class AIFunctionOrchestrator {
  private functions = new Map<string, AIFunction>();
  private executionQueue: FunctionCall[] = [];
  private activeExecutions = new Map<string, Promise<FunctionResult>>();
  private rateLimiter = new RateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes
  private stats: OrchestratorStats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    averageExecutionTime: 0,
    cacheHitRate: 0,
    activeFunctions: 0
  };

  constructor() {
    this.initializeCoreFunctions();
  }

  private initializeCoreFunctions(): void {
    // Contact Management Functions
    this.registerFunction({
      name: 'analyze_contact_profile',
      description: 'Comprehensive contact analysis with behavioral insights',
      category: 'contact',
      parameters: [
        {
          name: 'contactId',
          type: 'string',
          description: 'Unique identifier for the contact',
          required: true,
          validation: (value) => typeof value === 'string' && value.length > 0,
          validationMessage: 'Contact ID must be a non-empty string'
        },
        {
          name: 'includeWebResearch',
          type: 'boolean',
          description: 'Include web research for additional insights',
          required: false,
          defaultValue: true
        },
        {
          name: 'depth',
          type: 'string',
          description: 'Analysis depth level',
          required: false,
          defaultValue: 'comprehensive',
          validation: (value) => ['basic', 'detailed', 'comprehensive'].includes(value),
          validationMessage: 'Depth must be basic, detailed, or comprehensive'
        }
      ],
      handler: {
        execute: async (params, context) => {
          // Implementation will integrate with existing contact analysis
          const startTime = Date.now();

          try {
            // Get enhanced AI service
            const { getEnhancedIntelligentAI } = await import('./enhancedIntelligentAIService');
            const aiService = getEnhancedIntelligentAI();

            // Get contact data (this would come from context or parameters)
            const contactData = params.contactData || {};

            const result = await aiService.analyzeContact(contactData, 'quality');

            return {
              success: true,
              data: result,
              metadata: {
                executionTime: Date.now() - startTime,
                confidence: result.confidenceLevel || 0.8
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Analysis failed',
              metadata: {
                executionTime: Date.now() - startTime
              }
            };
          }
        }
      },
      requiresConfirmation: false,
      fallbackBehavior: 'basic',
      estimatedDuration: 3000,
      cacheable: true,
      priority: 'high'
    });

    this.registerFunction({
      name: 'enrich_contact_data',
      description: 'Enhance contact information with web research',
      category: 'contact',
      parameters: [
        {
          name: 'contactId',
          type: 'string',
          description: 'Contact identifier',
          required: true
        },
        {
          name: 'includeSocialProfiles',
          type: 'boolean',
          description: 'Include social media profile discovery',
          required: false,
          defaultValue: true
        },
        {
          name: 'includeCompanyResearch',
          type: 'boolean',
          description: 'Include company background research',
          required: false,
          defaultValue: true
        }
      ],
      handler: {
        execute: async (params, context) => {
          const startTime = Date.now();

          try {
            // Get web search service
            const { getWebSearchService } = await import('./webSearchService');
            const webSearch = getWebSearchService();

            // Get citation service
            const { getCitationService } = await import('./citationService');
            const citationService = getCitationService();

            const contactData = params.contactData || {};
            const searchQuery = `${contactData.name} ${contactData.company} ${contactData.title}`;

            const searchResults = await webSearch.searchWithCitation(searchQuery, {
              maxResults: 5,
              includeSources: true
            });

            // Store citations
            if (searchResults.citations.length > 0) {
              await citationService.trackCitations('contact', params.contactId, searchResults.citations);
            }

            return {
              success: true,
              data: {
                enrichedData: searchResults.results,
                citations: searchResults.citations,
                confidence: 0.85
              },
              metadata: {
                executionTime: Date.now() - startTime,
                citations: searchResults.citations
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Enrichment failed',
              metadata: {
                executionTime: Date.now() - startTime
              }
            };
          }
        }
      },
      requiresConfirmation: false,
      fallbackBehavior: 'skip',
      estimatedDuration: 5000,
      cacheable: true,
      priority: 'medium'
    });

    // Deal Management Functions
    this.registerFunction({
      name: 'comprehensive_deal_analysis',
      description: 'Multi-factor deal scoring and analysis',
      category: 'deal',
      parameters: [
        {
          name: 'dealId',
          type: 'string',
          description: 'Deal identifier',
          required: true
        },
        {
          name: 'includeMarketResearch',
          type: 'boolean',
          description: 'Include market and competitor research',
          required: false,
          defaultValue: true
        },
        {
          name: 'includeStakeholderAnalysis',
          type: 'boolean',
          description: 'Include stakeholder influence analysis',
          required: false,
          defaultValue: true
        }
      ],
      handler: {
        execute: async (params, context) => {
          const startTime = Date.now();

          try {
            const { getEnhancedIntelligentAI } = await import('./enhancedIntelligentAIService');
            const aiService = getEnhancedIntelligentAI();

            const dealData = params.dealData || {};
            const result = await aiService.generateDealSummary(dealData, 'quality');

            return {
              success: true,
              data: {
                summary: result,
                probability: dealData.probability || 50,
                insights: await aiService.getInsights(dealData, 'quality'),
                recommendations: await aiService.suggestNextActions(dealData, 'quality')
              },
              metadata: {
                executionTime: Date.now() - startTime,
                confidence: 0.82
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Deal analysis failed',
              metadata: {
                executionTime: Date.now() - startTime
              }
            };
          }
        }
      },
      requiresConfirmation: false,
      fallbackBehavior: 'basic',
      estimatedDuration: 4000,
      cacheable: true,
      priority: 'high'
    });

    // Communication Functions
    this.registerFunction({
      name: 'generate_personalized_email',
      description: 'Create tailored email content based on recipient analysis',
      category: 'communication',
      parameters: [
        {
          name: 'contactId',
          type: 'string',
          description: 'Recipient contact identifier',
          required: true
        },
        {
          name: 'context',
          type: 'string',
          description: 'Email context or purpose',
          required: false,
          defaultValue: 'follow-up'
        },
        {
          name: 'tone',
          type: 'string',
          description: 'Desired email tone',
          required: false,
          defaultValue: 'professional',
          validation: (value) => ['professional', 'casual', 'friendly', 'formal'].includes(value),
          validationMessage: 'Tone must be professional, casual, friendly, or formal'
        }
      ],
      handler: {
        execute: async (params, context) => {
          const startTime = Date.now();

          try {
            const { getEnhancedIntelligentAI } = await import('./enhancedIntelligentAIService');
            const aiService = getEnhancedIntelligentAI();

            const contactData = params.contactData || {};
            const emailContent = await aiService.generateEmail(contactData, params.context, 'quality');

            return {
              success: true,
              data: {
                subject: `Follow-up regarding ${contactData.company || 'our discussion'}`,
                body: emailContent,
                personalization: {
                  recipientName: contactData.name,
                  company: contactData.company,
                  tone: params.tone
                }
              },
              metadata: {
                executionTime: Date.now() - startTime,
                confidence: 0.88
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Email generation failed',
              metadata: {
                executionTime: Date.now() - startTime
              }
            };
          }
        }
      },
      requiresConfirmation: false,
      fallbackBehavior: 'basic',
      estimatedDuration: 2000,
      cacheable: false, // Emails should be fresh
      priority: 'high'
    });
  }

  registerFunction(func: AIFunction): void {
    this.functions.set(func.name, func);
  }

  async executeFunction(
    functionName: string,
    parameters: Record<string, any>,
    context?: FunctionContext
  ): Promise<FunctionResult> {
    const func = this.functions.get(functionName);
    if (!func) {
      return {
        success: false,
        error: `Function '${functionName}' not found`
      };
    }

    // Rate limiting check
    const userKey = context?.userId || 'anonymous';
    if (!this.rateLimiter.isAllowed(userKey)) {
      // Track rate limit violation
      const { getMonitoringService } = await import('./monitoringService');
      const monitoring = getMonitoringService();
      monitoring.trackRateLimitExceeded(userKey, functionName);

      return {
        success: false,
        error: `Rate limit exceeded. Please try again later.`
      };
    }

    this.stats.totalCalls++;
    this.stats.activeFunctions++;

    try {
      // Validate and sanitize parameters
      const validation = await this.validateParameters(func, parameters);
      if (!validation.valid) {
        return {
          success: false,
          error: `Parameter validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Additional input sanitization for AI safety
      const sanitizedParams = await this.sanitizeParameters(parameters, func.category);

      // Check cache first
      if (func.cacheable) {
        const cacheKey = this.generateCacheKey(functionName, parameters);
        const { getCacheService } = await import('./cacheService');
        const cacheService = getCacheService();
        const cachedResult = await cacheService.get<FunctionResult>(cacheKey);

        if (cachedResult) {
          this.stats.cacheHitRate = (this.stats.cacheHitRate * (this.stats.totalCalls - 1) + 1) / this.stats.totalCalls;
          return cachedResult;
        }
      }

      // Execute function with timeout
      const executionId = `${functionName}_${Date.now()}_${Math.random()}`;
      const executionPromise = func.handler.execute(sanitizedParams, context);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Function execution timeout after ${func.estimatedDuration}ms`)), func.estimatedDuration)
      );

      this.activeExecutions.set(executionId, executionPromise);

      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Cache successful results
      if (func.cacheable && result.success) {
        const cacheKey = this.generateCacheKey(functionName, parameters);
        const { getCacheService } = await import('./cacheService');
        const cacheService = getCacheService();
        await cacheService.set(cacheKey, result, func.estimatedDuration);
      }

      // Update stats
      if (result.success) {
        this.stats.successfulCalls++;
      } else {
        this.stats.failedCalls++;
      }

      this.stats.averageExecutionTime =
        (this.stats.averageExecutionTime * (this.stats.totalCalls - 1) + (result.metadata?.executionTime || 0)) / this.stats.totalCalls;

      // Track performance metrics
      const { getMonitoringService } = await import('./monitoringService');
      const monitoring = getMonitoringService();
      monitoring.trackAIFunctionCall(
        functionName,
        result.metadata?.executionTime || 0,
        result.success,
        context?.userId,
        {
          tokensUsed: result.metadata?.tokensUsed,
          cost: result.metadata?.cost,
          confidence: result.metadata?.confidence
        }
      );

      return result;

    } catch (error) {
      this.stats.failedCalls++;
      const errorMessage = error instanceof Error ? error.message : 'Function execution failed';

      // Log timeout errors for monitoring
      if (errorMessage.includes('timeout')) {
        console.warn(`Function ${functionName} timed out:`, errorMessage);
      }

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      this.stats.activeFunctions--;
    }
  }

  async validateParameters(func: AIFunction, params: Record<string, any>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const param of func.parameters) {
      const value = params[param.name];

      // Check required parameters
      if (param.required && (value === undefined || value === null)) {
        errors.push(`${param.name} is required`);
        continue;
      }

      // Use default value if not provided
      if (value === undefined && param.defaultValue !== undefined) {
        params[param.name] = param.defaultValue;
      }

      // Validate parameter if validator exists
      if (param.validation && value !== undefined) {
        try {
          const isValid = param.validation(value);
          if (!isValid) {
            errors.push(param.validationMessage || `${param.name} is invalid`);
          }
        } catch (error) {
          errors.push(`${param.name} validation failed`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private async sanitizeParameters(params: Record<string, any>, category: string): Promise<Record<string, any>> {
    const { validateContactData, validateDealData, validateString } = await import('../utils/validation');

    const sanitized = { ...params };

    // Category-specific sanitization
    switch (category) {
      case 'contact':
        if (params.contactData) {
          const validation = validateContactData(params.contactData);
          if (validation.isValid) {
            sanitized.contactData = validation.sanitizedValue;
          } else {
            console.warn('Contact data validation failed:', validation.error);
          }
        }
        break;

      case 'deal':
        if (params.dealData) {
          const validation = validateDealData(params.dealData);
          if (validation.isValid) {
            sanitized.dealData = validation.sanitizedValue;
          } else {
            console.warn('Deal data validation failed:', validation.error);
          }
        }
        break;

      case 'communication':
        if (params.context) {
          const validation = validateString(params.context, { maxLength: 500 });
          if (validation.isValid) {
            sanitized.context = validation.sanitizedValue;
          }
        }
        if (params.tone) {
          const validation = validateString(params.tone, {
            allowedValues: ['professional', 'casual', 'friendly', 'formal']
          });
          if (validation.isValid) {
            sanitized.tone = validation.sanitizedValue;
          }
        }
        break;
    }

    return sanitized;
  }

  private generateCacheKey(functionName: string, params: Record<string, any>): string {
    const paramString = JSON.stringify(params, Object.keys(params).sort());
    return `func:${functionName}:${btoa(paramString).replace(/[^a-zA-Z0-9]/g, '')}`;
  }

  async isFunctionAvailable(functionName: string): Promise<boolean> {
    const func = this.functions.get(functionName);
    return !!func;
  }

  getAvailableFunctions(category?: string): AIFunction[] {
    const allFunctions = Array.from(this.functions.values());
    if (!category) return allFunctions;
    return allFunctions.filter(func => func.category === category);
  }

  getFunctionDetails(functionName: string): AIFunction | null {
    return this.functions.get(functionName) || null;
  }

  getStats(): OrchestratorStats {
    return { ...this.stats };
  }

  async queueFunctionCall(call: FunctionCall): Promise<void> {
    this.executionQueue.push(call);

    if (call.delay) {
      setTimeout(() => this.processQueue(), call.delay);
    } else {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.executionQueue.length === 0) return;

    const call = this.executionQueue.shift();
    if (!call) return;

    try {
      await this.executeFunction(call.function, call.parameters);
    } catch (error) {
      console.error(`Queued function execution failed:`, error);
    }
  }

  async batchExecuteFunctions(calls: FunctionCall[]): Promise<FunctionResult[]> {
    const promises = calls.map(call =>
      this.executeFunction(call.function, call.parameters)
    );

    return Promise.all(promises);
  }

  // Cleanup method for graceful shutdown
  async cleanup(): Promise<void> {
    // Wait for active executions to complete
    const activePromises = Array.from(this.activeExecutions.values());
    await Promise.allSettled(activePromises);

    this.executionQueue = [];
    this.activeExecutions.clear();
  }
}

// Singleton instance
let orchestratorInstance: AIFunctionOrchestrator | null = null;

export const getAIFunctionOrchestrator = (): AIFunctionOrchestrator => {
  if (!orchestratorInstance) {
    orchestratorInstance = new AIFunctionOrchestrator();
  }
  return orchestratorInstance;
};

export type {
  AIFunction,
  FunctionParameter,
  FunctionHandler,
  FunctionContext,
  FunctionResult,
  ValidationResult,
  FunctionCall,
  OrchestratorStats
};