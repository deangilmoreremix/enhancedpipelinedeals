import { supabase } from './supabaseService';

export interface DealWorkflow {
  id: string;
  name: string;
  description?: string;
  stages: any[]; // JSON array of workflow stages
  triggers: any[]; // JSON array of trigger conditions
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Service for managing deal workflows
 */
export class DealWorkflowService {
  /**
   * Get all active deal workflows
   */
  static async getAllWorkflows(): Promise<DealWorkflow[]> {
    try {
      const { data, error } = await supabase
        .from('deal_workflows')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching deal workflows:', error);
      return [];
    }
  }

  /**
   * Get a specific workflow by ID
   */
  static async getWorkflowById(id: string): Promise<DealWorkflow | null> {
    try {
      const { data, error } = await supabase
        .from('deal_workflows')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching deal workflow:', error);
      return null;
    }
  }

  /**
   * Create a new deal workflow
   */
  static async createWorkflow(workflow: Omit<DealWorkflow, 'id' | 'created_at' | 'updated_at'>): Promise<DealWorkflow | null> {
    try {
      const { data, error } = await supabase
        .from('deal_workflows')
        .insert(workflow)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating deal workflow:', error);
      return null;
    }
  }

  /**
   * Update an existing workflow
   */
  static async updateWorkflow(id: string, updates: Partial<DealWorkflow>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('deal_workflows')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating deal workflow:', error);
      return false;
    }
  }

  /**
   * Delete a workflow
   */
  static async deleteWorkflow(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('deal_workflows')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting deal workflow:', error);
      return false;
    }
  }

  /**
   * Assign a workflow to a deal
   */
  static async assignWorkflowToDeal(dealId: string, workflowId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('deals')
        .update({ workflow_id: workflowId })
        .eq('id', dealId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error assigning workflow to deal:', error);
      return false;
    }
  }

  /**
   * Get workflow for a specific deal
   */
  static async getWorkflowForDeal(dealId: string): Promise<DealWorkflow | null> {
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('workflow_id')
        .eq('id', dealId)
        .single();

      if (error || !data?.workflow_id) return null;

      return await this.getWorkflowById(data.workflow_id);
    } catch (error) {
      console.error('Error getting workflow for deal:', error);
      return null;
    }
  }

  /**
   * Execute workflow trigger (simplified version - would be more complex in production)
   */
  static async executeWorkflowTrigger(dealId: string, triggerType: string, triggerData?: any): Promise<boolean> {
    try {
      // This is a simplified implementation
      // In production, this would evaluate triggers and execute actions
      console.log(`Executing workflow trigger ${triggerType} for deal ${dealId}`, triggerData);

      // Log the trigger execution
      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        type: 'workflow_trigger',
        description: `Workflow trigger executed: ${triggerType}`,
        metadata: { triggerType, triggerData }
      });

      return true;
    } catch (error) {
      console.error('Error executing workflow trigger:', error);
      return false;
    }
  }
}

// Export convenience functions
export const getAllWorkflows = DealWorkflowService.getAllWorkflows;
export const getWorkflowById = DealWorkflowService.getWorkflowById;
export const createWorkflow = DealWorkflowService.createWorkflow;
export const updateWorkflow = DealWorkflowService.updateWorkflow;
export const deleteWorkflow = DealWorkflowService.deleteWorkflow;
export const assignWorkflowToDeal = DealWorkflowService.assignWorkflowToDeal;
export const getWorkflowForDeal = DealWorkflowService.getWorkflowForDeal;
export const executeWorkflowTrigger = DealWorkflowService.executeWorkflowTrigger;