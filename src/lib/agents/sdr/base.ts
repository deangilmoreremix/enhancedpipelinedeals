/**
 * Production-Hardened Base SDR Agent
 * Features: AbortController support, memory leak prevention, timeout handling, circuit breakers, rate limiting
 */

import OpenAI from 'openai';
import { supabase } from '../../core/supabaseClient';
import { enhancedLogger, withLogContext, createCorrelationId } from '../../core/enhancedLogger';
import {
  withResilience,
  withTimeout,
  circuitBreakers,
  timeouts,
  retryPolicies,
  RateLimiter,
  AbortError,
  TimeoutError,
} from '../../core/resilience';
import { SDRContextSchema, SDRAgentResultSchema, type SDRContext, type SDRAgentResult } from '../../schemas/sdrSchemas';
import { z } from 'zod';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Timeouts
  DEFAULT_TIMEOUT_MS: 30000,
  AI_TIMEOUT_MS: 60000,
  DB_TIMEOUT_MS: 10000,
  
  // Memory management
  MAX_PROMPT_LENGTH: 15000,
  MAX_RESPONSE_LENGTH: 5000,
  
  // Rate limiting
  MAX_CALLS_PER_MINUTE: 60,
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SDRContact {
  id: string;
  name: string;
  email: string;
  company?: string;
  title?: string;
  industry?: string;
  status?: string;
  lead_score?: number;
  active_deal_id?: string;
  [key: string]: unknown;
}

export interface SDRDeal {
  id: string;
  deal_name?: string;
  value?: number;
  stage?: string;
  description?: string;
  risk_score?: number;
  contact_id?: string;
  [key: string]: unknown;
}

export interface SDRMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageResponseTime: number;
  lastRunAt?: Date;
  errorRate: number;
}

export interface AgentExecutionOptions {
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  correlationId?: string;
  skipMetrics?: boolean;
}

// ============================================================================
// BASE SDR AGENT CLASS
// ============================================================================

export abstract class BaseSDRAgent {
  protected openai: OpenAI;
  protected agentId: string;
  protected name: string;
  protected description: string;
  protected metrics: SDRMetrics;
  private rateLimiter: RateLimiter;
  private activeOperations = new Map<string, AbortController>();
  private metricsSaveQueue: Promise<void> = Promise.resolve();

  constructor(agentId: string, name: string, description: string) {
    this.agentId = agentId;
    this.name = name;
    this.description = description;
    
    const apiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    this.openai = new OpenAI({ apiKey });

    this.metrics = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      averageResponseTime: 0,
      errorRate: 0,
    };

    this.rateLimiter = new RateLimiter({
      maxRequests: CONFIG.MAX_CALLS_PER_MINUTE,
      windowMs: 60000,
    });

    // Load metrics asynchronously
    this.loadMetrics().catch(err => {
      enhancedLogger.warn(`[${this.name}] Failed to load initial metrics`, { error: err.message });
    });

    // Setup cleanup on process exit
    this.setupCleanup();
  }

  /**
   * Main execution method - to be implemented by each agent
   */
  abstract execute(context: SDRContext, abortSignal: AbortSignal): Promise<SDRAgentResult>;

  /**
   * Generate AI prompt for this agent type
   */
  protected abstract generatePrompt(context: SDRContext): string;

  /**
   * Validate context before execution
   */
  protected validateContext(context: SDRContext): { valid: boolean; error?: string } {
    try {
      SDRContextSchema.parse(context);
      
      if (!context.contactId && !context.contact) {
        return { valid: false, error: 'Contact ID or contact object is required' };
      }
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues || [];
        return { valid: false, error: `Context validation failed: ${issues.map((e: z.ZodIssue) => e.message).join(', ')}` };
      }
      throw error;
    }
  }

  /**
   * Run agent with full error handling, metrics, and resource management
   */
  public async run(
    context: SDRContext,
    options: AgentExecutionOptions = {}
  ): Promise<SDRAgentResult> {
    const correlationId = options.correlationId || createCorrelationId();
    const operationId = `${this.agentId}-${Date.now()}`;
    const abortController = new AbortController();
    
    // Register operation for cleanup
    this.activeOperations.set(operationId, abortController);

    // Link external abort signal if provided
    if (options.abortSignal) {
      const externalHandler = () => abortController.abort();
      options.abortSignal.addEventListener('abort', externalHandler, { once: true });
    }

    const startTime = performance.now();
    this.metrics.totalRuns++;

    return withLogContext({ 
      correlationId, 
      agentId: this.agentId,
      operation: `${this.name}.run` 
    }, async () => {
      try {
        // Apply rate limiting
        await this.rateLimiter.acquire(this.agentId);

        enhancedLogger.info(`[${this.name}] Agent execution started`, {
          contactId: context.contactId,
          hasDeal: !!context.dealId,
        });

        // Check for early abort
        if (abortController.signal.aborted) {
          throw new AbortError('Operation was aborted before execution');
        }

        // Validate context
        const validation = this.validateContext(context);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        // Execute with timeout
        const timeoutMs = options.timeoutMs || CONFIG.DEFAULT_TIMEOUT_MS;
        const timeoutId = setTimeout(() => {
          abortController.abort();
        }, timeoutMs);

        let result: SDRAgentResult;
        try {
          result = await this.execute(context, abortController.signal);
        } finally {
          clearTimeout(timeoutId);
        }

        // Validate result
        const validatedResult = SDRAgentResultSchema.parse(result);

        // Update metrics
        if (!options.skipMetrics) {
          this.metrics.successfulRuns++;
          this.updateResponseTime(performance.now() - startTime);
          await this.saveMetrics();
        }

        enhancedLogger.info(`[${this.name}] Agent executed successfully`, {
          contactId: context.contactId,
          executionTime: Math.round(performance.now() - startTime),
          action: validatedResult.action,
        });

        return validatedResult;

      } catch (error) {
        // Update failure metrics
        if (!options.skipMetrics) {
          this.metrics.failedRuns++;
          this.updateResponseTime(performance.now() - startTime);
          await this.saveMetrics();
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        
        enhancedLogger.error(`[${this.name}] Agent execution failed`, {
          contactId: context.contactId,
          error: errorMessage,
          executionTime: Math.round(performance.now() - startTime),
        });

        return {
          success: false,
          action: this.agentId,
          error: errorMessage,
          metadata: {
            executionTime: Math.round(performance.now() - startTime),
            agentId: this.agentId,
            correlationId,
          },
        };
      } finally {
        // Cleanup
        this.activeOperations.delete(operationId);
      }
    });
  }

  /**
   * Get AI completion using OpenAI with circuit breaker and timeout
   */
  protected async getCompletion(
    prompt: string,
    options: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming> = {},
    abortSignal?: AbortSignal
  ): Promise<string> {
    // Truncate prompt if too long
    const safePrompt = prompt.slice(0, CONFIG.MAX_PROMPT_LENGTH);

    return withResilience(
      async (signal) => {
        // Check combined abort signals
        if (abortSignal?.aborted || signal.aborted) {
          throw new AbortError('AI completion aborted');
        }

        const response = await this.openai.chat.completions.create({
          model: options.model || 'gpt-4',
          messages: [{ role: 'user', content: safePrompt }],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 1000,
          stream: false,
          ...options,
        } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content received from OpenAI');
        }

        // Truncate response if too long
        return content.slice(0, CONFIG.MAX_RESPONSE_LENGTH);
      },
      {
        timeout: { timeoutMs: CONFIG.AI_TIMEOUT_MS, operationName: 'openai-completion' },
        retry: retryPolicies.ai,
        circuitBreaker: circuitBreakers.openAI,
      }
    );
  }

  /**
   * Load contact and deal data from database with timeout
   */
  protected async loadData(
    context: SDRContext,
    abortSignal?: AbortSignal
  ): Promise<{ contact: SDRContact; deal?: SDRDeal }> {
    return withResilience(
      async (signal) => {
        if (abortSignal?.aborted || signal.aborted) {
          throw new AbortError('Data loading aborted');
        }

        let contact = context.contact;
        let deal = context.deal;

        // Load contact if not provided
        if (!contact && context.contactId) {
          const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', context.contactId)
            .single();

          if (error) {
            throw new Error(`Failed to load contact: ${error.message}`);
          }
          contact = data as SDRContact;
        }

        // Load deal if not provided but contact has active deal
        if (!deal && contact?.active_deal_id) {
          const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('id', contact.active_deal_id)
            .single();

          if (!error && data) {
            deal = data as SDRDeal;
          }
        }

        // Load specific deal if dealId provided
        if (!deal && context.dealId) {
          const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('id', context.dealId)
            .single();

          if (error) {
            throw new Error(`Failed to load deal: ${error.message}`);
          }
          deal = data as SDRDeal;
        }

        if (!contact) {
          throw new Error('Contact data is required but not found');
        }

        return { contact, deal };
      },
      {
        timeout: { timeoutMs: CONFIG.DB_TIMEOUT_MS, operationName: 'load-data' },
        retry: retryPolicies.db,
        circuitBreaker: circuitBreakers.supabase,
      }
    );
  }

  /**
   * Send email (stub - email service removed)
   * @deprecated Email sending functionality has been removed. Use external email service.
   */
  protected async sendEmail(
    emailData: { to: string; subject: string; body: string },
    _context: SDRContext,
    abortSignal?: AbortSignal
  ): Promise<unknown> {
    if (abortSignal?.aborted) {
      throw new AbortError('Email sending aborted');
    }

    enhancedLogger.warn(`[${this.name}] Email sending not available - AgentMail removed`, {
      agentId: this.agentId,
      to: '[REDACTED]',
      subject: emailData.subject.slice(0, 100),
    });

    // Return stub response since AgentMail is removed
    return {
      success: false,
      messageId: `stub_${Date.now()}`,
      status: "not_sent",
      timestamp: new Date().toISOString(),
      error: 'Email service not configured - AgentMail removed',
    };
  }

  /**
   * Update average response time
   */
  private updateResponseTime(responseTime: number): void {
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRuns - 1);
    this.metrics.averageResponseTime = (totalTime + responseTime) / this.metrics.totalRuns;
    this.metrics.errorRate = this.metrics.failedRuns / this.metrics.totalRuns;
  }

  /**
   * Load metrics from database with debouncing
   */
  private async loadMetrics(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('agent_metrics')
        .select('*')
        .eq('agent_id', this.agentId)
        .single();

      if (!error && data) {
        this.metrics = {
          totalRuns: data.total_runs || 0,
          successfulRuns: data.successful_runs || 0,
          failedRuns: data.failed_runs || 0,
          averageResponseTime: data.average_response_time || 0,
          lastRunAt: data.last_run_at ? new Date(data.last_run_at) : undefined,
          errorRate: data.error_rate || 0,
        };
      }
    } catch (error) {
      enhancedLogger.warn(`[${this.name}] Failed to load metrics`, { 
        agentId: this.agentId, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Save metrics to database with queue to prevent race conditions
   */
  private async saveMetrics(): Promise<void> {
    this.metricsSaveQueue = this.metricsSaveQueue.then(async () => {
      try {
        this.metrics.lastRunAt = new Date();

        await supabase
          .from('agent_metrics')
          .upsert({
            agent_id: this.agentId,
            total_runs: this.metrics.totalRuns,
            successful_runs: this.metrics.successfulRuns,
            failed_runs: this.metrics.failedRuns,
            average_response_time: this.metrics.averageResponseTime,
            last_run_at: this.metrics.lastRunAt.toISOString(),
            error_rate: this.metrics.errorRate,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'agent_id'
          });
      } catch (error) {
        enhancedLogger.warn(`[${this.name}] Failed to save metrics`, { 
          agentId: this.agentId, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });

    return this.metricsSaveQueue;
  }

  /**
   * Get agent information
   */
  public getInfo() {
    return {
      id: this.agentId,
      name: this.name,
      description: this.description,
      metrics: { ...this.metrics },
      activeOperations: this.activeOperations.size,
    };
  }

  /**
   * Abort all active operations
   */
  public abortAll(): void {
    enhancedLogger.info(`[${this.name}] Aborting all operations`, {
      activeCount: this.activeOperations.size,
    });

    for (const [id, controller] of this.activeOperations) {
      controller.abort();
      this.activeOperations.delete(id);
    }
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.abortAll();
    // Clear any other resources
    this.activeOperations.clear();
  }

  /**
   * Setup cleanup handlers
   */
  private setupCleanup(): void {
    // Cleanup on process exit
    const cleanup = () => {
      this.dispose();
    };

    // Handle various termination signals
    if (typeof process !== 'undefined') {
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      process.on('beforeExit', cleanup);
    }

    // Handle page unload in browser
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', cleanup);
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create an abortable timeout promise
 */
export function createTimeoutPromise(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, ms);
    
    if (abortSignal) {
      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new AbortError('Timeout was aborted'));
      };
      
      if (abortSignal.aborted) {
        abortHandler();
      } else {
        abortSignal.addEventListener('abort', abortHandler, { once: true });
      }
    }
  });
}

/**
 * Wrap a promise with abort support
 */
export function withAbort<T>(
  promise: Promise<T>,
  abortSignal: AbortSignal
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (abortSignal.aborted) {
      reject(new AbortError('Operation was aborted'));
      return;
    }

    const abortHandler = () => {
      reject(new AbortError('Operation was aborted'));
    };

    abortSignal.addEventListener('abort', abortHandler, { once: true });

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => {
        abortSignal.removeEventListener('abort', abortHandler);
      });
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export types for backward compatibility
export type { SDRContext, SDRAgentResult } from '../../schemas/sdrSchemas';
export { AbortError, TimeoutError };
