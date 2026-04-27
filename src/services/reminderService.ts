import { supabase } from '../core/supabaseClient';
import { logger } from '../core/logger';

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  description?: string;
  remindAt: Date;
  reminderType: 'notification' | 'email' | 'calendar_event';
  relatedType?: 'deal' | 'contact' | 'calendar_event' | 'deadline';
  relatedId?: string;
  status: 'pending' | 'sent' | 'cancelled';
  sentAt?: Date;
  deliveryMethod: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReminderRequest {
  userId: string;
  title: string;
  description?: string;
  remindAt: Date;
  reminderType?: 'notification' | 'email' | 'calendar_event';
  relatedType?: 'deal' | 'contact' | 'calendar_event' | 'deadline';
  relatedId?: string;
  deliveryMethod?: string;
  metadata?: Record<string, any>;
}

export class ReminderService {
  /**
   * Create a new reminder
   */
  static async createReminder(request: CreateReminderRequest): Promise<Reminder> {
    const reminderData = {
      user_id: request.userId,
      title: request.title,
      description: request.description,
      remind_at: request.remindAt.toISOString(),
      reminder_type: request.reminderType || 'notification',
      related_type: request.relatedType,
      related_id: request.relatedId,
      status: 'pending',
      delivery_method: request.deliveryMethod || 'in_app',
      metadata: request.metadata || {}
    };

    const { data: reminder, error } = await supabase
      .from('reminders')
      .insert(reminderData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create reminder', { error, request });
      throw new Error('Failed to create reminder');
    }

    return this.mapDbToReminder(reminder);
  }

  /**
   * Update reminder status
   */
  static async updateReminderStatus(
    reminderId: string,
    status: 'pending' | 'sent' | 'cancelled',
    sentAt?: Date
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (sentAt) {
      updateData.sent_at = sentAt.toISOString();
    }

    const { error } = await supabase
      .from('reminders')
      .update(updateData)
      .eq('id', reminderId);

    if (error) {
      logger.error('Failed to update reminder status', { error, reminderId, status });
      throw new Error('Failed to update reminder status');
    }
  }

  /**
   * Cancel reminders for a related entity
   */
  static async cancelRemindersForRelatedId(relatedId: string): Promise<void> {
    const { error } = await supabase
      .from('reminders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('related_id', relatedId)
      .eq('status', 'pending');

    if (error) {
      logger.error('Failed to cancel reminders', { error, relatedId });
      throw new Error('Failed to cancel reminders');
    }
  }

  /**
   * Get pending reminders that are due
   */
  static async getDueReminders(limit: number = 50): Promise<Reminder[]> {
    const now = new Date();

    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('remind_at', now.toISOString())
      .order('remind_at', { ascending: true })
      .limit(limit);

    if (error) {
      logger.error('Failed to get due reminders', { error });
      throw new Error('Failed to get due reminders');
    }

    return data.map(this.mapDbToReminder);
  }

  /**
   * Process due reminders (send notifications/emails)
   */
  static async processDueReminders(): Promise<number> {
    const dueReminders = await this.getDueReminders(100);
    let processedCount = 0;

    for (const reminder of dueReminders) {
      try {
        await this.sendReminder(reminder);
        await this.updateReminderStatus(reminder.id, 'sent', new Date());
        processedCount++;
      } catch (error) {
        logger.error('Failed to process reminder', { reminderId: reminder.id, error });
        // Mark as failed but don't retry immediately
        await this.updateReminderStatus(reminder.id, 'cancelled');
      }
    }

    if (processedCount > 0) {
      logger.info(`Processed ${processedCount} reminders`);
    }

    return processedCount;
  }

  /**
   * Send a reminder notification
   */
  private static async sendReminder(reminder: Reminder): Promise<void> {
    switch (reminder.reminderType) {
      case 'email':
        await this.sendEmailReminder(reminder);
        break;
      case 'notification':
        await this.sendInAppNotification(reminder);
        break;
      case 'calendar_event':
        await this.sendCalendarReminder(reminder);
        break;
      default:
        logger.warn('Unknown reminder type', { reminderId: reminder.id, type: reminder.reminderType });
    }
  }

  /**
   * Send email reminder
   */
  private static async sendEmailReminder(reminder: Reminder): Promise<void> {
    // Get user email
    const { data: user } = await supabase
      .from('users') // Assuming there's a users table
      .select('email')
      .eq('id', reminder.userId)
      .single();

    if (!user?.email) {
      throw new Error('User email not found');
    }

    // Get related entity details for context
    let context = '';
    if (reminder.relatedType && reminder.relatedId) {
      context = await this.getRelatedEntityContext(reminder.relatedType, reminder.relatedId);
    }

    // Send email using email service
    const emailService = await import('./emailService');
    await emailService.EmailService.sendEmail({
      to: user.email,
      subject: `Reminder: ${reminder.title}`,
      body: `
        <h2>${reminder.title}</h2>
        ${reminder.description ? `<p>${reminder.description}</p>` : ''}
        ${context ? `<p><strong>Context:</strong> ${context}</p>` : ''}
        <p>This reminder was scheduled for ${reminder.remindAt.toLocaleString()}.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated reminder from your CRM system.</p>
      `
    });
  }

  /**
   * Send in-app notification
   */
  private static async sendInAppNotification(reminder: Reminder): Promise<void> {
    // Create an in-app notification record
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: reminder.userId,
        type: 'reminder',
        title: reminder.title,
        message: reminder.description || 'You have a reminder',
        metadata: {
          reminderId: reminder.id,
          relatedType: reminder.relatedType,
          relatedId: reminder.relatedId
        }
      });

    if (error) {
      logger.error('Failed to create in-app notification', { error, reminderId: reminder.id });
      throw error;
    }

    // TODO: Send real-time notification via WebSocket or push notification service
  }

  /**
   * Send calendar reminder (could trigger calendar popup)
   */
  private static async sendCalendarReminder(reminder: Reminder): Promise<void> {
    // For calendar reminders, we could integrate with external calendar systems
    // For now, just send an in-app notification
    await this.sendInAppNotification(reminder);
  }

  /**
   * Get context information about the related entity
   */
  private static async getRelatedEntityContext(type: string, id: string): Promise<string> {
    switch (type) {
      case 'deal':
        const { data: deal } = await supabase
          .from('deals')
          .select('title, stage, value, contacts(name)')
          .eq('id', id)
          .single();
        return deal ? `${deal.title} (${deal.stage}, $${deal.value}) - ${deal.contacts?.name || 'Unknown contact'}` : 'Unknown deal';

      case 'contact':
        const { data: contact } = await supabase
          .from('contacts')
          .select('name, company')
          .eq('id', id)
          .single();
        return contact ? `${contact.name}${contact.company ? ` at ${contact.company}` : ''}` : 'Unknown contact';

      case 'deadline':
        const { data: deadline } = await supabase
          .from('deal_deadlines')
          .select('title, deadline_at')
          .eq('id', id)
          .single();
        return deadline ? `${deadline.title} due ${new Date(deadline.deadline_at).toLocaleDateString()}` : 'Unknown deadline';

      default:
        return '';
    }
  }

  /**
   * Get reminders for a user
   */
  static async getUserReminders(
    userId: string,
    filters: {
      status?: string;
      reminderType?: string;
      limit?: number;
    } = {}
  ): Promise<Reminder[]> {
    let query = supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .order('remind_at', { ascending: true });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.reminderType) {
      query = query.eq('reminder_type', filters.reminderType);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to get user reminders', { error, userId, filters });
      throw new Error('Failed to load reminders');
    }

    return data.map(this.mapDbToReminder);
  }

  private static mapDbToReminder(db: any): Reminder {
    return {
      id: db.id,
      userId: db.user_id,
      title: db.title,
      description: db.description,
      remindAt: new Date(db.remind_at),
      reminderType: db.reminder_type,
      relatedType: db.related_type,
      relatedId: db.related_id,
      status: db.status,
      sentAt: db.sent_at ? new Date(db.sent_at) : undefined,
      deliveryMethod: db.delivery_method,
      metadata: db.metadata || {},
      createdAt: new Date(db.created_at),
      updatedAt: new Date(db.updated_at)
    };
  }
}