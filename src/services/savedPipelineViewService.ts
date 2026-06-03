import { supabase } from './supabaseService';

export interface SavedPipelineView {
  id: string;
  name: string;
  view_type: 'kanban' | 'table' | 'calendar' | 'timeline';
  filters: any;
  sorting: any;
  columns: string[];
  is_default: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Service for managing saved pipeline views
 */
export class SavedPipelineViewService {
  /**
   * Get all saved views for the current user
   */
  static async getAllViews(): Promise<SavedPipelineView[]> {
    try {
      const { data, error } = await supabase
        .from('saved_pipeline_views')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching saved pipeline views:', error);
      return [];
    }
  }

  /**
   * Get a specific view by ID
   */
  static async getViewById(id: string): Promise<SavedPipelineView | null> {
    try {
      const { data, error } = await supabase
        .from('saved_pipeline_views')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching saved pipeline view:', error);
      return null;
    }
  }

  /**
   * Create a new saved view
   */
  static async createView(view: Omit<SavedPipelineView, 'id' | 'created_at' | 'updated_at'>): Promise<SavedPipelineView | null> {
    try {
      const { data, error } = await supabase
        .from('saved_pipeline_views')
        .insert(view)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating saved pipeline view:', error);
      return null;
    }
  }

  /**
   * Update an existing view
   */
  static async updateView(id: string, updates: Partial<SavedPipelineView>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('saved_pipeline_views')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating saved pipeline view:', error);
      return false;
    }
  }

  /**
   * Delete a view
   */
  static async deleteView(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('saved_pipeline_views')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting saved pipeline view:', error);
      return false;
    }
  }

  /**
   * Set a view as default
   */
  static async setDefaultView(id: string): Promise<boolean> {
    try {
      // First, unset any existing default
      await supabase
        .from('saved_pipeline_views')
        .update({ is_default: false })
        .eq('is_default', true);

      // Then set the new default
      const { error } = await supabase
        .from('saved_pipeline_views')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error setting default view:', error);
      return false;
    }
  }

  /**
   * Get the default view
   */
  static async getDefaultView(): Promise<SavedPipelineView | null> {
    try {
      const { data, error } = await supabase
        .from('saved_pipeline_views')
        .select('*')
        .eq('is_default', true)
        .single();

      if (error) {
        // No default view set
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error getting default view:', error);
      return null;
    }
  }

  /**
   * Save current view configuration
   */
  static async saveCurrentView(
    name: string,
    viewType: string,
    filters: any,
    sorting: any,
    columns: string[]
  ): Promise<SavedPipelineView | null> {
    const viewData = {
      name,
      view_type: viewType as any,
      filters,
      sorting,
      columns,
      is_default: false
    };

    return await this.createView(viewData);
  }
}

// Export convenience functions
export const getAllViews = SavedPipelineViewService.getAllViews;
export const getViewById = SavedPipelineViewService.getViewById;
export const createView = SavedPipelineViewService.createView;
export const updateView = SavedPipelineViewService.updateView;
export const deleteView = SavedPipelineViewService.deleteView;
export const setDefaultView = SavedPipelineViewService.setDefaultView;
export const getDefaultView = SavedPipelineViewService.getDefaultView;
export const saveCurrentView = SavedPipelineViewService.saveCurrentView;