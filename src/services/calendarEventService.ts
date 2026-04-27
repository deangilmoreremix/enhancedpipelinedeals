import { supabase } from '../core/supabaseClient';
import { logger } from '../core/logger';
import { CalendarOAuthService } from './calendarOAuthService';

export interface CalendarEvent {
  id: string;
  dealId?: string;
  contactId?: string;
  integrationId?: string;
  externalEventId?: string;
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
    // Check if we should sync with external calendar
    const integrations = await CalendarOAuthService.getUserIntegrations(userId);
    const activeIntegration = integrations.find(i => i.settings.syncEnabled);

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

    // Sync with external calendar if integration exists
    if (activeIntegration) {
      try {
        await this.syncEventToExternal(event.id, activeIntegration.id);
      } catch (syncError) {
        logger.warn('Failed to sync event to external calendar', { eventId: event.id, syncError });
        // Don't fail the event creation if sync fails
      }
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

    // Sync with external calendar if integration exists
    if (event.integration_id) {
      try {
        await this.syncEventToExternal(eventId, event.integration_id);
      } catch (syncError) {
        logger.warn('Failed to sync updated event to external calendar', { eventId, syncError });
      }
    }

    return this.mapDbToEvent(event);
  }

  /**
   * Delete a calendar event
   */
  static async deleteEvent(eventId: string, userId: string): Promise<void> {
    // Get event details before deletion for external sync
    const { data: event } = await supabase
      .from('calendar_events')
      .select('integration_id, external_event_id')
      .eq('id', eventId)
      .single();

    // Delete from database
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId);

    if (error) {
      logger.error('Failed to delete calendar event', { error, eventId, userId });
      throw new Error('Failed to delete calendar event');
    }

    // Delete from external calendar if it exists
    if (event?.integration_id && event?.external_event_id) {
      try {
        await this.deleteEventFromExternal(event.external_event_id, event.integration_id);
      } catch (syncError) {
        logger.warn('Failed to delete event from external calendar', { eventId, syncError });
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

  /**
   * Sync event to external calendar
   */
  private static async syncEventToExternal(eventId: string, integrationId: string): Promise<void> {
    const accessToken = await CalendarOAuthService.getValidAccessToken(integrationId);

    // Get integration details
    const { data: integration } = await supabase
      .from('calendar_integrations')
      .select('provider, calendar_id')
      .eq('id', integrationId)
      .single();

    if (!integration) {
      throw new Error('Calendar integration not found');
    }

    // Get event details
    const { data: event } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event) {
      throw new Error('Event not found');
    }

    if (integration.provider === 'google') {
      await this.syncToGoogleCalendar(event, integration, accessToken);
    } else if (integration.provider === 'outlook') {
      await this.syncToOutlookCalendar(event, integration, accessToken);
    } else {
      throw new Error(`Unsupported calendar provider: ${integration.provider}`);
    }
  }

  private static async syncToGoogleCalendar(
    event: any,
    integration: any,
    accessToken: string
  ): Promise<void> {
    const googleEvent = {
      summary: event.title,
      description: event.description,
      start: {
        dateTime: event.start_time,
        timeZone: event.timezone
      },
      end: {
        dateTime: event.end_time,
        timeZone: event.timezone
      },
      location: event.location,
      attendees: event.attendees?.map((a: any) => ({
        email: a.email,
        displayName: a.name,
        responseStatus: a.status === 'accepted' ? 'accepted' :
                       a.status === 'declined' ? 'declined' :
                       a.status === 'tentative' ? 'tentative' : 'needsAction'
      })),
      reminders: {
        useDefault: false,
        overrides: event.reminders?.map((r: any) => ({
          method: r.type.toUpperCase(),
          minutes: r.minutesBefore
        })) || []
      }
    };

    const url = event.external_event_id
      ? `https://www.googleapis.com/calendar/v3/calendars/${integration.calendar_id}/events/${event.external_event_id}`
      : `https://www.googleapis.com/calendar/v3/calendars/${integration.calendar_id}/events`;

    const method = event.external_event_id ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(googleEvent)
    });

    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status}`);
    }

    const googleEventData = await response.json();

    // Update event with external ID if this was a create
    if (!event.external_event_id) {
      await supabase
        .from('calendar_events')
        .update({
          external_event_id: googleEventData.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', event.id);
    }
  }

  private static async syncToOutlookCalendar(
    event: any,
    integration: any,
    accessToken: string
  ): Promise<void> {
    const outlookEvent = {
      subject: event.title,
      body: {
        contentType: 'text',
        content: event.description || ''
      },
      start: {
        dateTime: event.start_time,
        timeZone: event.timezone
      },
      end: {
        dateTime: event.end_time,
        timeZone: event.timezone
      },
      location: {
        displayName: event.location || ''
      },
      attendees: event.attendees?.map((a: any) => ({
        emailAddress: {
          address: a.email,
          name: a.name
        },
        type: 'required'
      })) || [],
      reminders: {
        isReminderOn: true,
        reminderMinutesBeforeStart: event.reminders?.[0]?.minutesBefore || 15
      }
    };

    const url = event.external_event_id
      ? `https://graph.microsoft.com/v1.0/me/calendars/${integration.calendar_id}/events/${event.external_event_id}`
      : `https://graph.microsoft.com/v1.0/me/calendars/${integration.calendar_id}/events`;

    const method = event.external_event_id ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(outlookEvent)
    });

    if (!response.ok) {
      throw new Error(`Microsoft Graph API error: ${response.status}`);
    }

    const outlookEventData = await response.json();

    // Update event with external ID if this was a create
    if (!event.external_event_id) {
      await supabase
        .from('calendar_events')
        .update({
          external_event_id: outlookEventData.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', event.id);
    }
  }

  private static async deleteEventFromExternal(
    externalEventId: string,
    integrationId: string
  ): Promise<void> {
    const accessToken = await CalendarOAuthService.getValidAccessToken(integrationId);

    const { data: integration } = await supabase
      .from('calendar_integrations')
      .select('provider, calendar_id')
      .eq('id', integrationId)
      .single();

    if (!integration) return;

    let url: string;
    if (integration.provider === 'google') {
      url = `https://www.googleapis.com/calendar/v3/calendars/${integration.calendar_id}/events/${externalEventId}`;
    } else if (integration.provider === 'outlook') {
      url = `https://graph.microsoft.com/v1.0/me/calendars/${integration.calendar_id}/events/${externalEventId}`;
    } else {
      throw new Error(`Unsupported calendar provider: ${integration.provider}`);
    }

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete event from ${integration.provider} calendar: ${response.status}`);
    }
  }

  private static mapDbToEvent(db: any): CalendarEvent {
    return {
      id: db.id,
      dealId: db.deal_id,
      contactId: db.contact_id,
      integrationId: db.integration_id,
      externalEventId: db.external_event_id,
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