import axios from 'axios';
import crypto from 'crypto';
import { supabase } from '../services/database';

interface Integration {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  config: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSync?: Date;
  syncStatus: string;
}

export class IntegrationService {
  private static readonly INTEGRATION_TYPES = {
    webhook: 'webhook',
    supabase: 'supabase',
  };

  static async createIntegration(input: any, context: any): Promise<Integration> {
    // Validate integration type
    if (!Object.values(this.INTEGRATION_TYPES).includes(input.type)) {
      throw new Error(`Unsupported integration type: ${input.type}`);
    }

    const integrationData = {
      workspace_id: context.workspaceId,
      name: input.name,
      type: input.type,
      config: input.config,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      sync_status: 'idle',
    };

    const { data, error } = await supabase
      .from('integrations')
      .insert(integrationData)
      .select()
      .single();

    if (error) {
      console.error('Error creating integration:', error);
      throw new Error('Failed to create integration');
    }

    return this.formatIntegration(data);
  }

  static async updateIntegration(id: string, input: any, context: any): Promise<Integration> {
    const updates = {
      ...input,
      updated_at: new Date(),
    };

    const { data, error } = await supabase
      .from('integrations')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating integration:', error);
      throw new Error('Failed to update integration');
    }

    return this.formatIntegration(data);
  }

  static async deleteIntegration(id: string, context: any): Promise<boolean> {
    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('id', id)
      .eq('workspace_id', context.workspaceId);

    if (error) {
      console.error('Error deleting integration:', error);
      return false;
    }

    return true;
  }

  static async getIntegrations(context: any): Promise<Integration[]> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('workspace_id', context.workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching integrations:', error);
      throw new Error('Failed to fetch integrations');
    }

    return data.map((d: any) => this.formatIntegration(d));
  }

  static async testIntegration(id: string, context: any) {
    const integration = await this.getIntegrationById(id, context);
    if (!integration) {
      throw new Error('Integration not found');
    }

    try {
      const result = await this.testIntegrationConnection(integration);
      return {
        success: true,
        message: 'Integration test successful',
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  static async syncIntegration(id: string, context: any) {
    const integration = await this.getIntegrationById(id, context);
    if (!integration) {
      throw new Error('Integration not found');
    }

    try {
      await this.updateSyncStatus(id, 'in_progress');

      const result = await this.performSync(integration, context);

      await this.updateSyncStatus(id, 'completed', new Date());

      return {
        success: true,
        message: 'Sync completed successfully',
        data: result,
      };
    } catch (error: any) {
      await this.updateSyncStatus(id, 'failed');
      throw error;
    }
  }

  private static async testIntegrationConnection(integration: Integration) {
    switch (integration.type) {
      case 'webhook':
        return await this.testWebhookIntegration(integration);
      case 'supabase':
        return await this.testSupabaseIntegration();
      default:
        throw new Error(`Test not implemented for integration type: ${integration.type}`);
    }
  }

  private static async performSync(integration: Integration, context: any) {
    switch (integration.type) {
      case 'webhook':
        return await this.deliverWebhook(
          integration.config,
          { event: 'integration.sync', workspaceId: context.workspaceId, timestamp: new Date().toISOString() }
        );
      case 'supabase':
        return await this.testSupabaseIntegration();
      default:
        throw new Error(`Sync not implemented for integration type: ${integration.type}`);
    }
  }

  private static async testSupabaseIntegration() {
    const { error } = await supabase.from('integrations').select('id', { head: true, count: 'exact' });
    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }
    return { connected: true };
  }

  private static async testWebhookIntegration(integration: Integration) {
    return await this.deliverWebhook(integration.config, {
      test: true,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Outbound HTTP POST to a user-configured URL, signed with HMAC-SHA256
   * (header X-Webhook-Signature: sha256=<hex>) when a secret is configured.
   */
  static async deliverWebhook(config: Record<string, any>, payload: any) {
    const { url, secret } = config || {};

    if (!url) {
      throw new Error('Webhook URL not configured');
    }

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) {
      headers['X-Webhook-Signature'] =
        'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
    }

    const response = await axios.post(url, body, { headers, timeout: 10000 });

    return {
      status: response.status,
      response: response.data,
    };
  }

  static async getIntegrationById(id: string, context: any): Promise<Integration | null> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single();

    if (error) {
      console.error('Error fetching integration:', error);
      return null;
    }

    return this.formatIntegration(data);
  }

  private static async updateSyncStatus(id: string, status: string, lastSync?: Date) {
    const updates: any = {
      sync_status: status,
    };

    if (lastSync) {
      updates.last_sync = lastSync;
    }

    await supabase
      .from('integrations')
      .update(updates)
      .eq('id', id);
  }

  private static formatIntegration(data: any): Integration {
    return {
      id: data.id,
      workspaceId: data.workspace_id,
      name: data.name,
      type: data.type,
      config: data.config,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      lastSync: data.last_sync ? new Date(data.last_sync) : undefined,
      syncStatus: data.sync_status,
    };
  }

  private static async updateIntegrationConfig(id: string, config: any, context: any) {
    const { data } = await supabase
      .from('integrations')
      .select('config')
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single();

    const updatedConfig = { ...(data?.config || {}), ...config };

    await supabase
      .from('integrations')
      .update({ config: updatedConfig })
      .eq('id', id)
      .eq('workspace_id', context.workspaceId);
  }

  static getSupportedIntegrationTypes() {
    return Object.values(this.INTEGRATION_TYPES);
  }
}

export async function initializeIntegrations() {
  console.log('✅ Integration system initialized');
}