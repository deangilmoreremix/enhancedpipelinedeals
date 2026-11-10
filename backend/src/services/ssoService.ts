import { createClient } from '@supabase/supabase-js';
import { supabase } from './database';
import { SSOConfig } from '../types';
import { featureFlags } from '../features/flags';

/**
 * Supabase Auth is the only authentication system. This service stores
 * per-workspace SSO settings and verifies Supabase-issued JWTs.
 */
export class SSOService {
  private getAdminClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  /**
   * Verify a Supabase access token and return the authenticated user.
   */
  async verifySupabaseToken(token: string) {
    const { data, error } = await this.getAdminClient().auth.getUser(token);
    if (error || !data?.user) {
      throw new Error('Invalid or expired Supabase token');
    }
    return data.user;
  }

  async createSSOConfig(
    workspaceId: string,
    provider: 'supabase',
    config: Record<string, any>,
    createdBy: string
  ): Promise<SSOConfig> {
    if (!featureFlags.isEnabled('sso_integration')) {
      throw new Error('SSO integration is not enabled');
    }
    if (provider !== 'supabase') {
      throw new Error(`Unsupported SSO provider: ${provider}`);
    }

    const ssoConfig: SSOConfig = {
      id: crypto.randomUUID(),
      workspaceId,
      provider,
      config,
      isActive: false,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { error } = await supabase
      .from('sso_configs')
      .insert([{
        id: ssoConfig.id,
        workspace_id: ssoConfig.workspaceId,
        provider: ssoConfig.provider,
        config: ssoConfig.config,
        is_active: ssoConfig.isActive,
        created_by: ssoConfig.createdBy,
        created_at: ssoConfig.createdAt.toISOString(),
        updated_at: ssoConfig.updatedAt.toISOString(),
      }]);

    if (error) throw error;
    return ssoConfig;
  }

  async getSSOConfig(workspaceId: string): Promise<SSOConfig | null> {
    const { data, error } = await supabase
      .from('sso_configs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .single();

    if (error) return null;

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: data.provider,
      config: data.config,
      isActive: data.is_active,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async updateSSOConfig(
    configId: string,
    updates: Partial<Pick<SSOConfig, 'config' | 'isActive'>>
  ): Promise<void> {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (updates.config) updateData.config = updates.config;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { error } = await supabase.from('sso_configs').update(updateData).eq('id', configId);
    if (error) throw error;
  }

  async deleteSSOConfig(configId: string): Promise<void> {
    const { error } = await supabase.from('sso_configs').delete().eq('id', configId);
    if (error) throw error;
  }
}

export const ssoService = new SSOService();
