import { supabase } from './supabaseService';
import {
  SLAPolicy,
  SLAInstance,
  SLANotification,
  WorkflowAction
} from '../types/workflow';
import { workflowExecutionEngine } from './workflowExecutionEngine';

/**
 * SLA Monitoring Service
 * Tracks service level agreements and triggers actions on breaches
 */
export class SLAMonitoringService {
  private static instance: SLAMonitoringService;
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  static getInstance(): SLAMonitoringService {
    if (!SLAMonitoringService.instance) {
      SLAMonitoringService.instance = new SLAMonitoringService();
    }
    return SLAMonitoringService.instance;
  }

  /**
   * Start SLA monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('Starting SLA monitoring service');

    // Check SLA instances every minute
    this.monitoringInterval = setInterval(() => {
      this.checkSLAInstances();
    }, 60 * 1000);
  }

  /**
   * Stop SLA monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    console.log('Stopped SLA monitoring service');
  }

  /**
   * Create SLA policy
   */
  async createSLAPolicy(policy: Omit<SLAPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<SLAPolicy | null> {
    try {
      const { data, error } = await supabase
        .from('sla_policies')
        .insert({
          name: policy.name,
          description: policy.description,
          record_type: policy.recordType,
          conditions: policy.conditions,
          metrics: policy.metrics,
          actions: policy.actions,
          is_active: policy.isActive
        })
        .select()
        .single();

      if (error) throw error;

      return {
        ...data,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      console.error('Error creating SLA policy:', error);
      return null;
    }
  }

  /**
   * Get all SLA policies
   */
  async getSLAPolicies(): Promise<SLAPolicy[]> {
    try {
      const { data, error } = await supabase
        .from('sla_policies')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      return data.map(policy => ({
        ...policy,
        createdAt: new Date(policy.created_at),
        updatedAt: new Date(policy.updated_at)
      }));
    } catch (error) {
      console.error('Error fetching SLA policies:', error);
      return [];
    }
  }

  /**
   * Update SLA policy
   */
  async updateSLAPolicy(id: string, updates: Partial<SLAPolicy>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sla_policies')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating SLA policy:', error);
      return false;
    }
  }

  /**
   * Delete SLA policy
   */
  async deleteSLAPolicy(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sla_policies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting SLA policy:', error);
      return false;
    }
  }

  /**
   * Start SLA tracking for a record
   */
  async startSLATracking(
    policyId: string,
    recordId: string,
    recordType: string,
    customTarget?: Date
  ): Promise<SLAInstance | null> {
    try {
      const policy = await this.getSLAPolicyById(policyId);
      if (!policy) return null;

      // Calculate target time based on policy metrics
      const targetAt = customTarget || this.calculateTargetTime(policy);

      const { data, error } = await supabase
        .from('sla_instances')
        .insert({
          policy_id: policyId,
          record_id: recordId,
          record_type: recordType,
          target_at: targetAt.toISOString(),
          status: 'active',
          current_value: 0,
          notifications: []
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`Started SLA tracking for ${recordType} ${recordId} with target ${targetAt.toISOString()}`);

      return {
        ...data,
        startedAt: new Date(data.started_at),
        targetAt: new Date(data.target_at),
        completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
        lastChecked: new Date(data.last_checked),
        notifications: data.notifications || []
      };
    } catch (error) {
      console.error('Error starting SLA tracking:', error);
      return null;
    }
  }

  /**
   * Complete SLA tracking
   */
  async completeSLATracking(recordId: string, recordType: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sla_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('record_id', recordId)
        .eq('record_type', recordType)
        .eq('status', 'active');

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error completing SLA tracking:', error);
      return false;
    }
  }

  /**
   * Check SLA instances and trigger actions if needed
   */
  private async checkSLAInstances(): Promise<void> {
    try {
      const { data: instances, error } = await supabase
        .from('sla_instances')
        .select(`
          *,
          sla_policies (
            name,
            metrics,
            actions
          )
        `)
        .eq('status', 'active');

      if (error) throw error;

      const now = new Date();

      for (const instance of instances) {
        const targetAt = new Date(instance.target_at);
        const currentValue = Math.floor((now.getTime() - new Date(instance.started_at).getTime()) / (1000 * 60)); // minutes

        // Update current value
        await supabase
          .from('sla_instances')
          .update({
            current_value: currentValue,
            last_checked: now.toISOString()
          })
          .eq('id', instance.id);

        const policy = instance.sla_policies as any;
        const metrics = policy.metrics;
        const actions = policy.actions;

        // Check if warning threshold is reached
        const warningThreshold = (metrics.target * (metrics.warningThreshold / 100));
        if (currentValue >= warningThreshold && !this.hasNotificationType(instance.notifications, 'warning')) {
          await this.triggerSLAActions(instance, actions.onWarning || [], 'warning');
        }

        // Check if breach threshold is reached
        const criticalThreshold = (metrics.target * (metrics.criticalThreshold / 100));
        if (currentValue >= criticalThreshold && !this.hasNotificationType(instance.notifications, 'breach')) {
          await this.triggerSLAActions(instance, actions.onBreach || [], 'breach');

          // Mark as breached
          await supabase
            .from('sla_instances')
            .update({ status: 'breached' })
            .eq('id', instance.id);
        }
      }
    } catch (error) {
      console.error('Error checking SLA instances:', error);
    }
  }

  /**
   * Trigger SLA actions
   */
  private async triggerSLAActions(
    instance: any,
    actions: WorkflowAction[],
    type: 'warning' | 'breach' | 'recovery'
  ): Promise<void> {
    try {
      // Record notification
      const notification: SLANotification = {
        id: crypto.randomUUID(),
        type,
        sentAt: new Date(),
        recipients: [], // Would be populated based on policy
        message: `${type.toUpperCase()}: SLA ${type} for ${instance.record_type} ${instance.record_id}`
      };

      const updatedNotifications = [...(instance.notifications || []), notification];

      await supabase
        .from('sla_instances')
        .update({ notifications: updatedNotifications })
        .eq('id', instance.id);

      // Execute actions
      for (const action of actions) {
        try {
          // Create a workflow execution context for the action
          const executionContext = {
            recordId: instance.record_id,
            recordType: instance.record_type,
            inputData: {
              slaInstance: instance,
              notificationType: type,
              currentValue: instance.current_value,
              targetValue: instance.sla_policies.metrics.target
            }
          };

          // Execute action directly (simplified - in production would use full workflow engine)
          await this.executeSLAAction(action, executionContext);
        } catch (error) {
          console.error(`Error executing SLA ${type} action:`, error);
        }
      }

      console.log(`Triggered ${type} actions for SLA instance ${instance.id}`);
    } catch (error) {
      console.error('Error triggering SLA actions:', error);
    }
  }

  /**
   * Execute SLA action (simplified version)
   */
  private async executeSLAAction(action: WorkflowAction, context: any): Promise<void> {
    switch (action.type) {
      case 'send_email':
        await this.executeSLAEmailAction(action, context);
        break;
      case 'notification':
        await this.executeSLANotificationAction(action, context);
        break;
      case 'webhook':
        await this.executeSLAWebhookAction(action, context);
        break;
      default:
        console.log(`SLA action type ${action.type} not implemented`);
    }
  }

  /**
   * Execute SLA email action
   */
  private async executeSLAEmailAction(action: WorkflowAction, context: any): Promise<void> {
    try {
      const { EmailService } = await import('./emailService');

      const recipients = action.config.recipients || [];
      const subject = this.interpolateSLAVariables(action.config.subject || 'SLA Alert', context);
      const body = this.interpolateSLAVariables(action.config.body || 'SLA condition met', context);

      await EmailService.sendEmail({
        to: recipients,
        subject,
        body
      });
    } catch (error) {
      console.error('Error sending SLA email:', error);
    }
  }

  /**
   * Execute SLA notification action
   */
  private async executeSLANotificationAction(action: WorkflowAction, context: any): Promise<void> {
    try {
      const message = this.interpolateSLAVariables(action.config.notificationMessage || 'SLA alert', context);

      // In a real implementation, this would integrate with the notification system
      console.log(`SLA Notification: ${message}`);
    } catch (error) {
      console.error('Error sending SLA notification:', error);
    }
  }

  /**
   * Execute SLA webhook action
   */
  private async executeSLAWebhookAction(action: WorkflowAction, context: any): Promise<void> {
    try {
      const url = action.config.webhookUrl;
      const payload = {
        ...context,
        timestamp: new Date().toISOString(),
        alertType: 'sla'
      };

      await fetch(url, {
        method: action.config.webhookMethod || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...action.config.webhookHeaders
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Error sending SLA webhook:', error);
    }
  }

  /**
   * Interpolate SLA variables in text
   */
  private interpolateSLAVariables(text: string, context: any): string {
    return text
      .replace(/\{\{recordType\}\}/g, context.recordType)
      .replace(/\{\{recordId\}\}/g, context.recordId)
      .replace(/\{\{currentValue\}\}/g, context.currentValue)
      .replace(/\{\{targetValue\}\}/g, context.targetValue)
      .replace(/\{\{notificationType\}\}/g, context.notificationType);
  }

  /**
   * Check if notification type already exists
   */
  private hasNotificationType(notifications: SLANotification[], type: string): boolean {
    return notifications.some(n => n.type === type);
  }

  /**
   * Calculate target time based on policy
   */
  private calculateTargetTime(policy: SLAPolicy): Date {
    const now = new Date();
    const metrics = policy.metrics;

    let milliseconds = 0;

    switch (metrics.unit) {
      case 'minutes':
        milliseconds = metrics.target * 60 * 1000;
        break;
      case 'hours':
        milliseconds = metrics.target * 60 * 60 * 1000;
        break;
      case 'days':
        milliseconds = metrics.target * 24 * 60 * 60 * 1000;
        break;
    }

    return new Date(now.getTime() + milliseconds);
  }

  /**
   * Get SLA policy by ID
   */
  private async getSLAPolicyById(id: string): Promise<SLAPolicy | null> {
    try {
      const { data, error } = await supabase
        .from('sla_policies')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        ...data,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      console.error('Error fetching SLA policy:', error);
      return null;
    }
  }

  /**
   * Get active SLA instances for a record
   */
  async getActiveSLAInstances(recordId: string, recordType: string): Promise<SLAInstance[]> {
    try {
      const { data, error } = await supabase
        .from('sla_instances')
        .select('*')
        .eq('record_id', recordId)
        .eq('record_type', recordType)
        .eq('status', 'active');

      if (error) throw error;

      return data.map(instance => ({
        ...instance,
        startedAt: new Date(instance.started_at),
        targetAt: new Date(instance.target_at),
        completedAt: instance.completed_at ? new Date(instance.completed_at) : undefined,
        lastChecked: new Date(instance.last_checked),
        notifications: instance.notifications || []
      }));
    } catch (error) {
      console.error('Error fetching active SLA instances:', error);
      return [];
    }
  }
}

export const slaMonitoringService = SLAMonitoringService.getInstance();