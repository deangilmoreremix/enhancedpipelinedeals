// SDR Agent Preferences Management Service

import { getSupabaseService } from './supabaseService';
import {
  SDRUserPreferences,
  SDRAgentPreferences,
  SDRCampaignTemplate,
  SDRPresetConfiguration,
  SDR_AGENT_DEFAULTS
} from '../types/sdr-config';

export class SDRPreferencesService {
  private supabase = getSupabaseService();

  private get client() {
    // Access the private supabase client through reflection or add a public getter
    return (this.supabase as any).supabase;
  }

  /**
   * Get user preferences for a specific agent
   */
  async getUserPreferences(userId: string, agentId: string): Promise<SDRUserPreferences | null> {
    try {
      const { data, error } = await this.client
        .from('sdr_user_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('agent_id', agentId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching SDR preferences:', error);
        return null;
      }

      if (data) {
        return {
          id: data.id,
          userId: data.user_id,
          agentId: data.agent_id,
          preferences: data.preferences,
          isActive: data.is_active,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at)
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return null;
    }
  }

  /**
   * Save or update user preferences for an agent
   */
  async saveUserPreferences(userId: string, agentId: string, preferences: SDRAgentPreferences): Promise<boolean> {
    try {
      const existing = await this.getUserPreferences(userId, agentId);

      const preferenceData = {
        user_id: userId,
        agent_id: agentId,
        preferences,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      if (existing) {
        // Update existing preferences
        const { error } = await this.client
          .from('sdr_user_preferences')
          .update(preferenceData)
          .eq('id', existing.id);

        if (error) {
          console.error('Error updating SDR preferences:', error);
          return false;
        }
      } else {
        // Create new preferences
        const { error } = await this.client
          .from('sdr_user_preferences')
          .insert(preferenceData);

        if (error) {
          console.error('Error creating SDR preferences:', error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to save user preferences:', error);
      return false;
    }
  }

  /**
   * Get default preferences for an agent
   */
  getDefaultPreferences(agentId: string): SDRAgentPreferences {
    const defaults = SDR_AGENT_DEFAULTS[agentId] || {};

    return {
      campaignLength: defaults.campaignLength || 5,
      timing: defaults.timing || 'business-hours',
      tone: defaults.tone || 'professional',
      style: defaults.style || 'detailed',
      personalizationLevel: defaults.personalizationLevel || 'medium',
      branding: {
        companyName: 'Your Company',
        signature: 'Best regards,\nYour Sales Team'
      },
      channels: defaults.channels || {
        primary: 'email',
        secondary: [],
        conditions: { email: 'always', linkedin: 'never', whatsapp: 'never', phone: 'never' },
        limits: { email: 5, linkedin: 2, whatsapp: 1, phone: 0 }
      },
      successCriteria: [
        { metric: 'opened', weight: 0.3, action: 'continue' },
        { metric: 'clicked', weight: 0.5, action: 'continue' },
        { metric: 'replied', weight: 1.0, action: 'escalate' }
      ],
      followUpRules: {},
      ...defaults
    };
  }

  /**
   * Get all user preferences for all agents
   */
  async getAllUserPreferences(userId: string): Promise<SDRUserPreferences[]> {
    try {
      const { data, error } = await this.client
        .from('sdr_user_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching all SDR preferences:', error);
        return [];
      }

      return data.map((item: any) => ({
        id: item.id,
        userId: item.user_id,
        agentId: item.agent_id,
        preferences: item.preferences,
        isActive: item.is_active,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at)
      }));
    } catch (error) {
      console.error('Failed to get all user preferences:', error);
      return [];
    }
  }

  /**
   * Delete user preferences for an agent (reset to defaults)
   */
  async deleteUserPreferences(userId: string, agentId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('sdr_user_preferences')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('agent_id', agentId);

      if (error) {
        console.error('Error deleting SDR preferences:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to delete user preferences:', error);
      return false;
    }
  }

  /**
   * Get preset configurations
   */
  async getPresetConfigurations(agentId?: string): Promise<SDRPresetConfiguration[]> {
    try {
      let query = this.client
        .from('sdr_preset_configurations')
        .select('*')
        .eq('is_active', true)
        .order('usage_count', { ascending: false });

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching preset configurations:', error);
        return [];
      }

      return data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        agentId: item.agent_id,
        category: item.category,
        preferences: item.preferences,
        recommendedFor: item.recommended_for,
        successRate: item.success_rate
      }));
    } catch (error) {
      console.error('Failed to get preset configurations:', error);
      return [];
    }
  }

  /**
   * Save campaign template
   */
  async saveCampaignTemplate(template: Omit<SDRCampaignTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
    try {
      const { data, error } = await this.client
        .from('sdr_campaign_templates')
        .insert({
          user_id: template.userId,
          name: template.name,
          agent_id: template.agentId,
          description: template.description,
          sequence: template.sequence,
          settings: template.settings,
          is_public: template.isPublic,
          tags: template.tags,
          usage_count: template.usageCount
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error saving campaign template:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Failed to save campaign template:', error);
      return null;
    }
  }

  /**
   * Get user's campaign templates
   */
  async getUserCampaignTemplates(userId: string, agentId?: string): Promise<SDRCampaignTemplate[]> {
    try {
      let query = this.client
        .from('sdr_campaign_templates')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching campaign templates:', error);
        return [];
      }

      return data.map(item => ({
        id: item.id,
        userId: item.user_id,
        name: item.name,
        agentId: item.agent_id,
        description: item.description,
        sequence: item.sequence,
        settings: item.settings,
        isPublic: item.is_public,
        tags: item.tags,
        usageCount: item.usage_count,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at)
      }));
    } catch (error) {
      console.error('Failed to get campaign templates:', error);
      return [];
    }
  }

  /**
   * Record agent performance metrics
   */
  async recordAgentPerformance(
    userId: string,
    agentId: string,
    metrics: Record<string, any>,
    executionTime?: number,
    success?: boolean,
    campaignId?: string,
    dealId?: string,
    contactId?: string
  ): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('sdr_agent_performance')
        .insert({
          user_id: userId,
          agent_id: agentId,
          campaign_id: campaignId,
          deal_id: dealId,
          contact_id: contactId,
          metrics,
          execution_time: executionTime,
          success
        });

      if (error) {
        console.error('Error recording agent performance:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to record agent performance:', error);
      return false;
    }
  }
}

// Singleton instance
export const sdrPreferencesService = new SDRPreferencesService();