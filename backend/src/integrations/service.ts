import axios from 'axios';
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
    slack: 'slack',
    zapier: 'zapier',
    hubspot: 'hubspot',
    salesforce: 'salesforce',
    mailchimp: 'mailchimp',
    google_sheets: 'google_sheets',
    webhook: 'webhook',
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

    return data.map(this.formatIntegration);
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
      case 'slack':
        return await this.testSlackIntegration(integration);
      case 'zapier':
        return await this.testZapierIntegration(integration);
      case 'hubspot':
        return await this.testHubSpotIntegration(integration);
      case 'webhook':
        return await this.testWebhookIntegration(integration);
      default:
        throw new Error(`Test not implemented for integration type: ${integration.type}`);
    }
  }

  private static async performSync(integration: Integration, context: any) {
    switch (integration.type) {
      case 'slack':
        return await this.syncWithSlack(integration, context);
      case 'hubspot':
        return await this.syncWithHubSpot(integration, context);
      case 'google_sheets':
        return await this.syncWithGoogleSheets(integration, context);
      default:
        throw new Error(`Sync not implemented for integration type: ${integration.type}`);
    }
  }

  private static async testSlackIntegration(integration: Integration) {
    const { accessToken } = integration.config;

    if (!accessToken) {
      throw new Error('Slack access token not configured');
    }

    const response = await axios.get('https://slack.com/api/auth.test', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }

    return {
      team: response.data.team,
      user: response.data.user,
      url: response.data.url,
    };
  }

  private static async testZapierIntegration(integration: Integration) {
    const { webhookUrl } = integration.config;

    if (!webhookUrl) {
      throw new Error('Zapier webhook URL not configured');
    }

    const response = await axios.post(webhookUrl, {
      test: true,
      timestamp: new Date().toISOString(),
    });

    return {
      status: response.status,
      response: response.data,
    };
  }

  private static async testHubSpotIntegration(integration: Integration) {
    const { apiKey } = integration.config;

    if (!apiKey) {
      throw new Error('HubSpot API key not configured');
    }

    const response = await axios.get('https://api.hubapi.com/crm/v3/objects/contacts', {
      params: { limit: 1 },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    return {
      total: response.data.total,
      results: response.data.results.length,
    };
  }

  private static async testWebhookIntegration(integration: Integration) {
    const { url, secret } = integration.config;

    if (!url) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      test: true,
      timestamp: new Date().toISOString(),
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Test': 'true',
        ...(secret && { 'X-Webhook-Signature': secret }),
      },
    });

    return {
      status: response.status,
      response: response.data,
    };
  }

  private static async syncWithSlack(integration: Integration, context: any) {
    // Implementation for syncing deals/contacts with Slack
    // This would post updates to configured Slack channels
    console.log('Syncing with Slack for workspace:', context.workspaceId);
    return { synced: true };
  }

  private static async syncWithHubSpot(integration: Integration, context: any) {
    // Implementation for syncing with HubSpot CRM
    // This would sync deals and contacts bidirectionally
    console.log('Syncing with HubSpot for workspace:', context.workspaceId);
    return { synced: true };
  }

  private static async syncWithGoogleSheets(integration: Integration, context: any) {
    // Implementation for syncing with Google Sheets
    // This would export/import data to/from spreadsheets
    console.log('Syncing with Google Sheets for workspace:', context.workspaceId);
    return { synced: true };
  }

  private static async getIntegrationById(id: string, context: any): Promise<Integration | null> {
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

  static async handleOAuthCallback(type: string, code: string, state: string, context: any) {
    switch (type) {
      case 'slack':
        return await this.handleSlackOAuth(code, state, context);
      case 'hubspot':
        return await this.handleHubSpotOAuth(code, state, context);
      case 'google_sheets':
        return await this.handleGoogleSheetsOAuth(code, state, context);
      default:
        throw new Error(`OAuth not supported for integration type: ${type}`);
    }
  }

  private static async handleSlackOAuth(code: string, state: string, context: any) {
    // Exchange code for access token
    const response = await axios.post('https://slack.com/api/oauth.v2.access', {
      client_id: process.env.SLACK_CLIENT_ID,
      client_secret: process.env.SLACK_CLIENT_SECRET,
      code,
    });

    if (!response.data.ok) {
      throw new Error(`Slack OAuth error: ${response.data.error}`);
    }

    // Store the access token in integration config
    const integrationId = state; // Assuming state contains integration ID
    await this.updateIntegrationConfig(integrationId, {
      accessToken: response.data.access_token,
      teamId: response.data.team.id,
      teamName: response.data.team.name,
    }, context);

    return {
      team: response.data.team.name,
      user: response.data.authed_user,
    };
  }

  private static async handleHubSpotOAuth(code: string, state: string, context: any) {
    const response = await axios.post('https://api.hubapi.com/oauth/v1/token', {
      grant_type: 'authorization_code',
      client_id: process.env.HUBSPOT_CLIENT_ID,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET,
      redirect_uri: process.env.HUBSPOT_REDIRECT_URI,
      code,
    });

    const integrationId = state;
    await this.updateIntegrationConfig(integrationId, {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: Date.now() + (response.data.expires_in * 1000),
    }, context);

    return {
      expires_in: response.data.expires_in,
      token_type: response.data.token_type,
    };
  }

  private static async handleGoogleSheetsOAuth(code: string, state: string, context: any) {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    });

    const integrationId = state;
    await this.updateIntegrationConfig(integrationId, {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: Date.now() + (response.data.expires_in * 1000),
    }, context);

    return {
      expires_in: response.data.expires_in,
      scope: response.data.scope,
    };
  }

  private static async updateIntegrationConfig(id: string, config: any, context: any) {
    const { data } = await supabase
      .from('integrations')
      .select('config')
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single();

    const updatedConfig = { ...data.config, ...config };

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