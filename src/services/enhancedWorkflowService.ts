import { supabase } from './supabaseService';
import {
  Workflow,
  WorkflowExecution,
  WorkflowTrigger,
  WorkflowAction,
  TriggerType,
  ActionType,
  WorkflowAnalytics,
  EmailTemplate,
  WebhookConfiguration,
  AIAgentConfiguration
} from '../types/workflow';
import { workflowExecutionEngine } from './workflowExecutionEngine';

/**
 * Enhanced Workflow Service
 * Manages workflows, executions, templates, and integrations
 */
export class EnhancedWorkflowService {
  private static instance: EnhancedWorkflowService;
  private activeWorkflows: Map<string, Workflow> = new Map();

  static getInstance(): EnhancedWorkflowService {
    if (!EnhancedWorkflowService.instance) {
      EnhancedWorkflowService.instance = new EnhancedWorkflowService();
    }
    return EnhancedWorkflowService.instance;
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workflow | null> {
    try {
      const { data, error } = await supabase
        .from('deal_workflows')
        .insert({
          name: workflow.name,
          description: workflow.description,
          category: workflow.category,
          stages: workflow.steps, // Store steps in stages field for now
          triggers: workflow.triggers,
          settings: workflow.settings,
          metadata: workflow.metadata,
          version: workflow.metadata.version,
          is_active: workflow.settings.isActive
        })
        .select()
        .single();

      if (error) throw error;

      const newWorkflow: Workflow = {
        ...workflow,
        id: data.id,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      // Cache the workflow
      this.activeWorkflows.set(newWorkflow.id, newWorkflow);

      return newWorkflow;
    } catch (error) {
      console.error('Error creating workflow:', error);
      return null;
    }
  }

  /**
   * Get workflow by ID
   */
  async getWorkflowById(id: string): Promise<Workflow | null> {
    try {
      // Check cache first
      if (this.activeWorkflows.has(id)) {
        return this.activeWorkflows.get(id)!;
      }

      const { data, error } = await supabase
        .from('deal_workflows')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const workflow: Workflow = {
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category || 'custom',
        steps: data.stages || [],
        triggers: data.triggers || [],
        actions: [], // Would need separate table for complex actions
        settings: data.settings || {
          isActive: data.is_active,
          priority: 'medium',
          maxExecutionTime: 3600,
          retryPolicy: { enabled: true, maxRetries: 3, retryDelay: 300 },
          notifications: { onSuccess: false, onFailure: true, onTimeout: true }
        },
        metadata: data.metadata || {
          version: data.version || 1,
          lastModified: new Date(data.updated_at),
          createdBy: data.created_by,
          usageCount: 0,
          successRate: 0,
          averageExecutionTime: 0
        },
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      // Cache the workflow
      this.activeWorkflows.set(workflow.id, workflow);

      return workflow;
    } catch (error) {
      console.error('Error fetching workflow:', error);
      return null;
    }
  }

  /**
   * Get all workflows
   */
  async getAllWorkflows(category?: string): Promise<Workflow[]> {
    try {
      let query = supabase
        .from('deal_workflows')
        .select('*')
        .order('name');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;

      const workflows: Workflow[] = data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category || 'custom',
        steps: item.stages || [],
        triggers: item.triggers || [],
        actions: [],
        settings: item.settings || {
          isActive: item.is_active,
          priority: 'medium',
          maxExecutionTime: 3600,
          retryPolicy: { enabled: true, maxRetries: 3, retryDelay: 300 },
          notifications: { onSuccess: false, onFailure: true, onTimeout: true }
        },
        metadata: item.metadata || {
          version: item.version || 1,
          lastModified: new Date(item.updated_at),
          createdBy: item.created_by,
          usageCount: 0,
          successRate: 0,
          averageExecutionTime: 0
        },
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at)
      }));

      // Cache workflows
      workflows.forEach(workflow => {
        this.activeWorkflows.set(workflow.id, workflow);
      });

      return workflows;
    } catch (error) {
      console.error('Error fetching workflows:', error);
      return [];
    }
  }

  /**
   * Update workflow
   */
  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<boolean> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.description) updateData.description = updates.description;
      if (updates.category) updateData.category = updates.category;
      if (updates.steps) updateData.stages = updates.steps;
      if (updates.triggers) updateData.triggers = updates.triggers;
      if (updates.settings) {
        updateData.settings = updates.settings;
        updateData.is_active = updates.settings.isActive;
      }
      if (updates.metadata) {
        updateData.metadata = updates.metadata;
        updateData.version = updates.metadata.version;
      }

      const { error } = await supabase
        .from('deal_workflows')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Update cache
      const existing = this.activeWorkflows.get(id);
      if (existing) {
        const updated = { ...existing, ...updates, updatedAt: new Date() };
        this.activeWorkflows.set(id, updated);
      }

      return true;
    } catch (error) {
      console.error('Error updating workflow:', error);
      return false;
    }
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('deal_workflows')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remove from cache
      this.activeWorkflows.delete(id);

      return true;
    } catch (error) {
      console.error('Error deleting workflow:', error);
      return false;
    }
  }

  /**
   * Execute workflow by trigger
   */
  async executeWorkflowByTrigger(
    triggerType: TriggerType,
    context: {
      recordId?: string;
      recordType?: string;
      userId?: string;
      inputData?: Record<string, any>;
      triggerData?: any;
    }
  ): Promise<WorkflowExecution[]> {
    const executions: WorkflowExecution[] = [];

    try {
      // Find workflows that have matching triggers
      const workflows = Array.from(this.activeWorkflows.values()).filter(workflow =>
        workflow.settings.isActive &&
        workflow.triggers.some(trigger =>
          trigger.type === triggerType && trigger.isActive
        )
      );

      // Execute each matching workflow
      for (const workflow of workflows) {
        const trigger = workflow.triggers.find(t => t.type === triggerType && t.isActive);
        if (!trigger) continue;

        try {
          const execution = await workflowExecutionEngine.executeWorkflow(workflow, trigger, context);
          executions.push(execution);

          // Update workflow analytics
          await this.updateWorkflowAnalytics(workflow.id, execution);
        } catch (error) {
          console.error(`Error executing workflow ${workflow.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error executing workflows by trigger:', error);
    }

    return executions;
  }

  /**
   * Execute specific workflow manually
   */
  async executeWorkflow(
    workflowId: string,
    context: {
      recordId?: string;
      recordType?: string;
      userId?: string;
      inputData?: Record<string, any>;
    }
  ): Promise<WorkflowExecution | null> {
    try {
      const workflow = await this.getWorkflowById(workflowId);
      if (!workflow || !workflow.settings.isActive) return null;

      // Create a manual trigger
      const trigger: WorkflowTrigger = {
        id: `manual_${Date.now()}`,
        type: 'manual',
        name: 'Manual Execution',
        description: 'Workflow executed manually',
        config: {},
        isActive: true
      };

      const execution = await workflowExecutionEngine.executeWorkflow(workflow, trigger, context);

      // Update workflow analytics
      await this.updateWorkflowAnalytics(workflowId, execution);

      return execution;
    } catch (error) {
      console.error('Error executing workflow:', error);
      return null;
    }
  }

  /**
   * Get workflow executions
   */
  async getWorkflowExecutions(workflowId?: string, limit = 50): Promise<WorkflowExecution[]> {
    try {
      let query = supabase
        .from('workflow_executions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (workflowId) {
        query = query.eq('workflow_id', workflowId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map(item => ({
        id: item.id,
        workflowId: item.workflow_id,
        triggerId: item.trigger_id,
        triggerType: item.trigger_type as TriggerType,
        status: item.status,
        startedAt: new Date(item.started_at),
        completedAt: item.completed_at ? new Date(item.completed_at) : undefined,
        duration: item.duration,
        context: item.context || {},
        steps: item.steps || [],
        logs: item.logs || [],
        error: item.error_message ? {
          message: item.error_message,
          stepId: item.error_step_id,
          stackTrace: item.error_stack_trace
        } : undefined
      }));
    } catch (error) {
      console.error('Error fetching workflow executions:', error);
      return [];
    }
  }

  /**
   * Update workflow analytics
   */
  private async updateWorkflowAnalytics(workflowId: string, execution: WorkflowExecution): Promise<void> {
    try {
      // Get current analytics
      const { data: current } = await supabase
        .from('workflow_analytics')
        .select('*')
        .eq('workflow_id', workflowId)
        .single();

      const analytics: WorkflowAnalytics = current ? {
        workflowId,
        totalExecutions: current.total_executions + 1,
        successfulExecutions: current.successful_executions + (execution.status === 'completed' ? 1 : 0),
        failedExecutions: current.failed_executions + (execution.status === 'failed' ? 1 : 0),
        averageExecutionTime: execution.duration
          ? Math.round(((current.average_execution_time * current.total_executions) + execution.duration) / (current.total_executions + 1))
          : current.average_execution_time,
        stepPerformance: current.step_performance || {},
        triggerFrequency: current.trigger_frequency || {},
        actionFrequency: current.action_frequency || {},
        lastUpdated: new Date()
      } : {
        workflowId,
        totalExecutions: 1,
        successfulExecutions: execution.status === 'completed' ? 1 : 0,
        failedExecutions: execution.status === 'failed' ? 1 : 0,
        averageExecutionTime: execution.duration || 0,
        stepPerformance: {},
        triggerFrequency: { [execution.triggerType]: 1 },
        actionFrequency: {},
        lastUpdated: new Date()
      };

      // Update trigger frequency
      analytics.triggerFrequency[execution.triggerType] =
        (analytics.triggerFrequency[execution.triggerType] || 0) + 1;

      // Upsert analytics
      await supabase
        .from('workflow_analytics')
        .upsert({
          workflow_id: workflowId,
          total_executions: analytics.totalExecutions,
          successful_executions: analytics.successfulExecutions,
          failed_executions: analytics.failedExecutions,
          average_execution_time: analytics.averageExecutionTime,
          step_performance: analytics.stepPerformance,
          trigger_frequency: analytics.triggerFrequency,
          action_frequency: analytics.actionFrequency,
          last_updated: analytics.lastUpdated.toISOString()
        }, { onConflict: 'workflow_id' });

    } catch (error) {
      console.error('Error updating workflow analytics:', error);
    }
  }

  /**
   * Email Templates Management
   */
  async createEmailTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          name: template.name,
          description: template.description,
          subject: template.subject,
          body: template.body,
          variables: template.variables,
          category: template.category,
          is_active: template.isActive
        })
        .select()
        .single();

      if (error) throw error;

      return {
        ...template,
        id: data.id,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      console.error('Error creating email template:', error);
      return null;
    }
  }

  async getEmailTemplates(category?: string): Promise<EmailTemplate[]> {
    try {
      let query = supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map(item => ({
        ...item,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at)
      }));
    } catch (error) {
      console.error('Error fetching email templates:', error);
      return [];
    }
  }

  /**
   * Webhook Configurations Management
   */
  async createWebhookConfig(config: Omit<WebhookConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebhookConfiguration | null> {
    try {
      const { data, error } = await supabase
        .from('webhook_configurations')
        .insert({
          name: config.name,
          url: config.url,
          method: config.method,
          headers: config.headers,
          secret: config.secret,
          events: config.events,
          is_active: config.isActive,
          retry_policy: config.retryPolicy
        })
        .select()
        .single();

      if (error) throw error;

      return {
        ...config,
        id: data.id,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      console.error('Error creating webhook configuration:', error);
      return null;
    }
  }

  async getWebhookConfigs(): Promise<WebhookConfiguration[]> {
    try {
      const { data, error } = await supabase
        .from('webhook_configurations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      return data.map(item => ({
        ...item,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at)
      }));
    } catch (error) {
      console.error('Error fetching webhook configurations:', error);
      return [];
    }
  }

  /**
   * AI Agent Configurations Management
   */
  async createAIAgentConfig(config: Omit<AIAgentConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<AIAgentConfiguration | null> {
    try {
      const { data, error } = await supabase
        .from('ai_agent_configurations')
        .insert({
          name: config.name,
          description: config.description,
          model: config.model,
          prompt: config.prompt,
          tools: config.tools,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          context_window: config.contextWindow,
          is_active: config.isActive
        })
        .select()
        .single();

      if (error) throw error;

      return {
        ...config,
        id: data.id,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      console.error('Error creating AI agent configuration:', error);
      return null;
    }
  }

  async getAIAgentConfigs(): Promise<AIAgentConfiguration[]> {
    try {
      const { data, error } = await supabase
        .from('ai_agent_configurations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      return data.map(item => ({
        ...item,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at)
      }));
    } catch (error) {
      console.error('Error fetching AI agent configurations:', error);
      return [];
    }
  }

  /**
   * Trigger webhooks for workflow events
   */
  async triggerWebhooks(eventType: string, payload: any): Promise<void> {
    try {
      const webhooks = await this.getWebhookConfigs();
      const matchingWebhooks = webhooks.filter(webhook =>
        webhook.events.includes(eventType) || webhook.events.includes('*')
      );

      for (const webhook of matchingWebhooks) {
        try {
          const response = await fetch(webhook.url, {
            method: webhook.method,
            headers: {
              'Content-Type': 'application/json',
              ...webhook.headers
            },
            body: JSON.stringify({
              event: eventType,
              timestamp: new Date().toISOString(),
              ...payload
            })
          });

          if (!response.ok) {
            console.error(`Webhook ${webhook.id} failed: ${response.status}`);
          }
        } catch (error) {
          console.error(`Error triggering webhook ${webhook.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error triggering webhooks:', error);
    }
  }

  /**
   * Clear workflow cache (useful after updates)
   */
  clearCache(): void {
    this.activeWorkflows.clear();
  }

  /**
   * Get workflow analytics
   */
  async getWorkflowAnalytics(workflowId: string): Promise<WorkflowAnalytics | null> {
    try {
      const { data, error } = await supabase
        .from('workflow_analytics')
        .select('*')
        .eq('workflow_id', workflowId)
        .single();

      if (error) throw error;

      return {
        workflowId: data.workflow_id,
        totalExecutions: data.total_executions,
        successfulExecutions: data.successful_executions,
        failedExecutions: data.failed_executions,
        averageExecutionTime: data.average_execution_time,
        stepPerformance: data.step_performance || {},
        triggerFrequency: data.trigger_frequency || {},
        actionFrequency: data.action_frequency || {},
        lastUpdated: new Date(data.last_updated)
      };
    } catch (error) {
      console.error('Error fetching workflow analytics:', error);
      return null;
    }
  }
}

export const enhancedWorkflowService = EnhancedWorkflowService.getInstance();