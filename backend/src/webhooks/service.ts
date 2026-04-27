import crypto from 'crypto';
import axios from 'axios';
import { supabase } from './database';

interface Webhook {
  id: string;
  workspaceId: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  failureCount: number;
}

export class WebhookService {
  static async createWebhook(input: any, context: any): Promise<Webhook> {
    const webhookData = {
      workspace_id: context.workspaceId,
      name: input.name,
      url: input.url,
      events: input.events,
      secret: input.secret || crypto.randomBytes(32).toString('hex'),
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const { data, error } = await supabase
      .from('webhooks')
      .insert(webhookData)
      .select()
      .single();

    if (error) {
      console.error('Error creating webhook:', error);
      throw new Error('Failed to create webhook');
    }

    return this.formatWebhook(data);
  }

  static async updateWebhook(id: string, input: any, context: any): Promise<Webhook> {
    const updates = {
      ...input,
      updated_at: new Date(),
    };

    const { data, error } = await supabase
      .from('webhooks')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating webhook:', error);
      throw new Error('Failed to update webhook');
    }

    return this.formatWebhook(data);
  }

  static async deleteWebhook(id: string, context: any): Promise<boolean> {
    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id)
      .eq('workspace_id', context.workspaceId);

    if (error) {
      console.error('Error deleting webhook:', error);
      return false;
    }

    return true;
  }

  static async getWebhooks(context: any): Promise<Webhook[]> {
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('workspace_id', context.workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching webhooks:', error);
      throw new Error('Failed to fetch webhooks');
    }

    return data.map(this.formatWebhook);
  }

  static async testWebhook(id: string, context: any) {
    const webhook = await this.getWebhookById(id, context);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook',
        webhookId: id,
      },
    };

    try {
      const signature = this.generateSignature(JSON.stringify(testPayload), webhook.secret);

      const response = await axios.post(webhook.url, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': 'test',
          'X-Webhook-ID': id,
        },
        timeout: 10000, // 10 seconds timeout
      });

      return {
        success: true,
        statusCode: response.status,
        response: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        statusCode: error.response?.status,
        error: error.message,
      };
    }
  }

  static async triggerWebhooks(event: string, data: any, context: any) {
    const webhooks = await this.getActiveWebhooksForEvent(event, context);

    const results = await Promise.allSettled(
      webhooks.map(async (webhook) => {
        try {
          await this.sendWebhook(webhook, event, data);
          await this.updateWebhookLastTriggered(webhook.id);
          return { webhookId: webhook.id, success: true };
        } catch (error) {
          await this.incrementWebhookFailureCount(webhook.id);
          return { webhookId: webhook.id, success: false, error: error.message };
        }
      })
    );

    return results;
  }

  private static async sendWebhook(webhook: Webhook, event: string, data: any) {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const signature = this.generateSignature(JSON.stringify(payload), webhook.secret);

    await axios.post(webhook.url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        'X-Webhook-ID': webhook.id,
      },
      timeout: 30000, // 30 seconds timeout
    });
  }

  private static async getActiveWebhooksForEvent(event: string, context: any): Promise<Webhook[]> {
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('workspace_id', context.workspaceId)
      .eq('is_active', true)
      .contains('events', [event]);

    if (error) {
      console.error('Error fetching active webhooks:', error);
      return [];
    }

    return data.map(this.formatWebhook);
  }

  static async getWebhookById(id: string, context?: any): Promise<Webhook | null> {
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single();

    if (error) {
      console.error('Error fetching webhook:', error);
      return null;
    }

    return this.formatWebhook(data);
  }

  private static async updateWebhookLastTriggered(id: string) {
    await supabase
      .from('webhooks')
      .update({
        last_triggered: new Date(),
        failure_count: 0, // Reset failure count on success
      })
      .eq('id', id);
  }

  private static async incrementWebhookFailureCount(id: string) {
    await supabase.rpc('increment_webhook_failure', { webhook_id: id });
  }

  static generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
  }

  private static formatWebhook(data: any): Webhook {
    return {
      id: data.id,
      workspaceId: data.workspace_id,
      name: data.name,
      url: data.url,
      events: data.events,
      secret: data.secret,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      lastTriggered: data.last_triggered ? new Date(data.last_triggered) : undefined,
      failureCount: data.failure_count,
    };
  }
}

export async function initializeWebhooks() {
  // Create stored procedure for incrementing failure count
  const { error } = await supabase.rpc('create_increment_webhook_failure_procedure');

  if (error && !error.message.includes('already exists')) {
    console.error('Error creating webhook stored procedure:', error);
  }

  console.log('✅ Webhook system initialized');
}