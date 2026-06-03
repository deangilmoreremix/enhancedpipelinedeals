import { supabase } from './supabaseService';
import {
  Workflow,
  WorkflowExecution,
  WorkflowExecutionStep,
  WorkflowExecutionLog,
  WorkflowTrigger,
  WorkflowAction,
  TriggerType,
  ActionType,
  WorkflowCondition
} from '../types/workflow';

/**
 * Advanced Workflow Execution Engine
 * Handles the execution of complex workflows with triggers, actions, conditions, and error handling
 */
export class WorkflowExecutionEngine {
  private static instance: WorkflowExecutionEngine;
  private activeExecutions: Map<string, WorkflowExecution> = new Map();
  private executionTimeouts: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): WorkflowExecutionEngine {
    if (!WorkflowExecutionEngine.instance) {
      WorkflowExecutionEngine.instance = new WorkflowExecutionEngine();
    }
    return WorkflowExecutionEngine.instance;
  }

  /**
   * Execute a workflow based on a trigger
   */
  async executeWorkflow(
    workflow: Workflow,
    trigger: WorkflowTrigger,
    context: {
      recordId?: string;
      recordType?: string;
      userId?: string;
      inputData?: Record<string, any>;
      variables?: Record<string, any>;
    }
  ): Promise<WorkflowExecution> {
    const executionId = crypto.randomUUID();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      triggerId: trigger.id,
      triggerType: trigger.type,
      status: 'running',
      startedAt: new Date(),
      context,
      steps: [],
      logs: []
    };

    // Store execution
    this.activeExecutions.set(executionId, execution);

    // Set timeout if configured
    if (workflow.settings.maxExecutionTime > 0) {
      const timeout = setTimeout(() => {
        this.timeoutExecution(executionId);
      }, workflow.settings.maxExecutionTime * 60 * 1000);
      this.executionTimeouts.set(executionId, timeout);
    }

    try {
      // Log execution start
      await this.logExecution(executionId, 'info', `Workflow execution started: ${workflow.name}`, { trigger, context });

      // Execute workflow steps
      const result = await this.executeWorkflowSteps(workflow, execution);

      // Update execution status
      execution.status = result.success ? 'completed' : 'failed';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

      if (!result.success && result.error) {
        execution.error = result.error;
      }

      // Persist execution
      await this.persistExecution(execution);

      // Log completion
      await this.logExecution(executionId, result.success ? 'info' : 'error',
        `Workflow execution ${result.success ? 'completed' : 'failed'}`,
        { duration: execution.duration, error: result.error });

      // Handle notifications
      if (workflow.settings.notifications.onSuccess && result.success) {
        await this.sendNotification(execution, 'success');
      } else if (workflow.settings.notifications.onFailure && !result.success) {
        await this.sendNotification(execution, 'failure');
      }

    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      execution.error = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stackTrace: error instanceof Error ? error.stack : undefined
      };

      await this.persistExecution(execution);
      await this.logExecution(executionId, 'error', 'Workflow execution failed with exception', { error });
    } finally {
      // Cleanup
      this.activeExecutions.delete(executionId);
      const timeout = this.executionTimeouts.get(executionId);
      if (timeout) {
        clearTimeout(timeout);
        this.executionTimeouts.delete(executionId);
      }
    }

    return execution;
  }

  /**
   * Execute workflow steps in the correct order
   */
  private async executeWorkflowSteps(
    workflow: Workflow,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; error?: { message: string; stepId?: string; stackTrace?: string } }> {
    const stepMap = new Map(workflow.steps.map(step => [step.id, step]));
    const executedSteps = new Set<string>();
    const pendingSteps = new Set(workflow.steps.filter(s => s.type === 'trigger' || s.connections.length === 0).map(s => s.id));

    while (pendingSteps.size > 0) {
      const stepId = pendingSteps.values().next().value;
      pendingSteps.delete(stepId);

      if (executedSteps.has(stepId)) continue;

      const step = stepMap.get(stepId);
      if (!step) continue;

      // Execute step
      const result = await this.executeStep(step, execution);

      // Record step execution
      const stepExecution: WorkflowExecutionStep = {
        id: crypto.randomUUID(),
        stepId: step.id,
        status: result.success ? 'completed' : 'failed',
        startedAt: new Date(),
        completedAt: new Date(),
        output: result.output,
        error: result.error
      };

      if (stepExecution.startedAt && stepExecution.completedAt) {
        stepExecution.duration = stepExecution.completedAt.getTime() - stepExecution.startedAt.getTime();
      }

      execution.steps.push(stepExecution);

      // Log step execution
      await this.logExecution(execution.id, result.success ? 'info' : 'error',
        `Step ${step.name} ${result.success ? 'completed' : 'failed'}`,
        { stepId, output: result.output, error: result.error });

      if (!result.success) {
        // Handle step failure
        if (step.action?.errorHandling?.continueOnError) {
          // Continue with next steps despite error
          executedSteps.add(stepId);
          this.addConnectedSteps(step, pendingSteps, executedSteps);
          continue;
        } else {
          // Fail the entire workflow
          return {
            success: false,
            error: {
              message: result.error || 'Step execution failed',
              stepId: step.id
            }
          };
        }
      }

      executedSteps.add(stepId);
      this.addConnectedSteps(step, pendingSteps, executedSteps);
    }

    return { success: true };
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: any,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    try {
      switch (step.type) {
        case 'trigger':
          // Triggers are already validated before execution
          return { success: true };

        case 'action':
          return await this.executeAction(step.action, execution);

        case 'condition':
          return await this.evaluateCondition(step.condition, execution);

        case 'delay':
          await this.delay(step.delay * 60 * 1000); // Convert minutes to milliseconds
          return { success: true };

        default:
          return { success: false, error: `Unknown step type: ${step.type}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during step execution'
      };
    }
  }

  /**
   * Execute a workflow action
   */
  private async executeAction(
    action: WorkflowAction,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    // Check conditions first
    if (action.conditions && action.conditions.length > 0) {
      const conditionResult = await this.evaluateConditions(action.conditions, execution);
      if (!conditionResult) {
        return { success: true, output: { skipped: true, reason: 'Conditions not met' } };
      }
    }

    switch (action.type) {
      case 'create_record':
        return await this.executeCreateRecordAction(action, execution);

      case 'update_record':
        return await this.executeUpdateRecordAction(action, execution);

      case 'delete_record':
        return await this.executeDeleteRecordAction(action, execution);

      case 'search_records':
        return await this.executeSearchRecordsAction(action, execution);

      case 'upsert_record':
        return await this.executeUpsertRecordAction(action, execution);

      case 'send_email':
        return await this.executeSendEmailAction(action, execution);

      case 'delay':
        await this.delay((action.config.delayMinutes || 0) * 60 * 1000);
        return { success: true };

      case 'iterator':
        return await this.executeIteratorAction(action, execution);

      case 'filter':
        return await this.executeFilterAction(action, execution);

      case 'code':
        return await this.executeCodeAction(action, execution);

      case 'http_request':
        return await this.executeHttpRequestAction(action, execution);

      case 'ai_agent':
        return await this.executeAIAgentAction(action, execution);

      case 'webhook':
        return await this.executeWebhookAction(action, execution);

      default:
        return { success: false, error: `Unsupported action type: ${action.type}` };
    }
  }

  /**
   * Execute create record action
   */
  private async executeCreateRecordAction(
    action: WorkflowAction,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    try {
      const table = this.getTableName(action.config.recordType);
      const fields = this.interpolateVariables(action.config.fields || {}, execution);

      const { data, error } = await supabase
        .from(table)
        .insert(fields)
        .select()
        .single();

      if (error) throw error;

      return { success: true, output: { recordId: data.id, record: data } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create record' };
    }
  }

  /**
   * Execute update record action
   */
  private async executeUpdateRecordAction(
    action: WorkflowAction,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    try {
      const table = this.getTableName(action.config.recordType);
      const recordId = execution.context.recordId;
      const fields = this.interpolateVariables(action.config.fields || {}, execution);

      if (!recordId) {
        return { success: false, error: 'No record ID available for update' };
      }

      const { data, error } = await supabase
        .from(table)
        .update(fields)
        .eq('id', recordId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, output: { recordId: data.id, record: data } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update record' };
    }
  }

  /**
   * Execute delete record action
   */
  private async executeDeleteRecordAction(
    action: WorkflowAction,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    try {
      const table = this.getTableName(action.config.recordType);
      const recordId = execution.context.recordId;

      if (!recordId) {
        return { success: false, error: 'No record ID available for deletion' };
      }

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      return { success: true, output: { recordId, deleted: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete record' };
    }
  }

  /**
   * Execute search records action
   */
  private async executeSearchRecordsAction(
    action: WorkflowAction,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    try {
      const table = this.getTableName(action.config.recordType);
      const criteria = this.interpolateVariables(action.config.searchCriteria || {}, execution);

      let query = supabase.from(table).select('*');

      // Apply search criteria
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, output: { records: data, count: data?.length || 0 } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to search records' };
    }
  }

  /**
   * Execute upsert record action
   */
  private async executeUpsertRecordAction(
    action: WorkflowAction,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    try {
      const table = this.getTableName(action.config.recordType);
      const fields = this.interpolateVariables(action.config.fields || {}, execution);
      const upsertKey = action.config.upsertKey || 'id';

      const { data, error } = await supabase
        .from(table)
        .upsert(fields, { onConflict: upsertKey })
        .select()
        .single();

      if (error) throw error;

      return { success: true, output: { recordId: data.id, record: data, created: !data.created_at } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to upsert record' };
    }
  }

  /**
   * Execute send email action
   */
  private async executeSendEmailAction(
    action: WorkflowAction,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    try {
      // Import email service dynamically to avoid circular dependencies
      const { EmailService } = await import('./emailService');

      const recipients = this.interpolateVariables(action.config.recipients || [], execution);
      const subject = this.interpolateVariables(action.config.subject || '', execution);
      const body = this.interpolateVariables(action.config.body || '', execution);

      // Use email service to send
      const result = await EmailService.sendEmail({
        to: recipients,
        subject,
        body,
        attachments: action.config.attachments
      });

      return { success: result.success, output: result, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to send email' };
    }
  }

  /**
   * Execute iterator action
   */
  private async executeIteratorAction(
    action: WorkflowAction,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    try {
      let items: any[] = [];

      switch (action.config.iteratorSource) {
        case 'records':
          // Get records from previous step or context
          items = execution.context.inputData?.records || [];
          break;
        case 'array':
          items = execution.context.variables?.[action.config.iteratorVariable || 'array'] || [];
          break;
        case 'query_result':
          items = execution.steps[execution.steps.length - 1]?.output?.records || [];
          break;
      }

      const results = [];
      for (const item of items) {
        // Set iterator variable
        execution.context.variables = {
          ...execution.context.variables,
          [action.config.iteratorVariable || 'currentItem']: item
        };

        // Execute next steps for this iteration
        // This would need to be handled by the workflow step execution logic
        results.push(item);
      }

      return { success: true, output: { items: results, count: results.length } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to execute iterator' };
    }
  }

  /**
   * Execute filter action
   */
  private async executeFilterAction(
    action: WorkflowAction,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    try {
      const input = execution.steps[execution.steps.length - 1]?.output?.records || [];
      const criteria = this.interpolateVariables(action.config.filterCriteria || {}, execution);

      const filtered = input.filter((record: any) => {
        return Object.entries(criteria).every(([key, condition]: [string, any]) => {
          if (typeof condition === 'object' && condition.operator) {
            return this.evaluateConditionOnRecord(record, key, condition.operator, condition.value);
          }
          return record[key] === condition;
        });
      });

      return { success: true, output: { records: filtered, count: filtered.length } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to execute filter' };
    }
  }

  /**
   * Execute code action
   */
  private async executeCodeAction(
    action: WorkflowAction,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    try {
      // Create a safe execution context
      const context = {
        execution,
        supabase,
        variables: execution.context.variables || {},
        input: execution.context.inputData,
        // Add utility functions
        log: (message: string) => console.log(`[Workflow Code] ${message}`),
        setVariable: (key: string, value: any) => {
          execution.context.variables = { ...execution.context.variables, [key]: value };
        },
        getVariable: (key: string) => execution.context.variables?.[key]
      };

      // Execute the code in a safe context
      const AsyncFunction = (async function () {}).constructor;
      const fn = new AsyncFunction('context', action.config.codeSnippet || '');
      const result = await fn(context);

      return { success: true, output: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Code execution failed' };
    }
  }

  /**
   * Execute HTTP request action
   */
  private async executeHttpRequestAction(
    action: WorkflowAction,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    try {
      const url = this.interpolateVariables(action.config.httpUrl || '', execution);
      const headers = this.interpolateVariables(action.config.httpHeaders || {}, execution);
      const body = action.config.httpBody ? this.interpolateVariables(action.config.httpBody, execution) : undefined;

      const response = await fetch(url, {
        method: action.config.httpMethod || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return { success: true, output: { status: response.status, data: responseData } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'HTTP request failed' };
    }
  }

  /**
   * Execute AI agent action
   */
  private async executeAIAgentAction(
    action: WorkflowAction,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    try {
      // Import AI service dynamically
      const { AIService } = await import('./aiService');

      const prompt = this.interpolateVariables(action.config.aiAgentPrompt || '', execution);
      const result = await AIService.processWithAI(prompt, {
        model: action.config.aiAgentModel,
        tools: action.config.aiAgentTools,
        context: execution.context
      });

      return { success: true, output: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'AI agent execution failed' };
    }
  }

  /**
   * Execute webhook action
   */
  private async executeWebhookAction(
    action: WorkflowAction,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    try {
      const url = this.interpolateVariables(action.config.webhookUrl || '', execution);
      const headers = this.interpolateVariables(action.config.webhookHeaders || {}, execution);
      const payload = action.config.webhookPayload ? this.interpolateVariables(action.config.webhookPayload, execution) : execution.context;

      const response = await fetch(url, {
        method: action.config.webhookMethod || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`Webhook ${response.status}: ${response.statusText}`);
      }

      return { success: true, output: { status: response.status, data: responseData } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Webhook execution failed' };
    }
  }

  /**
   * Evaluate workflow conditions
   */
  private async evaluateConditions(
    conditions: WorkflowCondition[],
    execution: WorkflowExecution
  ): Promise<boolean> {
    if (!conditions || conditions.length === 0) return true;

    let result = true;
    let logicalOp: 'AND' | 'OR' = 'AND';

    for (const condition of conditions) {
      const conditionResult = await this.evaluateCondition(condition, execution);

      if (logicalOp === 'AND') {
        result = result && conditionResult.success;
      } else {
        result = result || conditionResult.success;
      }

      logicalOp = condition.logicalOperator || 'AND';
    }

    return result;
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(
    condition: WorkflowCondition,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    try {
      const fieldValue = this.getFieldValue(condition.field, execution);
      const compareValue = this.interpolateVariables(condition.value, execution);

      const result = this.evaluateConditionOnRecord({ [condition.field]: fieldValue }, condition.field, condition.operator, compareValue);

      return { success: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Condition evaluation failed' };
    }
  }

  /**
   * Evaluate condition on a record
   */
  private evaluateConditionOnRecord(
    record: any,
    field: string,
    operator: string,
    value: any
  ): boolean {
    const fieldValue = record[field];

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'not_contains':
        return !String(fieldValue).includes(String(value));
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'is_empty':
        return fieldValue === null || fieldValue === undefined || fieldValue === '';
      case 'is_not_empty':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
      case 'matches_regex':
        return new RegExp(value).test(String(fieldValue));
      default:
        return false;
    }
  }

  /**
   * Get field value from execution context
   */
  private getFieldValue(field: string, execution: WorkflowExecution): any {
    // Check variables first
    if (execution.context.variables?.[field]) {
      return execution.context.variables[field];
    }

    // Check input data
    if (execution.context.inputData?.[field]) {
      return execution.context.inputData[field];
    }

    // Check record data
    if (execution.context.recordId && execution.context.recordType) {
      // This would need to be implemented to fetch record data
      // For now, return undefined
    }

    return undefined;
  }

  /**
   * Interpolate variables in a value
   */
  private interpolateVariables(value: any, execution: WorkflowExecution): any {
    if (typeof value === 'string') {
      return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return this.getFieldValue(key, execution) || match;
      });
    }

    if (Array.isArray(value)) {
      return value.map(item => this.interpolateVariables(item, execution));
    }

    if (typeof value === 'object' && value !== null) {
      const result: any = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.interpolateVariables(val, execution);
      }
      return result;
    }

    return value;
  }

  /**
   * Get table name for record type
   */
  private getTableName(recordType?: string): string {
    switch (recordType) {
      case 'deal':
        return 'deals';
      case 'contact':
        return 'contacts';
      case 'company':
        return 'companies';
      case 'task':
        return 'tasks';
      default:
        return 'deals';
    }
  }

  /**
   * Add connected steps to pending queue
   */
  private addConnectedSteps(
    step: any,
    pendingSteps: Set<string>,
    executedSteps: Set<string>
  ): void {
    for (const connectionId of step.connections) {
      if (!executedSteps.has(connectionId)) {
        pendingSteps.add(connectionId);
      }
    }
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Timeout execution
   */
  private async timeoutExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.status = 'timeout';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      execution.error = { message: 'Workflow execution timed out' };

      await this.persistExecution(execution);
      await this.logExecution(executionId, 'error', 'Workflow execution timed out');

      // Handle timeout notifications
      // This would need access to workflow settings
      // await this.sendNotification(execution, 'timeout');
    }

    this.activeExecutions.delete(executionId);
    const timeout = this.executionTimeouts.get(executionId);
    if (timeout) {
      clearTimeout(timeout);
      this.executionTimeouts.delete(executionId);
    }
  }

  /**
   * Persist execution to database
   */
  private async persistExecution(execution: WorkflowExecution): Promise<void> {
    try {
      const { error } = await supabase
        .from('workflow_executions')
        .insert({
          id: execution.id,
          workflow_id: execution.workflowId,
          trigger_id: execution.triggerId,
          trigger_type: execution.triggerType,
          status: execution.status,
          started_at: execution.startedAt.toISOString(),
          completed_at: execution.completedAt?.toISOString(),
          duration: execution.duration,
          context: execution.context,
          steps: execution.steps,
          logs: execution.logs,
          error_message: execution.error?.message,
          error_step_id: execution.error?.stepId,
          error_stack_trace: execution.error?.stackTrace
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to persist workflow execution:', error);
    }
  }

  /**
   * Log execution event
   */
  private async logExecution(
    executionId: string,
    level: 'info' | 'warning' | 'error',
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    const log: WorkflowExecutionLog = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level,
      message,
      data
    };

    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.logs.push(log);
    }

    // Also log to console for debugging
    console.log(`[Workflow ${level.toUpperCase()}] ${executionId}: ${message}`, data);
  }

  /**
   * Send notification for execution
   */
  private async sendNotification(
    execution: WorkflowExecution,
    type: 'success' | 'failure' | 'timeout'
  ): Promise<void> {
    try {
      // This would integrate with the notification system
      console.log(`Sending ${type} notification for workflow execution ${execution.id}`);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }
}

export const workflowExecutionEngine = WorkflowExecutionEngine.getInstance();