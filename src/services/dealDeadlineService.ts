import { supabase } from '../lib/core/supabaseClient';
import { logger } from '../lib/core/logger';
import { CalendarEventService } from './calendarEventService';
import { ReminderService } from './reminderService';

export interface DealDeadline {
  id: string;
  dealId: string;
  title: string;
  description?: string;
  deadlineAt: Date;
  deadlineType: 'close_date' | 'followup' | 'milestone' | 'custom';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'completed' | 'overdue' | 'cancelled';
  reminders: DeadlineReminder[];
  calendarEventId?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeadlineReminder {
  type: 'notification' | 'email' | 'calendar_event';
  minutesBefore: number;
  sent?: boolean;
  sentAt?: Date;
}

export interface CreateDeadlineRequest {
  dealId: string;
  title: string;
  description?: string;
  deadlineAt: Date;
  deadlineType?: 'close_date' | 'followup' | 'milestone' | 'custom';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  reminders?: Omit<DeadlineReminder, 'sent' | 'sentAt'>[];
  createCalendarEvent?: boolean;
}

export class DealDeadlineService {
  /**
   * Create a new deal deadline
   */
  static async createDeadline(
    userId: string,
    request: CreateDeadlineRequest
  ): Promise<DealDeadline> {
    // Validate deal exists
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, contacts(name, email)')
      .eq('id', request.dealId)
      .single();

    if (dealError || !deal) {
      throw new Error('Deal not found');
    }

    const deadlineData = {
      deal_id: request.dealId,
      title: request.title,
      description: request.description,
      deadline_at: request.deadlineAt.toISOString(),
      deadline_type: request.deadlineType || 'custom',
      priority: request.priority || 'medium',
      reminders: request.reminders?.map(r => ({ ...r, sent: false })) || [],
      status: 'active'
    };

    const { data: deadline, error } = await supabase
      .from('deal_deadlines')
      .insert(deadlineData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create deal deadline', { error, userId, request });
      throw new Error('Failed to create deal deadline');
    }

    // Create calendar event if requested
    let calendarEventId: string | undefined;
    if (request.createCalendarEvent) {
      try {
        const calendarEvent = await CalendarEventService.createEvent(userId, {
          dealId: request.dealId,
          title: request.title,
          description: request.description,
          startTime: request.deadlineAt,
          endTime: new Date(request.deadlineAt.getTime() + 60 * 60 * 1000), // 1 hour
          eventType: 'deadline',
          reminders: request.reminders?.map(r => ({
            type: r.type === 'calendar_event' ? 'popup' : r.type === 'email' ? 'email' : 'popup',
            minutesBefore: r.minutesBefore
          })) || []
        });
        calendarEventId = calendarEvent.id;

        // Update deadline with calendar event ID
        await supabase
          .from('deal_deadlines')
          .update({ calendar_event_id: calendarEventId })
          .eq('id', deadline.id);
      } catch (calendarError) {
        logger.warn('Failed to create calendar event for deadline', { deadlineId: deadline.id, calendarError });
        // Don't fail the deadline creation
      }
    }

    // Schedule reminders
    if (request.reminders && request.reminders.length > 0) {
      await this.scheduleDeadlineReminders(deadline.id, request.reminders, request.deadlineAt);
    }

    return this.mapDbToDeadline({ ...deadline, calendar_event_id: calendarEventId });
  }

  /**
   * Update a deal deadline
   */
  static async updateDeadline(
    deadlineId: string,
    userId: string,
    updates: Partial<CreateDeadlineRequest>
  ): Promise<DealDeadline> {
    const updateData: any = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.deadlineAt) updateData.deadline_at = updates.deadlineAt.toISOString();
    if (updates.deadlineType) updateData.deadline_type = updates.deadlineType;
    if (updates.priority) updateData.priority = updates.priority;

    if (updates.reminders) {
      updateData.reminders = updates.reminders.map(r => ({ ...r, sent: false }));
    }

    const { data: deadline, error } = await supabase
      .from('deal_deadlines')
      .update(updateData)
      .eq('id', deadlineId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update deal deadline', { error, deadlineId, userId });
      throw new Error('Failed to update deal deadline');
    }

    // Update calendar event if it exists and deadline changed
    if (deadline.calendar_event_id && updates.deadlineAt) {
      try {
        await CalendarEventService.updateEvent(deadline.calendar_event_id, userId, {
          title: updates.title || deadline.title,
          description: updates.description || deadline.description,
          startTime: updates.deadlineAt,
          endTime: new Date(updates.deadlineAt.getTime() + 60 * 60 * 1000)
        });
      } catch (calendarError) {
        logger.warn('Failed to update calendar event for deadline', { deadlineId, calendarError });
      }
    }

    // Reschedule reminders if deadline time changed
    if (updates.deadlineAt && updates.reminders) {
      await this.scheduleDeadlineReminders(deadlineId, updates.reminders, updates.deadlineAt);
    }

    return this.mapDbToDeadline(deadline);
  }

  /**
   * Mark deadline as completed
   */
  static async completeDeadline(deadlineId: string, userId: string): Promise<DealDeadline> {
    const { data: deadline, error } = await supabase
      .from('deal_deadlines')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', deadlineId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to complete deal deadline', { error, deadlineId, userId });
      throw new Error('Failed to complete deal deadline');
    }

    // Cancel any pending reminders
    await ReminderService.cancelRemindersForRelatedId(deadlineId);

    return this.mapDbToDeadline(deadline);
  }

  /**
   * Get deadlines for a deal or user
   */
  static async getDeadlines(filters: {
    dealId?: string;
    userId?: string;
    status?: string;
    priority?: string;
    upcomingOnly?: boolean;
    limit?: number;
  } = {}): Promise<DealDeadline[]> {
    let query = supabase
      .from('deal_deadlines')
      .select('*')
      .order('deadline_at', { ascending: true });

    if (filters.dealId) {
      query = query.eq('deal_id', filters.dealId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }

    if (filters.upcomingOnly) {
      query = query.gte('deadline_at', new Date().toISOString()).eq('status', 'active');
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to get deal deadlines', { error, filters });
      throw new Error('Failed to load deal deadlines');
    }

    return data.map(this.mapDbToDeadline);
  }

  /**
   * Check for overdue deadlines and update their status
   */
  static async checkOverdueDeadlines(): Promise<number> {
    const now = new Date();

    const { data: overdueDeadlines, error } = await supabase
      .from('deal_deadlines')
      .update({
        status: 'overdue',
        updated_at: now.toISOString()
      })
      .eq('status', 'active')
      .lt('deadline_at', now.toISOString())
      .select('id');

    if (error) {
      logger.error('Failed to check overdue deadlines', { error });
      throw new Error('Failed to check overdue deadlines');
    }

    const overdueCount = overdueDeadlines?.length || 0;

    if (overdueCount > 0) {
      logger.info(`Marked ${overdueCount} deadlines as overdue`);
    }

    return overdueCount;
  }

  /**
   * Get deadline statistics for dashboard
   */
  static async getDeadlineStats(userId?: string): Promise<{
    total: number;
    active: number;
    completed: number;
    overdue: number;
    upcoming: number;
  }> {
    const { data, error } = await supabase
      .from('deal_deadlines')
      .select('status, deadline_at')
      .eq('status', 'active');

    if (error) {
      logger.error('Failed to get deadline stats', { error });
      throw new Error('Failed to get deadline stats');
    }

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let total = 0;
    let active = 0;
    let completed = 0;
    let overdue = 0;
    let upcoming = 0;

    // Count from the data we have (only active ones)
    active = data?.length || 0;

    // Get completed and overdue counts
    const { data: otherStatuses } = await supabase
      .from('deal_deadlines')
      .select('status')
      .in('status', ['completed', 'overdue']);

    otherStatuses?.forEach(item => {
      if (item.status === 'completed') completed++;
      else if (item.status === 'overdue') overdue++;
    });

    total = active + completed + overdue;

    // Count upcoming deadlines (next 7 days)
    upcoming = data?.filter(d => {
      const deadline = new Date(d.deadline_at);
      return deadline >= now && deadline <= nextWeek;
    }).length || 0;

    return { total, active, completed, overdue, upcoming };
  }

  /**
   * Schedule reminders for a deadline
   */
  private static async scheduleDeadlineReminders(
    deadlineId: string,
    reminders: Omit<DeadlineReminder, 'sent' | 'sentAt'>[],
    deadlineAt: Date
  ): Promise<void> {
    // Cancel existing reminders for this deadline
    await ReminderService.cancelRemindersForRelatedId(deadlineId);

    // Schedule new reminders
    for (const reminder of reminders) {
      const remindAt = new Date(deadlineAt.getTime() - reminder.minutesBefore * 60 * 1000);

      // Only schedule future reminders
      if (remindAt > new Date()) {
        await ReminderService.createReminder({
          userId: '', // Will be set by the calling context
          title: `Deadline Reminder: ${remindAt}`,
          remindAt,
          reminderType: reminder.type as any,
          relatedType: 'deadline',
          relatedId: deadlineId
        });
      }
    }
  }

  private static mapDbToDeadline(db: any): DealDeadline {
    return {
      id: db.id,
      dealId: db.deal_id,
      title: db.title,
      description: db.description,
      deadlineAt: new Date(db.deadline_at),
      deadlineType: db.deadline_type,
      priority: db.priority,
      status: db.status,
      reminders: db.reminders || [],
      calendarEventId: db.calendar_event_id,
      completedAt: db.completed_at ? new Date(db.completed_at) : undefined,
      createdAt: new Date(db.created_at),
      updatedAt: new Date(db.updated_at)
    };
  }
}