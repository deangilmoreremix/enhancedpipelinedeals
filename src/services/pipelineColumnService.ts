import { supabase } from './supabaseService';
import { CustomPipelineColumn } from '../types/pipeline';
import { PipelineColumn } from '../types';

const DEFAULT_COLUMNS: CustomPipelineColumn[] = [
  {
    id: 'qualification',
    name: 'Qualification',
    position: 1,
    config: { color: 'border-blue-500', wipLimit: 10 },
    is_active: true
  },
  {
    id: 'proposal',
    name: 'Proposal',
    position: 2,
    config: { color: 'border-indigo-500', wipLimit: 8 },
    is_active: true
  },
  {
    id: 'negotiation',
    name: 'Negotiation',
    position: 3,
    config: { color: 'border-purple-500', wipLimit: 6 },
    is_active: true
  },
  {
    id: 'closed-won',
    name: 'Closed Won',
    position: 4,
    config: { color: 'border-green-500', wipLimit: 0 },
    is_active: true
  },
  {
    id: 'closed-lost',
    name: 'Closed Lost',
    position: 5,
    config: { color: 'border-red-500', wipLimit: 0 },
    is_active: true
  }
];

/**
 * Service for managing custom pipeline columns
 */
export class PipelineColumnService {
  private static SETTING_KEY = 'pipeline_columns';

  /**
   * Get custom columns for a user (or global if userId not provided)
   */
  static async getCustomColumns(userId?: string): Promise<CustomPipelineColumn[]> {
    // If supabase client is not initialized, return default columns
    if (!supabase) {
      return DEFAULT_COLUMNS;
    }

    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', this.SETTING_KEY)
        .maybeSingle();

      if (error || !data) {
        return DEFAULT_COLUMNS;
      }

      const stored = data.setting_value as CustomPipelineColumn[];
      return stored?.length > 0 ? stored : DEFAULT_COLUMNS;
    } catch (error) {
      console.error('Error fetching custom columns:', error);
      return DEFAULT_COLUMNS;
    }
  }

  /**
   * Save custom columns (global or user-specific)
   */
  static async saveCustomColumns(columns: CustomPipelineColumn[], userId?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          {
            setting_key: this.SETTING_KEY,
            setting_value: columns,
            user_id: userId || null,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: userId ? 'user_id,setting_key' : 'setting_key'
          }
        );

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving custom columns:', error);
      return false;
    }
  }

  /**
   * Convert CustomPipelineColumn to PipelineColumn format used by the kanban board
   */
  static toPipelineColumn(custom: CustomPipelineColumn): PipelineColumn {
    return {
      id: custom.id,
      title: custom.name,
      dealIds: [], // will be populated from deals
      color: custom.config.color?.replace('border-', '') || 'gray',
      position: custom.position,
      wipLimit: custom.config.wipLimit,
      description: custom.config.description
    };
  }
}

// Convenience exports
export const getCustomColumns = PipelineColumnService.getCustomColumns;
export const saveCustomColumns = PipelineColumnService.saveCustomColumns;
export const toPipelineColumn = PipelineColumnService.toPipelineColumn;
