import { supabase } from '../lib/core/supabaseClient';
import { logger } from '../lib/core/logger';

export interface CalendarIntegration {
  id: string;
  userId: string;
  provider: 'google' | 'outlook' | 'apple';
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  email: string;
  calendarId?: string;
  settings: {
    syncEnabled: boolean;
    bidirectionalSync: boolean;
    defaultReminderMinutes: number;
    autoCreateEvents: boolean;
  };
  lastSyncAt?: Date;
  syncStatus: 'idle' | 'syncing' | 'error';
  syncError?: string;
  isActive: boolean;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string[];
}

export interface CalendarProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}

const PROVIDER_CONFIGS: Record<string, CalendarProviderConfig> = {
  google: {
    clientId: import.meta.env?.GOOGLE_CALENDAR_CLIENT_ID || '',
    clientSecret: import.meta.env?.GOOGLE_CALENDAR_CLIENT_SECRET || '',
    redirectUri: `${import.meta.env?.FRONTEND_URL || 'http://localhost:3000'}/auth/google-calendar/callback`,
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events'
    ],
    authUrl: 'https://accounts.google.com/oauth/authorize',
    tokenUrl: 'https://oauth2.googleapis.com/token'
  },
  outlook: {
    clientId: import.meta.env?.OUTLOOK_CALENDAR_CLIENT_ID || '',
    clientSecret: import.meta.env?.OUTLOOK_CALENDAR_CLIENT_SECRET || '',
    redirectUri: `${import.meta.env?.FRONTEND_URL || 'http://localhost:3000'}/auth/outlook-calendar/callback`,
    scopes: [
      'https://graph.microsoft.com/Calendars.ReadWrite',
      'https://graph.microsoft.com/Mail.ReadWrite'
    ],
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
  }
};

export class CalendarOAuthService {
  /**
   * Generate OAuth authorization URL for a calendar provider
   */
  static generateAuthUrl(provider: 'google' | 'outlook', userId: string, state?: string): string {
    const config = PROVIDER_CONFIGS[provider];
    if (!config) {
      throw new Error(`Unsupported calendar provider: ${provider}`);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      response_type: 'code',
      access_type: 'offline', // For refresh tokens
      prompt: 'consent', // Force consent screen to get refresh token
      state: state || `${provider}:${userId}:${Date.now()}`
    });

    return `${config.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for OAuth tokens
   */
  static async exchangeCodeForTokens(
    provider: 'google' | 'outlook',
    code: string
  ): Promise<OAuthTokens> {
    const config = PROVIDER_CONFIGS[provider];

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('OAuth token exchange failed', { provider, error });
      throw new Error(`Failed to exchange code for tokens: ${response.status}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in * 1000)),
      scope: data.scope ? data.scope.split(' ') : config.scopes
    };
  }

  /**
   * Refresh OAuth access token
   */
  static async refreshAccessToken(
    provider: 'google' | 'outlook',
    refreshToken: string
  ): Promise<OAuthTokens> {
    const config = PROVIDER_CONFIGS[provider];

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('OAuth token refresh failed', { provider, error });
      throw new Error(`Failed to refresh access token: ${response.status}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Some providers don't return new refresh token
      expiresAt: new Date(Date.now() + (data.expires_in * 1000)),
      scope: data.scope ? data.scope.split(' ') : config.scopes
    };
  }

  /**
   * Get valid access token for a calendar integration, refreshing if necessary
   */
  static async getValidAccessToken(integrationId: string): Promise<string> {
    const { data: integration, error } = await supabase
      .from('calendar_integrations')
      .select('*')
      .eq('id', integrationId)
      .eq('is_active', true)
      .single();

    if (error || !integration) {
      throw new Error('Calendar integration not found or inactive');
    }

    const now = new Date();
    const tokenExpiresAt = new Date(integration.token_expires_at);

    // If token is still valid (with 5 minute buffer), return it
    if (tokenExpiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
      return integration.access_token;
    }

    // Token expired or will expire soon, refresh it
    if (!integration.refresh_token) {
      throw new Error('No refresh token available for calendar integration');
    }

    try {
      const tokens = await this.refreshAccessToken(
        integration.provider as 'google' | 'outlook',
        integration.refresh_token
      );

      // Update integration with new tokens
      await supabase
        .from('calendar_integrations')
        .update({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokens.expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', integrationId);

      return tokens.accessToken;
    } catch (error) {
      logger.error('Failed to refresh calendar access token', { integrationId, error });

      // Mark integration as having sync error
      await supabase
        .from('calendar_integrations')
        .update({
          sync_status: 'error',
          sync_error: 'Failed to refresh access token',
          updated_at: new Date().toISOString()
        })
        .eq('id', integrationId);

      throw error;
    }
  }

  /**
   * Create or update calendar integration
   */
  static async upsertIntegration(
    userId: string,
    provider: 'google' | 'outlook',
    tokens: OAuthTokens,
    email: string,
    calendarId?: string
  ): Promise<CalendarIntegration> {
    const integration = {
      user_id: userId,
      provider,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: tokens.expiresAt.toISOString(),
      email,
      calendar_id: calendarId,
      settings: {
        syncEnabled: true,
        bidirectionalSync: true,
        defaultReminderMinutes: 15,
        autoCreateEvents: true
      },
      sync_status: 'idle',
      is_active: true,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('calendar_integrations')
      .upsert(integration, {
        onConflict: 'user_id,provider',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to upsert calendar integration', { error, userId, provider });
      throw new Error('Failed to save calendar integration');
    }

    return this.mapDbToIntegration(data);
  }

  /**
   * Get calendar integrations for a user
   */
  static async getUserIntegrations(userId: string): Promise<CalendarIntegration[]> {
    const { data, error } = await supabase
      .from('calendar_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get user calendar integrations', { error, userId });
      throw new Error('Failed to load calendar integrations');
    }

    return data.map(this.mapDbToIntegration);
  }

  /**
   * Delete calendar integration
   */
  static async deleteIntegration(integrationId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('calendar_integrations')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', integrationId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to delete calendar integration', { error, integrationId, userId });
      throw new Error('Failed to delete calendar integration');
    }
  }

  private static mapDbToIntegration(db: any): CalendarIntegration {
    return {
      id: db.id,
      userId: db.user_id,
      provider: db.provider,
      accessToken: db.access_token,
      refreshToken: db.refresh_token,
      tokenExpiresAt: db.token_expires_at ? new Date(db.token_expires_at) : undefined,
      email: db.email,
      calendarId: db.calendar_id,
      settings: db.settings,
      lastSyncAt: db.last_sync_at ? new Date(db.last_sync_at) : undefined,
      syncStatus: db.sync_status,
      syncError: db.sync_error,
      isActive: db.is_active
    };
  }
}