import { sdrAgentRegistry } from '../lib/agents/sdr/registry';
import { SDRContext, SDRAgentResult } from '../lib/agents/sdr/base';
import { supabase } from '../lib/core/supabaseClient';
import { sdrPreferencesService } from './sdrPreferencesService';
import { SDRAgentPreferences } from '../types/sdr-config';

export interface SDRExecutionResult {
  success: boolean;
  agentId: string;
  contextId: string;
  result: SDRAgentResult;
  executedAt: Date;
  executionTime: number;
}

export interface BulkExecutionResult {
  total: number;
  successful: number;
  failed: number;
  results: SDRExecutionResult[];
}

export interface ScheduledExecution {
  id: string;
  agentId: string;
  context: SDRContext;
  scheduledFor: Date;
  createdAt: Date;
}

export class SDRExecutionService {
  private executionHistory: Map<string, SDRExecutionResult[]> = new Map();

  /**
   * Execute a single SDR agent with user preferences
   */
  async executeAgent(agentId: string, context: SDRContext, userId?: string): Promise<SDRAgentResult> {
    const agent = sdrAgentRegistry[agentId];
    if (!agent) {
      throw new Error(`SDR Agent '${agentId}' not found in registry`);
    }

    const startTime = Date.now();
    let result: SDRAgentResult;

    try {
      // Load user preferences if userId provided
      let userPreferences: SDRAgentPreferences | undefined;
      if (userId) {
        const prefs = await sdrPreferencesService.getUserPreferences(userId, agentId);
        userPreferences = prefs?.preferences;
      }

      console.log(`🤖 Executing SDR Agent: ${agentId}`, {
        contextId: context.contactId || context.dealId,
        agentName: agent.name,
        userPreferences: !!userPreferences
      });

      // Execute agent with user preferences
      result = await agent.run(context, userPreferences);
      const executionTime = Date.now() - startTime;

      // Store execution result
      const executionResult: SDRExecutionResult = {
        success: result.success,
        agentId,
        contextId: context.contactId || context.dealId || 'unknown',
        result,
        executedAt: new Date(),
        executionTime
      };

      this.storeExecutionResult(executionResult);

      // Log to database
      await this.logExecutionToDatabase(executionResult);

      console.log(`✅ SDR Agent ${agentId} completed`, {
        success: result.success,
        executionTime: `${executionTime}ms`,
        action: result.action
      });

      return result;

    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      console.error(`❌ SDR Agent ${agentId} failed:`, error);

      result = {
        success: false,
        action: 'execution_failed',
        error: error.message,
        metadata: {
          agentId,
          contextId: context.contactId || context.dealId,
          executionTime
        }
      };

      // Store failed execution
      const executionResult: SDRExecutionResult = {
        success: false,
        agentId,
        contextId: context.contactId || context.dealId || 'unknown',
        result,
        executedAt: new Date(),
        executionTime
      };

      this.storeExecutionResult(executionResult);
      await this.logExecutionToDatabase(executionResult);

      return result;
    }
  }

  /**
   * Execute SDR agent for multiple contexts (bulk operations)
   */
  async bulkExecuteAgent(agentId: string, contexts: SDRContext[]): Promise<BulkExecutionResult> {
    const results: SDRExecutionResult[] = [];
    let successful = 0;
    let failed = 0;

    console.log(`🚀 Starting bulk execution of ${agentId} for ${contexts.length} contexts`);

    // Execute in batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < contexts.length; i += batchSize) {
      const batch = contexts.slice(i, i + batchSize);
      const batchPromises = batch.map(context => this.executeAgent(agentId, context));

      try {
        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((promiseResult, index) => {
          const context = batch[index];
          const contextId = context.contactId || context.dealId || `batch-${i + index}`;

          if (promiseResult.status === 'fulfilled') {
            const result = promiseResult.value;
            successful++;

            results.push({
              success: true,
              agentId,
              contextId,
              result,
              executedAt: new Date(),
              executionTime: 0 // Would need to track individually
            });
          } else {
            failed++;

            results.push({
              success: false,
              agentId,
              contextId,
              result: {
                success: false,
                action: 'bulk_execution_failed',
                error: promiseResult.reason?.message || 'Unknown error',
                metadata: { agentId, contextId }
              },
              executedAt: new Date(),
              executionTime: 0
            });
          }
        });

        // Small delay between batches
        if (i + batchSize < contexts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`Batch execution error for ${agentId}:`, error);
      }
    }

    const bulkResult: BulkExecutionResult = {
      total: contexts.length,
      successful,
      failed,
      results
    };

    console.log(`📊 Bulk execution completed: ${successful}/${contexts.length} successful`);

    return bulkResult;
  }

  /**
   * Schedule an SDR agent for future execution
   */
  async scheduleAgent(agentId: string, context: SDRContext, delayMinutes: number): Promise<string> {
    const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);
    const scheduleId = `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const scheduledExecution: ScheduledExecution = {
      id: scheduleId,
      agentId,
      context,
      scheduledFor,
      createdAt: new Date()
    };

    // Store in local storage for now (could be database in production)
    const scheduled = JSON.parse(localStorage.getItem('sdr-scheduled-executions') || '[]');
    scheduled.push(scheduledExecution);
    localStorage.setItem('sdr-scheduled-executions', JSON.stringify(scheduled));

    // Set up actual scheduling (using setTimeout for demo)
    setTimeout(async () => {
      try {
        await this.executeAgent(agentId, context);

        // Remove from scheduled list
        const updated = scheduled.filter((s: ScheduledExecution) => s.id !== scheduleId);
        localStorage.setItem('sdr-scheduled-executions', JSON.stringify(updated));

      } catch (error) {
        console.error(`Scheduled execution failed for ${agentId}:`, error);
      }
    }, delayMinutes * 60 * 1000);

    console.log(`⏰ Scheduled ${agentId} for execution in ${delayMinutes} minutes`);

    return scheduleId;
  }

  /**
   * Get execution history for a specific context
   */
  getExecutionHistory(contextId: string): SDRExecutionResult[] {
    return this.executionHistory.get(contextId) || [];
  }

  /**
   * Get all scheduled executions
   */
  getScheduledExecutions(): ScheduledExecution[] {
    try {
      return JSON.parse(localStorage.getItem('sdr-scheduled-executions') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Cancel a scheduled execution
   */
  cancelScheduledExecution(scheduleId: string): boolean {
    try {
      const scheduled = JSON.parse(localStorage.getItem('sdr-scheduled-executions') || '[]');
      const filtered = scheduled.filter((s: ScheduledExecution) => s.id !== scheduleId);

      if (filtered.length < scheduled.length) {
        localStorage.setItem('sdr-scheduled-executions', JSON.stringify(filtered));
        console.log(`❌ Cancelled scheduled execution: ${scheduleId}`);
        return true;
      }
    } catch (error) {
      console.error('Failed to cancel scheduled execution:', error);
    }
    return false;
  }

  /**
   * Private method to store execution results in memory
   */
  private storeExecutionResult(result: SDRExecutionResult): void {
    const contextId = result.contextId;
    const history = this.executionHistory.get(contextId) || [];
    history.push(result);

    // Keep only last 50 executions per context
    if (history.length > 50) {
      history.shift();
    }

    this.executionHistory.set(contextId, history);
  }

  /**
   * Private method to log execution to database
   */
  private async logExecutionToDatabase(result: SDRExecutionResult): Promise<void> {
    try {
      await supabase.from('sdr_agent_executions').insert({
        agent_id: result.agentId,
        context_id: result.contextId,
        success: result.success,
        action: result.result.action,
        execution_time: result.executionTime,
        result_data: result.result,
        executed_at: result.executedAt.toISOString(),
        created_at: new Date().toISOString()
      });
    } catch (error) {
      // Silently fail database logging - don't break the main flow
      console.warn('Failed to log SDR execution to database:', error);
    }
  }
}

// Singleton instance
export const sdrExecutionService = new SDRExecutionService();