import { supabase } from './supabaseService';
import {
  WorkflowTrigger,
  TriggerType,
  Workflow
} from '../types/workflow';
import { enhancedWorkflowService } from './enhancedWorkflowService';

/**
 * Workflow Trigger Service
 * Handles different trigger types and executes workflows accordingly
 */
export class WorkflowTriggerService {
  private static instance: WorkflowTriggerService;
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private webhookListeners: Map<string, any> = new Map();

  static getInstance(): WorkflowTriggerService {
    if (!WorkflowTriggerService.instance) {
      WorkflowTriggerService.instance = new WorkflowTriggerService();
    }
    return WorkflowTriggerService.instance;
  }

  /**
   * Initialize trigger service
   */
  async initialize(): Promise<void> {
    console.log('Initializing workflow trigger service');

    // Load and schedule recurring triggers
    await this.loadScheduledTriggers();

    // Set up webhook listeners
    await this.setupWebhookListeners();

    // Set up database triggers for record events
    await this.setupDatabaseTriggers();
  }

  /**
   * Handle record created event
   */
  async handleRecordCreated(recordType: string, recordId: string, recordData: any): Promise<void> {
    const context = {
      recordId,
      recordType,
      inputData: recordData
    };

    await enhancedWorkflowService.executeWorkflowByTrigger('record_created', context);
  }

  /**
   * Handle record updated event
   */
  async handleRecordUpdated(recordType: string, recordId: string, oldData: any, newData: any): Promise<void> {
    const context = {
      recordId,
      recordType,
      inputData: { oldData, newData, changes: this.getChanges(oldData, newData) }
    };

    await enhancedWorkflowService.executeWorkflowByTrigger('record_updated', context);

    // Check for field-specific triggers
    await this.handleFieldChangedTriggers(recordType, recordId, oldData, newData);

    // Check for stage change triggers
    if (recordType === 'deal' && oldData.stage !== newData.stage) {
      await this.handleStageChanged(recordType, recordId, oldData.stage, newData.stage, newData);
    }
  }

  /**
   * Handle record deleted event
   */
  async handleRecordDeleted(recordType: string, recordId: string, recordData: any): Promise<void> {
    const context = {
      recordId,
      recordType,
      inputData: recordData
    };

    await enhancedWorkflowService.executeWorkflowByTrigger('record_deleted', context);
  }

  /**
   * Handle stage changed event
   */
  async handleStageChanged(
    recordType: string,
    recordId: string,
    fromStage: string,
    toStage: string,
    recordData: any
  ): Promise<void> {
    const context = {
      recordId,
      recordType,
      inputData: { fromStage, toStage, recordData }
    };

    await enhancedWorkflowService.executeWorkflowByTrigger('stage_changed', context);
  }

  /**
   * Handle field changed triggers
   */
  private async handleFieldChangedTriggers(
    recordType: string,
    recordId: string,
    oldData: any,
    newData: any
  ): Promise<void> {
    const changes = this.getChanges(oldData, newData);

    for (const [fieldName, change] of Object.entries(changes)) {
      const context = {
        recordId,
        recordType,
        inputData: {
          fieldName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          recordData: newData
        },
        triggerData: { fieldName, ...change }
      };

      await enhancedWorkflowService.executeWorkflowByTrigger('field_changed', context);
    }
  }

  /**
   * Handle manual trigger execution
   */
  async handleManualTrigger(
    workflowId: string,
    context: {
      recordId?: string;
      recordType?: string;
      userId?: string;
      inputData?: Record<string, any>;
    }
  ): Promise<void> {
    await enhancedWorkflowService.executeWorkflow(workflowId, context);
  }

  /**
   * Handle webhook trigger
   */
  async handleWebhookTrigger(webhookId: string, payload: any, headers?: Record<string, string>): Promise<void> {
    try {
      // Verify webhook if secret is configured
      const webhooks = await enhancedWorkflowService.getWebhookConfigs();
      const webhook = webhooks.find(w => w.id === webhookId);

      if (!webhook) {
        console.error(`Webhook ${webhookId} not found`);
        return;
      }

      // Verify signature if secret exists
      if (webhook.secret && headers) {
        const signature = headers['x-signature'] || headers['x-hub-signature'];
        if (!this.verifyWebhookSignature(payload, signature, webhook.secret)) {
          console.error(`Webhook signature verification failed for ${webhookId}`);
          return;
        }
      }

      const context = {
        inputData: payload,
        triggerData: { webhookId, headers }
      };

      await enhancedWorkflowService.executeWorkflowByTrigger('webhook', context);
    } catch (error) {
      console.error('Error handling webhook trigger:', error);
    }
  }

  /**
   * Handle SLA breach trigger
   */
  async handleSLABreach(
    recordId: string,
    recordType: string,
    slaType: string,
    breachData: any
  ): Promise<void> {
    const context = {
      recordId,
      recordType,
      inputData: { slaType, ...breachData },
      triggerData: { slaType, breachData }
    };

    await enhancedWorkflowService.executeWorkflowByTrigger('sla_breach', context);
  }

  /**
   * Handle milestone reached trigger
   */
  async handleMilestoneReached(
    recordId: string,
    recordType: string,
    milestoneType: string,
    milestoneData: any
  ): Promise<void> {
    const context = {
      recordId,
      recordType,
      inputData: { milestoneType, ...milestoneData },
      triggerData: { milestoneType, milestoneData }
    };

    await enhancedWorkflowService.executeWorkflowByTrigger('milestone_reached', context);
  }

  /**
   * Load and schedule recurring triggers
   */
  private async loadScheduledTriggers(): Promise<void> {
    try {
      const { data: scheduledTriggers, error } = await supabase
        .from('scheduled_triggers')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      for (const trigger of scheduledTriggers) {
        await this.scheduleTrigger(trigger);
      }

      console.log(`Loaded ${scheduledTriggers.length} scheduled triggers`);
    } catch (error) {
      console.error('Error loading scheduled triggers:', error);
    }
  }

  /**
   * Schedule a trigger
   */
  private async scheduleTrigger(triggerData: any): Promise<void> {
    const schedule = triggerData.schedule_config;

    if (schedule.frequency === 'custom' && schedule.cronExpression) {
      // For cron expressions, we'd need a cron library
      // For now, handle simple schedules
      this.scheduleSimpleTrigger(triggerData.id, schedule);
    } else {
      this.scheduleSimpleTrigger(triggerData.id, schedule);
    }
  }

  /**
   * Schedule simple triggers (daily, weekly)
   */
  private scheduleSimpleTrigger(triggerId: string, schedule: any): void {
    const now = new Date();
    let nextRun: Date;

    switch (schedule.frequency) {
      case 'daily':
        nextRun = new Date(now);
        nextRun.setHours(schedule.time ? parseInt(schedule.time.split(':')[0]) : 9, 0, 0, 0);
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;

      case 'weekly':
        nextRun = new Date(now);
        const targetDay = schedule.daysOfWeek?.[0] ?? 1; // Monday default
        const daysUntilTarget = (targetDay - now.getDay() + 7) % 7;
        nextRun.setDate(now.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
        nextRun.setHours(schedule.time ? parseInt(schedule.time.split(':')[0]) : 9, 0, 0, 0);
        break;

      default:
        console.warn(`Unsupported schedule frequency: ${schedule.frequency}`);
        return;
    }

    const delay = nextRun.getTime() - now.getTime();

    const timeout = setTimeout(async () => {
      await this.executeScheduledTrigger(triggerId);
      // Reschedule for next occurrence
      this.scheduleSimpleTrigger(triggerId, schedule);
    }, delay);

    this.scheduledJobs.set(triggerId, timeout);

    console.log(`Scheduled trigger ${triggerId} for ${nextRun.toISOString()}`);
  }

  /**
   * Execute scheduled trigger
   */
  private async executeScheduledTrigger(triggerId: string): Promise<void> {
    try {
      const { data: trigger, error } = await supabase
        .from('scheduled_triggers')
        .select('*')
        .eq('id', triggerId)
        .single();

      if (error || !trigger) {
        console.error(`Scheduled trigger ${triggerId} not found`);
        return;
      }

      // Update last run
      await supabase
        .from('scheduled_triggers')
        .update({ last_run: new Date().toISOString() })
        .eq('id', triggerId);

      const context = {
        inputData: { scheduledTriggerId: triggerId, scheduleConfig: trigger.schedule_config },
        triggerData: trigger
      };

      await enhancedWorkflowService.executeWorkflowByTrigger('scheduled', context);
    } catch (error) {
      console.error(`Error executing scheduled trigger ${triggerId}:`, error);
    }
  }

  /**
   * Setup webhook listeners
   */
  private async setupWebhookListeners(): Promise<void> {
    const webhooks = await enhancedWorkflowService.getWebhookConfigs();

    for (const webhook of webhooks) {
      // In a real implementation, this would set up HTTP endpoints
      // For now, we'll store the webhook configurations
      this.webhookListeners.set(webhook.id, webhook);
    }

    console.log(`Setup ${webhooks.length} webhook listeners`);
  }

  /**
   * Setup database triggers for record events
   */
  private async setupDatabaseTriggers(): Promise<void> {
    // In a real implementation, this would set up database triggers
    // For Supabase, we might use Edge Functions or webhooks
    // For now, this is handled by manual event triggering in the application
    console.log('Database triggers setup (manual event handling)');
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(payload: any, signature: string | undefined, secret: string): boolean {
    if (!signature) return false;

    // Simple HMAC verification (in production, use proper crypto)
    // This is a placeholder - implement proper signature verification
    return true;
  }

  /**
   * Get changes between old and new data
   */
  private getChanges(oldData: any, newData: any): Record<string, { oldValue: any; newValue: any }> {
    const changes: Record<string, { oldValue: any; newValue: any }> = {};

    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);

    for (const key of allKeys) {
      const oldValue = oldData?.[key];
      const newValue = newData?.[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = { oldValue, newValue };
      }
    }

    return changes;
  }

  /**
   * Cleanup scheduled jobs
   */
  cleanup(): void {
    for (const timeout of this.scheduledJobs.values()) {
      clearTimeout(timeout);
    }
    this.scheduledJobs.clear();
    this.webhookListeners.clear();
  }
}

export const workflowTriggerService = WorkflowTriggerService.getInstance();