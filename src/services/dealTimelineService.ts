import { supabase } from './supabaseService';
import { DealActivity } from '../types';

/**
 * Service for managing deal timeline and activity tracking
 */
export class DealTimelineService {
  /**
   * Get all activities for a deal
   */
  static async getDealActivities(dealId: string, limit: number = 50): Promise<DealActivity[]> {
    try {
      const { data, error } = await supabase
        .from('deal_activities')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching deal activities:', error);
      return [];
    }
  }

  /**
   * Add a new activity to a deal's timeline
   */
  static async addActivity(
    dealId: string,
    type: DealActivity['type'],
    title: string,
    description: string,
    metadata?: Record<string, any>,
    createdBy?: string
  ): Promise<DealActivity | null> {
    try {
      const activity = {
        deal_id: dealId,
        type,
        title,
        description,
        metadata: metadata || {},
        created_by: createdBy,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('deal_activities')
        .insert(activity)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding deal activity:', error);
      return null;
    }
  }

  /**
   * Get activity summary for a deal
   */
  static async getActivitySummary(dealId: string): Promise<{
    totalActivities: number;
    activitiesByType: Record<string, number>;
    lastActivityDate: Date | null;
    recentActivityCount: number; // Last 7 days
  }> {
    try {
      const { data: activities, error } = await supabase
        .from('deal_activities')
        .select('type, created_at')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const activitiesByType: Record<string, number> = {};
      let lastActivityDate: Date | null = null;
      let recentActivityCount = 0;

      const sevenDaysAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);

      activities?.forEach(activity => {
        // Count by type
        activitiesByType[activity.type] = (activitiesByType[activity.type] || 0) + 1;

        // Track last activity
        if (!lastActivityDate || new Date(activity.created_at) > lastActivityDate) {
          lastActivityDate = new Date(activity.created_at);
        }

        // Count recent activities
        if (new Date(activity.created_at) > sevenDaysAgo) {
          recentActivityCount++;
        }
      });

      return {
        totalActivities: activities?.length || 0,
        activitiesByType,
        lastActivityDate,
        recentActivityCount
      };
    } catch (error) {
      console.error('Error getting activity summary:', error);
      return {
        totalActivities: 0,
        activitiesByType: {},
        lastActivityDate: null,
        recentActivityCount: 0
      };
    }
  }

  /**
   * Log common deal events automatically
   */
  static async logDealCreated(dealId: string, dealData: any, createdBy?: string): Promise<void> {
    await this.addActivity(
      dealId,
      'created',
      'Deal Created',
      `New deal created for ${dealData.company} with value $${dealData.value?.toLocaleString() || 'N/A'}`,
      { company: dealData.company, value: dealData.value, stage: dealData.stage },
      createdBy
    );
  }

  static async logDealUpdated(dealId: string, oldData: any, newData: any, updatedBy?: string): Promise<void> {
    const changes: string[] = [];

    if (oldData.stage !== newData.stage) {
      changes.push(`Stage: ${oldData.stage} → ${newData.stage}`);
    }
    if (oldData.value !== newData.value) {
      changes.push(`Value: $${oldData.value?.toLocaleString()} → $${newData.value?.toLocaleString()}`);
    }
    if (oldData.probability !== newData.probability) {
      changes.push(`Probability: ${oldData.probability}% → ${newData.probability}%`);
    }
    if (oldData.assignedTo !== newData.assignedTo) {
      changes.push(`Assigned: ${oldData.assignedTo || 'Unassigned'} → ${newData.assignedTo || 'Unassigned'}`);
    }

    if (changes.length > 0) {
      await this.addActivity(
        dealId,
        'updated',
        'Deal Updated',
        `Deal updated: ${changes.join(', ')}`,
        { changes, oldData, newData },
        updatedBy
      );
    }
  }

  static async logStageChanged(dealId: string, oldStage: string, newStage: string, changedBy?: string): Promise<void> {
    await this.addActivity(
      dealId,
      'stage_changed',
      'Stage Changed',
      `Deal moved from ${oldStage} to ${newStage}`,
      { oldStage, newStage },
      changedBy
    );
  }

  static async logContactAdded(dealId: string, contactName: string, addedBy?: string): Promise<void> {
    await this.addActivity(
      dealId,
      'contact_added',
      'Contact Added',
      `Contact ${contactName} added to deal`,
      { contactName },
      addedBy
    );
  }

  static async logNoteAdded(dealId: string, notePreview: string, addedBy?: string): Promise<void> {
    const preview = notePreview.length > 50 ? notePreview.substring(0, 50) + '...' : notePreview;
    await this.addActivity(
      dealId,
      'note_added',
      'Note Added',
      `Note added: ${preview}`,
      { notePreview },
      addedBy
    );
  }

  static async logEmailSent(dealId: string, subject: string, recipient: string, sentBy?: string): Promise<void> {
    await this.addActivity(
      dealId,
      'email_sent',
      'Email Sent',
      `Email sent to ${recipient}: ${subject}`,
      { subject, recipient },
      sentBy
    );
  }

  static async logMeetingScheduled(dealId: string, title: string, date: Date, attendees: string[], scheduledBy?: string): Promise<void> {
    await this.addActivity(
      dealId,
      'meeting_scheduled',
      'Meeting Scheduled',
      `Meeting "${title}" scheduled for ${date.toLocaleDateString()} with ${attendees.length} attendees`,
      { title, date: date.toISOString(), attendees },
      scheduledBy
    );
  }

  static async logAttachmentAdded(dealId: string, filename: string, size: number, addedBy?: string): Promise<void> {
    await this.addActivity(
      dealId,
      'attachment_added',
      'Attachment Added',
      `File "${filename}" (${(size / 1024).toFixed(1)} KB) added to deal`,
      { filename, size },
      addedBy
    );
  }

  static async logBulkAction(dealId: string, actionName: string, details: string, performedBy?: string): Promise<void> {
    await this.addActivity(
      dealId,
      'bulk_action',
      'Bulk Action Applied',
      `${actionName}: ${details}`,
      { actionName, details },
      performedBy
    );
  }

  /**
   * Clean up old activities (keep last 1000 per deal)
   */
  static async cleanupOldActivities(dealId: string): Promise<number> {
    try {
      // Get count of activities for this deal
      const { count } = await supabase
        .from('deal_activities')
        .select('*', { count: 'exact', head: true })
        .eq('deal_id', dealId);

      if (!count || count <= 1000) return 0;

      // Delete oldest activities beyond the limit
      const activitiesToDelete = count - 1000;

      const { data: oldestActivities } = await supabase
        .from('deal_activities')
        .select('id')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true })
        .limit(activitiesToDelete);

      if (oldestActivities && oldestActivities.length > 0) {
        const { error } = await supabase
          .from('deal_activities')
          .delete()
          .in('id', oldestActivities.map(a => a.id));

        if (error) throw error;
        return oldestActivities.length;
      }

      return 0;
    } catch (error) {
      console.error('Error cleaning up old activities:', error);
      return 0;
    }
  }
}

// Export convenience functions
export const getDealActivities = DealTimelineService.getDealActivities;
export const addActivity = DealTimelineService.addActivity;
export const getActivitySummary = DealTimelineService.getActivitySummary;
export const logDealCreated = DealTimelineService.logDealCreated;
export const logDealUpdated = DealTimelineService.logDealUpdated;
export const logStageChanged = DealTimelineService.logStageChanged;
export const logContactAdded = DealTimelineService.logContactAdded;
export const logNoteAdded = DealTimelineService.logNoteAdded;
export const logEmailSent = DealTimelineService.logEmailSent;
export const logMeetingScheduled = DealTimelineService.logMeetingScheduled;
export const logAttachmentAdded = DealTimelineService.logAttachmentAdded;
export const logBulkAction = DealTimelineService.logBulkAction;