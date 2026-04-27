import { supabase } from './supabaseService';
import { BulkDealAction, BulkActionResult, Deal } from '../types';

/**
 * Service for performing bulk operations on multiple deals
 */
export class BulkDealActionsService {
  /**
   * Get available bulk actions
   */
  static getAvailableActions(): BulkDealAction[] {
    return [
      {
        id: 'update_stage',
        name: 'Change Stage',
        description: 'Move multiple deals to a new stage',
        actionType: 'change_stage',
        targetStage: 'qualification',
        isDestructive: false
      },
      {
        id: 'assign_owner',
        name: 'Assign Owner',
        description: 'Assign deals to a team member',
        actionType: 'assign_owner',
        isDestructive: false
      },
      {
        id: 'update_priority',
        name: 'Update Priority',
        description: 'Change priority level for multiple deals',
        actionType: 'update_field',
        fieldName: 'priority',
        isDestructive: false
      },
      {
        id: 'add_tags',
        name: 'Add Tags',
        description: 'Add tags to multiple deals',
        actionType: 'add_tag',
        isDestructive: false
      },
      {
        id: 'remove_tags',
        name: 'Remove Tags',
        description: 'Remove tags from multiple deals',
        actionType: 'remove_tag',
        isDestructive: false
      },
      {
        id: 'schedule_followup',
        name: 'Schedule Follow-up',
        description: 'Set follow-up dates for deals',
        actionType: 'schedule_followup',
        isDestructive: false
      },
      {
        id: 'add_note',
        name: 'Add Note',
        description: 'Add a note to multiple deals',
        actionType: 'add_note',
        isDestructive: false
      },
      {
        id: 'archive_deals',
        name: 'Archive Deals',
        description: 'Archive multiple deals (moves to archive status)',
        actionType: 'archive',
        isDestructive: false
      },
      {
        id: 'delete_deals',
        name: 'Delete Deals',
        description: 'Permanently delete multiple deals',
        actionType: 'delete',
        isDestructive: true
      }
    ];
  }

  /**
   * Execute bulk action on multiple deals
   */
  static async executeBulkAction(
    dealIds: string[],
    action: BulkDealAction,
    performedBy?: string
  ): Promise<BulkActionResult[]> {
    const results: BulkActionResult[] = [];

    for (const dealId of dealIds) {
      try {
        const result = await this.executeSingleAction(dealId, action, performedBy);
        results.push(result);

        // Add small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.push({
          dealId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Execute a single action on one deal
   */
  private static async executeSingleAction(
    dealId: string,
    action: BulkDealAction,
    performedBy?: string
  ): Promise<BulkActionResult> {
    try {
      // Get current deal data for logging
      const { data: deal, error: fetchError } = await supabase
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .single();

      if (fetchError || !deal) {
        throw new Error('Deal not found');
      }

      let updateData: any = {};
      let actionDescription = '';

      switch (action.actionType) {
        case 'update_field':
          if (!action.fieldName || action.fieldValue === undefined) {
            throw new Error('Field name and value required for update_field action');
          }
          updateData[action.fieldName] = action.fieldValue;
          actionDescription = `Updated ${action.fieldName} to ${action.fieldValue}`;
          break;

        case 'change_stage':
          if (!action.targetStage) {
            throw new Error('Target stage required for change_stage action');
          }
          updateData.stage = action.targetStage;
          actionDescription = `Changed stage to ${action.targetStage}`;
          break;

        case 'assign_owner':
          if (!action.targetOwnerId) {
            throw new Error('Target owner required for assign_owner action');
          }
          updateData.assigned_to_id = action.targetOwnerId;
          updateData.assigned_to = action.targetOwnerId; // This should be the name, but we'll use ID for now
          actionDescription = `Assigned to ${action.targetOwnerId}`;
          break;

        case 'add_tag':
          if (!action.tagsToAdd || action.tagsToAdd.length === 0) {
            throw new Error('Tags to add required for add_tag action');
          }
          const currentTags = deal.tags || [];
          updateData.tags = [...new Set([...currentTags, ...action.tagsToAdd])];
          actionDescription = `Added tags: ${action.tagsToAdd.join(', ')}`;
          break;

        case 'remove_tag':
          if (!action.tagsToRemove || action.tagsToRemove.length === 0) {
            throw new Error('Tags to remove required for remove_tag action');
          }
          const currentTags2 = deal.tags || [];
          updateData.tags = currentTags2.filter(tag => !action.tagsToRemove!.includes(tag));
          actionDescription = `Removed tags: ${action.tagsToRemove.join(', ')}`;
          break;

        case 'schedule_followup':
          if (!action.followupDate) {
            throw new Error('Follow-up date required for schedule_followup action');
          }
          updateData.next_follow_up = action.followupDate.toISOString();
          actionDescription = `Scheduled follow-up for ${action.followupDate.toLocaleDateString()}`;
          break;

        case 'add_note':
          if (!action.noteText) {
            throw new Error('Note text required for add_note action');
          }
          const currentNotes = deal.notes || '';
          updateData.notes = currentNotes + '\n\n' + action.noteText;
          actionDescription = `Added note: ${action.noteText.substring(0, 50)}...`;
          break;

        case 'archive':
          updateData.archived = true;
          updateData.archived_at = new Date().toISOString();
          actionDescription = 'Deal archived';
          break;

        case 'delete':
          // For delete, we'll use a different approach
          const { error: deleteError } = await supabase
            .from('deals')
            .delete()
            .eq('id', dealId);

          if (deleteError) throw deleteError;

          // Log the deletion activity
          await supabase.from('deal_activities').insert({
            deal_id: dealId,
            type: 'bulk_action',
            title: 'Deal Deleted',
            description: 'Deal permanently deleted via bulk action',
            metadata: { actionName: action.name, bulkAction: true },
            created_by: performedBy
          });

          return {
            dealId,
            success: true,
            oldValue: deal,
            newValue: null
          };

        default:
          throw new Error(`Unknown action type: ${action.actionType}`);
      }

      // Apply the update
      updateData.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('deals')
        .update(updateData)
        .eq('id', dealId);

      if (updateError) throw updateError;

      // Log the bulk action activity
      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        type: 'bulk_action',
        title: action.name,
        description: actionDescription,
        metadata: { actionName: action.name, bulkAction: true, changes: updateData },
        created_by: performedBy
      });

      return {
        dealId,
        success: true,
        oldValue: deal,
        newValue: { ...deal, ...updateData }
      };

    } catch (error) {
      return {
        dealId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Preview bulk action results without executing
   */
  static async previewBulkAction(
    dealIds: string[],
    action: BulkDealAction
  ): Promise<{ dealId: string; currentValue: any; newValue: any }[]> {
    const preview: { dealId: string; currentValue: any; newValue: any }[] = [];

    for (const dealId of dealIds) {
      try {
        const { data: deal } = await supabase
          .from('deals')
          .select('*')
          .eq('id', dealId)
          .single();

        if (!deal) continue;

        let newValue: any;

        switch (action.actionType) {
          case 'update_field':
            newValue = action.fieldValue;
            break;
          case 'change_stage':
            newValue = action.targetStage;
            break;
          case 'assign_owner':
            newValue = action.targetOwnerId;
            break;
          case 'add_tag':
            const currentTags = deal.tags || [];
            newValue = [...new Set([...currentTags, ...(action.tagsToAdd || [])])];
            break;
          case 'remove_tag':
            const currentTags2 = deal.tags || [];
            newValue = currentTags2.filter(tag => !(action.tagsToRemove || []).includes(tag));
            break;
          case 'schedule_followup':
            newValue = action.followupDate?.toISOString();
            break;
          case 'add_note':
            newValue = (deal.notes || '') + '\n\n' + (action.noteText || '');
            break;
          default:
            newValue = 'N/A';
        }

        preview.push({
          dealId,
          currentValue: deal[action.fieldName as keyof Deal] || deal.stage || deal.assigned_to_id || deal.tags || deal.notes,
          newValue
        });
      } catch (error) {
        console.error(`Error previewing action for deal ${dealId}:`, error);
      }
    }

    return preview;
  }

  /**
   * Validate bulk action parameters
   */
  static validateBulkAction(action: BulkDealAction): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (action.actionType) {
      case 'update_field':
        if (!action.fieldName) errors.push('Field name is required');
        if (action.fieldValue === undefined) errors.push('Field value is required');
        break;
      case 'change_stage':
        if (!action.targetStage) errors.push('Target stage is required');
        break;
      case 'assign_owner':
        if (!action.targetOwnerId) errors.push('Target owner is required');
        break;
      case 'add_tag':
        if (!action.tagsToAdd || action.tagsToAdd.length === 0) errors.push('Tags to add are required');
        break;
      case 'remove_tag':
        if (!action.tagsToRemove || action.tagsToRemove.length === 0) errors.push('Tags to remove are required');
        break;
      case 'schedule_followup':
        if (!action.followupDate) errors.push('Follow-up date is required');
        break;
      case 'add_note':
        if (!action.noteText) errors.push('Note text is required');
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export convenience functions
export const getAvailableBulkActions = BulkDealActionsService.getAvailableActions;
export const executeBulkAction = BulkDealActionsService.executeBulkAction;
export const previewBulkAction = BulkDealActionsService.previewBulkAction;
export const validateBulkAction = BulkDealActionsService.validateBulkAction;