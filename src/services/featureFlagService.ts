import { supabase } from './supabaseService';

export interface FeatureFlag {
  id: string;
  feature_key: string;
  enabled: boolean;
  rollout_percentage: number;
  description: string;
}

/**
 * Service for managing feature flags for gradual rollout of Twenty features
 */
export class FeatureFlagService {
  /**
   * Check if a feature is enabled for the current user/context
   */
  static async isFeatureEnabled(featureKey: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('enabled, rollout_percentage')
        .eq('feature_key', featureKey)
        .single();

      if (error || !data) {
        console.warn(`Feature flag '${featureKey}' not found, defaulting to disabled`);
        return false;
      }

      // For now, simple enabled check - can extend with user-based rollout logic
      return data.enabled;
    } catch (error) {
      console.error('Error checking feature flag:', error);
      return false;
    }
  }

  /**
   * Initialize default feature flags for Phase 8 Views & Reporting
   */
  static async initializeViewsReportingFlags(): Promise<void> {
    const defaultFlags = [
      {
        feature_key: 'advanced_table_view',
        enabled: true,
        rollout_percentage: 100,
        description: 'Advanced table view with custom columns, filtering, and sorting'
      },
      {
        feature_key: 'advanced_kanban_view',
        enabled: true,
        rollout_percentage: 100,
        description: 'Kanban board view with drag-and-drop and WIP limits'
      },
      {
        feature_key: 'advanced_dashboard',
        enabled: true,
        rollout_percentage: 100,
        description: 'Customizable dashboard with multiple widget types'
      },
      {
        feature_key: 'advanced_calendar_view',
        enabled: true,
        rollout_percentage: 100,
        description: 'Calendar view for date-based deal visualization'
      },
      {
        feature_key: 'saved_views',
        enabled: true,
        rollout_percentage: 100,
        description: 'Save and share custom view configurations'
      },
      {
        feature_key: 'custom_metrics',
        enabled: true,
        rollout_percentage: 100,
        description: 'User-defined KPIs and calculated metrics'
      },
      {
        feature_key: 'advanced_export',
        enabled: true,
        rollout_percentage: 100,
        description: 'Enhanced export capabilities (Excel, PDF, XML)'
      },
      {
        feature_key: 'advanced_filtering',
        enabled: true,
        rollout_percentage: 100,
        description: 'Complex filtering with AND/OR logic and multiple conditions'
      },
      {
        feature_key: 'export_templates',
        enabled: false,
        rollout_percentage: 0,
        description: 'Save and reuse export configurations'
      },
      {
        feature_key: 'scheduled_reports',
        enabled: false,
        rollout_percentage: 0,
        description: 'Automated report generation and delivery'
      }
    ];

    for (const flag of defaultFlags) {
      try {
        const { error } = await supabase
          .from('feature_flags')
          .upsert(flag, { onConflict: 'feature_key' });

        if (error) {
          console.warn(`Failed to initialize feature flag ${flag.feature_key}:`, error);
        }
      } catch (error) {
        console.warn(`Error initializing feature flag ${flag.feature_key}:`, error);
      }
    }
  }

  /**
   * Get all feature flags
   */
  static async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .order('feature_key');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      return [];
    }
  }

  /**
   * Update a feature flag
   */
  static async updateFeatureFlag(
    featureKey: string,
    updates: Partial<Pick<FeatureFlag, 'enabled' | 'rollout_percentage'>>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('feature_flags')
        .update(updates)
        .eq('feature_key', featureKey);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating feature flag:', error);
      return false;
    }
  }
}

// Export convenience functions
export const isFeatureEnabled = FeatureFlagService.isFeatureEnabled;
export const getAllFeatureFlags = FeatureFlagService.getAllFeatureFlags;
export const updateFeatureFlag = FeatureFlagService.updateFeatureFlag;