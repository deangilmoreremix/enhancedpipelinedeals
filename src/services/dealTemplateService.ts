import { supabase } from './supabaseService';
import { DealTemplate } from '../types';

/**
 * Service for managing deal templates
 */
export class DealTemplateService {
  /**
   * Get all available deal templates
   */
  static async getAllTemplates(): Promise<DealTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('deal_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching deal templates:', error);
      return [];
    }
  }

  /**
   * Get a specific template by ID
   */
  static async getTemplateById(id: string): Promise<DealTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('deal_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching deal template:', error);
      return null;
    }
  }

  /**
   * Create a new deal template
   */
  static async createTemplate(template: Omit<DealTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<DealTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('deal_templates')
        .insert(template)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating deal template:', error);
      return null;
    }
  }

  /**
   * Update an existing template
   */
  static async updateTemplate(id: string, updates: Partial<DealTemplate>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('deal_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating deal template:', error);
      return false;
    }
  }

  /**
   * Delete a template
   */
  static async deleteTemplate(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('deal_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting deal template:', error);
      return false;
    }
  }

  /**
   * Apply a template to create a new deal
   */
  static async applyTemplate(templateId: string, contactId: string): Promise<any | null> {
    try {
      const template = await this.getTemplateById(templateId);
      if (!template) return null;

      // Create a new deal based on template data
      const dealData = {
        contact_id: contactId,
        ...template.template_data
      };

      const { data, error } = await supabase
        .from('deals')
        .insert(dealData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error applying deal template:', error);
      return null;
    }
  }
}

// Export convenience functions
export const getAllTemplates = DealTemplateService.getAllTemplates;
export const getTemplateById = DealTemplateService.getTemplateById;
export const createTemplate = DealTemplateService.createTemplate;
export const updateTemplate = DealTemplateService.updateTemplate;
export const deleteTemplate = DealTemplateService.deleteTemplate;
export const applyTemplate = DealTemplateService.applyTemplate;