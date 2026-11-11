import { supabase } from './supabaseService';
import { CustomPipelineColumn } from '../types/pipeline';
import { PipelineColumn, PipelineStage } from '../types';
import { getStages, upsertStages, DEFAULT_STAGES } from './pipelineStageService';

const stageToCustom = (s: PipelineStage): CustomPipelineColumn => ({
  id: s.key,
  name: s.name,
  position: s.position + 1,
  config: { color: `border-${s.color}-500`, wipLimit: s.wipLimit ?? 0 },
  is_active: s.visible
});

/**
 * Service for managing custom pipeline columns
 */
export class PipelineColumnService {
  private static SETTING_KEY = 'pipeline_columns';

  /**
   * Get custom columns for a user (or global if userId not provided)
   */
  static async getCustomColumns(_userId?: string): Promise<CustomPipelineColumn[]> {
    // Delegates to pipelineStageService (pipeline_stages table, with app_settings/default fallbacks)
    const stages = await getStages();
    return (stages.length ? stages : DEFAULT_STAGES).map(stageToCustom);
  }

  /**
   * @deprecated The stage manager (CustomColumnManager) now edits stages through dealStore.
   * Kept as a compatibility writer: it never zeroes probabilities or drops won/lost flags.
   */
  static async saveCustomColumns(columns: CustomPipelineColumn[], userId?: string): Promise<boolean> {
    try {
      // Preserve probability / won / lost of existing stages: the legacy column shape does not carry them
      const existing = await getStages();
      await upsertStages(columns.map((c, i) => {
        const prev = existing.find(s => s.key === c.id) ?? DEFAULT_STAGES.find(d => d.key === c.id);
        return {
          key: c.id,
          name: c.name,
          color: c.config.color?.replace(/^border-/, '').replace(/-\d+$/, '') || prev?.color || 'gray',
          position: c.position != null ? c.position - 1 : i,
          visible: c.is_active,
          wipLimit: c.config.wipLimit ? c.config.wipLimit : null,
          ...(prev ? {} : { probability: 0, isWon: false, isLost: false })
        };
      }));
      return true;
    } catch (error) {
      console.warn('pipeline_stages save failed, falling back to app_settings:', error);
    }
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
          { onConflict: userId ? 'user_id,setting_key' : 'setting_key' }
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
