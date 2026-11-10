import { supabase } from '../lib/core/supabaseClient';
import { logger } from '../lib/core/logger';

export interface CalendarEvent {
  id: string;
  dealId?: string;
  contactId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  location?: string;
  meetingUrl?: string;
  attendees: CalendarAttendee[];
  status: 'confirmed' | 'tentative' | 'cancelled';
  eventType: 'meeting' | 'deadline' | 'followup' | 'reminder';
  recurrenceRule?: string;
  reminders: CalendarReminder[];
  metadata: Record<string, any>;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarAttendee {
  email: string;
  name?: string;
  status: 'pending' | 'accepted' | 'declined' | 'tentative';
}

export interface CalendarReminder {
  type: 'email' | 'popup';
  minutesBefore: number;
}

export interface CreateEventRequest {
  dealId?: string;
  contactId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timezone?: string;
  location?: string;
  meetingUrl?: string;
  attendees?: Omit<CalendarAttendee, 'status'>[];
  eventType?: 'meeting' | 'deadline' | 'followup' | 'reminder';
  recurrenceRule?: string;
  reminders?: CalendarReminder[];
  metadata?: Record<string, any>;
}

export class CalendarEventService {
  /**
   * Create a new calendar event
   */
  static async createEvent(
    userId: string,
    request: CreateEventRequest
  ): Promise<CalendarEvent> {
    const eventData = {
      deal_id: request.dealId,
      contact_id: request.contactId,
      title: request.title,
      description: request.description,
      start_time: request.startTime.toISOString(),
      end_time: request.endTime.toISOString(),
      timezone: request.timezone || 'UTC',
      location: request.location,
      meeting_url: request.meetingUrl,
      attendees: request.attendees?.map(a => ({ ...a, status: 'pending' })) || [],
      event_type: request.eventType || 'meeting',
      recurrence_rule: request.recurrenceRule,
      reminders: request.reminders || [],
      metadata: request.metadata || {},
      created_by: userId
    };

    const { data: event, error } = await supabase
      .from('calendar_events')
      .insert(eventData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create calendar event', { error, userId, request });
      throw new Error('Failed to create calendar event');
    }

    return this.mapDbToEvent(event);
  }

  /**
   * Update an existing calendar event
   */
  static async updateEvent(
    eventId: string,
    userId: string,
    updates: Partial<CreateEventRequest>
  ): Promise<CalendarEvent> {
    const updateData: any = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.startTime) updateData.start_time = updates.startTime.toISOString();
    if (updates.endTime) updateData.end_time = updates.endTime.toISOString();
    if (updates.timezone) updateData.timezone = updates.timezone;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.meetingUrl !== undefined) updateData.meeting_url = updates.meetingUrl;
    if (updates.attendees) updateData.attendees = updates.attendees.map(a => ({ ...a, status: 'pending' }));
    if (updates.eventType) updateData.event_type = updates.eventType;
    if (updates.recurrenceRule !== undefined) updateData.recurrence_rule = updates.recurrenceRule;
    if (updates.reminders) updateData.reminders = updates.reminders;
    if (updates.metadata) updateData.metadata = updates.metadata;

    const { data: event, error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update calendar event', { error, eventId, userId });
      throw new Error('Failed to update calendar event');
    }

    return this.mapDbToEvent(event);
  }

  /**
   * Delete a calendar event
   */
  static async deleteEvent(eventId: string, userId: string): Promise<void> {
    // Delete from database
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId);

    if (error) {
      logger.error('Failed to delete calendar event', { error, eventId, userId });
      throw new Error('Failed to delete calendar event');
    }
  }
    }
  }

  /**
   * Get calendar events for a user/deal/contact
   */
  static async getEvents(filters: {
    userId?: string;
    dealId?: string;
    contactId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    limit?: number;
  } = {}): Promise<CalendarEvent[]> {
    let query = supabase
      .from('calendar_events')
      .select('*')
      .order('start_time', { ascending: true });

    if (filters.dealId) {
      query = query.eq('deal_id', filters.dealId);
    }

    if (filters.contactId) {
      query = query.eq('contact_id', filters.contactId);
    }

    if (filters.startDate) {
      query = query.gte('start_time', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('start_time', filters.endDate.toISOString());
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to get calendar events', { error, filters });
      throw new Error('Failed to load calendar events');
    }

    return data.map(this.mapDbToEvent);
  }

  /**
   * Schedule a meeting from a deal context
   */
  static async scheduleMeetingFromDeal(
    dealId: string,
    userId: string,
    options: {
      title?: string;
      description?: string;
      startTime: Date;
      durationMinutes?: number;
      includeContact?: boolean;
      additionalAttendees?: string[];
    }
  ): Promise<CalendarEvent> {
    // Get deal and contact information
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select(`
        id,
        value,
        stage,
        contacts:contact_id (
          id,
          name,
          email
        )
      `)
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      throw new Error('Deal not found');
    }

    const contact = deal.contacts;
    const attendees: Omit<CalendarAttendee, 'status'>[] = [];

    // Add contact as attendee if requested
    if (options.includeContact && contact?.email) {
      attendees.push({
        email: contact.email,
        name: contact.name
      });
    }

    // Add additional attendees
    if (options.additionalAttendees) {
      attendees.push(...options.additionalAttendees.map(email => ({ email })));
    }

    const title = options.title || `Meeting about ${contact?.name || 'Deal'}`;
    const description = options.description || `Deal discussion - $${deal.value} value, ${deal.stage} stage`;
    const duration = options.durationMinutes || 60;
    const endTime = new Date(options.startTime.getTime() + duration * 60 * 1000);

    return this.createEvent(userId, {
      dealId,
      contactId: contact?.id,
      title,
      description,
      startTime: options.startTime,
      endTime,
      attendees,
      eventType: 'meeting',
      metadata: {
        source: 'deal_scheduling',
        dealStage: deal.stage,
        dealValue: deal.value
      }
    });
  }

  private static mapDbToEvent(db: any): CalendarEvent {
    return {
      id: db.id,
      dealId: db.deal_id,
      contactId: db.contact_id,
      title: db.title,
      description: db.description,
      startTime: new Date(db.start_time),
      endTime: new Date(db.end_time),
      timezone: db.timezone,
      location: db.location,
      meetingUrl: db.meeting_url,
      attendees: db.attendees || [],
      status: db.status,
      eventType: db.event_type,
      recurrenceRule: db.recurrence_rule,
      reminders: db.reminders || [],
      metadata: db.metadata || {},
      createdBy: db.created_by,
      createdAt: new Date(db.created_at),
      updatedAt: new Date(db.updated_at)
    };
  }
}