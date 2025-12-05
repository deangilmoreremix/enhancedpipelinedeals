import OpenAI from 'openai';
import { createInbox, replyToMessage } from '../../agentmailClient';
import { supabase } from '../../core/supabaseClient';
import { logger } from '../../core/logger';

export interface SDRContext {
  contactId?: string;
  dealId?: string;
  contact?: any;
  deal?: any;
  customPrompts?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface SDRAgentResult {
  success: boolean;
  action: string;
  message?: string;
  emailData?: {
    to: string;
    subject: string;
    body: string;
  };
  agentMailResult?: any;
  metadata?: Record<string, any>;
  error?: string;
}

export interface SDRMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageResponseTime: number;
  lastRunAt?: Date;
  errorRate: number;
}

export abstract class BaseSDRAgent {
  protected openai: OpenAI;
  protected agentId: string;
  protected name: string;
  protected description: string;
  protected metrics: SDRMetrics;

  constructor(agentId: string, name: string, description: string) {
    this.agentId = agentId;
    this.name = name;
    this.description = description;
    this.openai = new OpenAI({
      apiKey: process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    });

    this.metrics = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      averageResponseTime: 0,
      errorRate: 0,
    };

    this.loadMetrics();
  }

  /**
   * Main execution method - to be implemented by each agent
   */
  abstract execute(context: SDRContext): Promise<SDRAgentResult>;

  /**
   * Generate AI prompt for this agent type
   */
  protected abstract generatePrompt(context: SDRContext): string;

  /**
   * Validate context before execution
   */
  protected validateContext(context: SDRContext): { valid: boolean; error?: string } {
    if (!context.contactId && !context.contact) {
      return { valid: false, error: 'Contact ID or contact object is required' };
    }
    return { valid: true };
  }

  /**
   * Load contact and deal data from database
   */
  protected async loadData(context: SDRContext): Promise<{ contact: any; deal?: any }> {
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
      contact = data;
    }

    // Load deal if not provided but contact has active deal
    if (!deal && contact?.active_deal_id) {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('id', contact.active_deal_id)
        .single();

      if (!error && data) {
        deal = data;
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
      deal = data;
    }

    if (!contact) {
      throw new Error('Contact data is required but not found');
    }

    return { contact, deal };
  }

  /**
   * Send email via AgentMail
   */
  protected async sendEmail(emailData: { to: string; subject: string; body: string }, context: SDRContext): Promise<any> {
    try {
      // Create inbox if needed
      const inbox = await createInbox({
        name: `sdr-${this.agentId}-${Date.now()}`,
        // Add other inbox configuration as needed
      });

      // Send the email
      const result = await replyToMessage({
        inboxId: inbox.id,
        messageId: '', // This would be from a thread or new message
        to: emailData.to,
        text: emailData.body,
      });

      logger.info(`[${this.name}] Email sent successfully`, {
        agentId: this.agentId,
        to: emailData.to,
        subject: emailData.subject,
        inboxId: inbox.id,
      });

      return result;
    } catch (error) {
      logger.error(`[${this.name}] Failed to send email`, {
        agentId: this.agentId,
        error: error instanceof Error ? error.message : String(error),
        emailData,
      });
      throw error;
    }
  }

  /**
   * Execute agent with full error handling and metrics
   */
  public async run(context: SDRContext): Promise<SDRAgentResult> {
    const startTime = Date.now();
    this.metrics.totalRuns++;

    try {
      // Validate context
      const validation = this.validateContext(context);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Execute agent logic
      const result = await this.execute(context);

      // Update metrics
      this.metrics.successfulRuns++;
      this.updateResponseTime(Date.now() - startTime);
      await this.saveMetrics();

      logger.info(`[${this.name}] Agent executed successfully`, {
        agentId: this.agentId,
        contactId: context.contactId,
        dealId: context.dealId,
        executionTime: Date.now() - startTime,
      });

      return result;

    } catch (error: any) {
      this.metrics.failedRuns++;
      this.updateResponseTime(Date.now() - startTime);
      await this.saveMetrics();

      logger.error(`[${this.name}] Agent execution failed`, {
        agentId: this.agentId,
        contactId: context.contactId,
        dealId: context.dealId,
        error: error.message,
        executionTime: Date.now() - startTime,
      });

      return {
        success: false,
        action: this.agentId,
        error: error.message,
        metadata: {
          executionTime: Date.now() - startTime,
          agentId: this.agentId,
        },
      };
    }
  }

  /**
   * Get AI completion using OpenAI
   */
  protected async getCompletion(prompt: string, options: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming> = {}): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1000,
        stream: false,
        ...options,
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      return content;
    } catch (error: any) {
      logger.error(`[${this.name}] OpenAI API error`, {
        agentId: this.agentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`AI completion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
   * Load metrics from database
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
      logger.warn(`[${this.name}] Failed to load metrics`, { agentId: this.agentId, error });
    }
  }

  /**
   * Save metrics to database
   */
  private async saveMetrics(): Promise<void> {
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
      logger.warn(`[${this.name}] Failed to save metrics`, { agentId: this.agentId, error });
    }
  }

  /**
   * Get agent information
   */
  public getInfo() {
    return {
      id: this.agentId,
      name: this.name,
      description: this.description,
      metrics: this.metrics,
    };
  }
}