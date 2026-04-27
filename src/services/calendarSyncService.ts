import { supabase } from '../core/supabaseClient';
import { logger } from '../core/logger';
import { CalendarOAuthService } from './calendarOAuthService';
import { CalendarEventService } from './calendarEventService';

export interface CalendarSyncLog {
  id: string;
  integrationId: string;
  syncType: 'full' | 'incremental' | 'events_only';
  status: 'success' | 'partial' | 'failed';
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  errors: SyncError[];
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  createdAt: Date;
}

export interface SyncError {
  type: 'api_error' | 'conflict' | 'permission_denied' | 'rate_limit';
  message: string;
  eventId?: string;
  externalEventId?: string;
}

export interface SyncOptions {
  syncType?: 'full' | 'incremental' | 'events_only';
  dateRange?: {
    start: Date;
    end: Date;
  };
  forceResync?: boolean;
}

export class CalendarSyncService {
  /**
   * Sync calendar for a specific integration
   */
  static async syncCalendarIntegration(
    integrationId: string,
    options: SyncOptions = {}
  ): Promise<CalendarSyncLog> {
    const startedAt = new Date();
    let syncLog: Partial<CalendarSyncLog> = {
      integrationId,
      syncType: options.syncType || 'incremental',
      status: 'success',
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      errors: [],
      startedAt
    };

    try {
      // Get integration details
      const integrations = await CalendarOAuthService.getUserIntegrations('');
      const integration = integrations.find(i => i.id === integrationId);

      if (!integration) {
        throw new Error('Calendar integration not found');
      }

      if (!integration.settings.syncEnabled) {
        throw new Error('Calendar sync is disabled for this integration');
      }

      // Update sync status to syncing
      await supabase
        .from('calendar_integrations')
        .update({
          sync_status: 'syncing',
          updated_at: new Date().toISOString()
        })
        .eq('id', integrationId);

      if (integration.provider === 'google') {
        syncLog = await this.syncWithGoogleCalendar(integration, options, syncLog as CalendarSyncLog);
      } else if (integration.provider === 'outlook') {
        syncLog = await this.syncWithOutlookCalendar(integration, options, syncLog as CalendarSyncLog);
      } else {
        throw new Error(`Unsupported calendar provider: ${integration.provider}`);
      }

    } catch (error: any) {
      logger.error('Calendar sync failed', { integrationId, error });
      syncLog.status = 'failed';
      syncLog.errors!.push({
        type: 'api_error',
        message: error.message
      });
    }

    // Complete the sync
    const completedAt = new Date();
    syncLog.completedAt = completedAt;
    syncLog.durationMs = completedAt.getTime() - startedAt.getTime();

    // Save sync log
    const { data: savedLog, error: logError } = await supabase
      .from('calendar_sync_logs')
      .insert({
        integration_id: integrationId,
        sync_type: syncLog.syncType,
        status: syncLog.status,
        events_created: syncLog.eventsCreated,
        events_updated: syncLog.eventsUpdated,
        events_deleted: syncLog.eventsDeleted,
        errors: syncLog.errors,
        started_at: syncLog.startedAt!.toISOString(),
        completed_at: syncLog.completedAt!.toISOString(),
        duration_ms: syncLog.durationMs
      })
      .select()
      .single();

    if (logError) {
      logger.error('Failed to save sync log', { logError, integrationId });
    }

    // Update integration sync status
    await supabase
      .from('calendar_integrations')
      .update({
        sync_status: syncLog.status === 'failed' ? 'error' : 'idle',
        last_sync_at: completedAt.toISOString(),
        sync_error: syncLog.errors!.length > 0 ? syncLog.errors![0].message : null,
        updated_at: completedAt.toISOString()
      })
      .eq('id', integrationId);

    return savedLog as CalendarSyncLog;
  }

  /**
   * Sync with Google Calendar
   */
  private static async syncWithGoogleCalendar(
    integration: any,
    options: SyncOptions,
    syncLog: CalendarSyncLog
  ): Promise<CalendarSyncLog> {
    const accessToken = await CalendarOAuthService.getValidAccessToken(integration.id);

    // Determine sync time range
    const now = new Date();
    let syncStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    let syncEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days future

    if (options.dateRange) {
      syncStart = options.dateRange.start;
      syncEnd = options.dateRange.end;
    } else if (integration.lastSyncAt && !options.forceResync) {
      // For incremental sync, start from last sync
      syncStart = new Date(integration.lastSyncAt.getTime() - 24 * 60 * 60 * 1000); // 1 day buffer
    }

    try {
      // Get events from Google Calendar
      const googleEvents = await this.fetchGoogleCalendarEvents(
        integration.calendarId,
        accessToken,
        syncStart,
        syncEnd
      );

      // Sync events bidirectionally
      const result = await this.syncEventsBidirectionally(
        integration,
        googleEvents,
        syncStart,
        syncEnd
      );

      syncLog.eventsCreated = result.created;
      syncLog.eventsUpdated = result.updated;
      syncLog.eventsDeleted = result.deleted;
      syncLog.errors = result.errors;

      if (result.errors.length > 0) {
        syncLog.status = 'partial';
      }

    } catch (error: any) {
      syncLog.status = 'failed';
      syncLog.errors.push({
        type: 'api_error',
        message: `Google Calendar API error: ${error.message}`
      });
    }

    return syncLog;
  }

  /**
   * Sync with Outlook Calendar
   */
  private static async syncWithOutlookCalendar(
    integration: any,
    options: SyncOptions,
    syncLog: CalendarSyncLog
  ): Promise<CalendarSyncLog> {
    const accessToken = await CalendarOAuthService.getValidAccessToken(integration.id);

    // Determine sync time range
    const now = new Date();
    let syncStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    let syncEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days future

    if (options.dateRange) {
      syncStart = options.dateRange.start;
      syncEnd = options.dateRange.end;
    } else if (integration.lastSyncAt && !options.forceResync) {
      // For incremental sync, start from last sync
      syncStart = new Date(integration.lastSyncAt.getTime() - 24 * 60 * 60 * 1000); // 1 day buffer
    }

    try {
      // Get events from Outlook Calendar using Microsoft Graph API
      const outlookEvents = await this.fetchOutlookCalendarEvents(
        integration.calendarId,
        accessToken,
        syncStart,
        syncEnd
      );

      // Sync events bidirectionally
      const result = await this.syncEventsBidirectionally(
        integration,
        outlookEvents,
        syncStart,
        syncEnd
      );

      syncLog.eventsCreated = result.created;
      syncLog.eventsUpdated = result.updated;
      syncLog.eventsDeleted = result.deleted;
      syncLog.errors = result.errors;

      if (result.errors.length > 0) {
        syncLog.status = 'partial';
      }

    } catch (error: any) {
      syncLog.status = 'failed';
      syncLog.errors.push({
        type: 'api_error',
        message: `Outlook Calendar API error: ${error.message}`
      });
    }

    return syncLog;
  }

  /**
   * Fetch events from Google Calendar
   */
  private static async fetchGoogleCalendarEvents(
    calendarId: string,
    accessToken: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    const params = new URLSearchParams({
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime'
    });

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  }

  /**
   * Fetch events from Outlook Calendar using Microsoft Graph API
   */
  private static async fetchOutlookCalendarEvents(
    calendarId: string,
    accessToken: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const url = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`;

    const params = new URLSearchParams({
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
      $orderby: 'start/dateTime'
    });

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Microsoft Graph API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.value || [];
  }

  /**
   * Sync events bidirectionally between CRM and external calendar
   */
  private static async syncEventsBidirectionally(
    integration: any,
    externalEvents: any[],
    syncStart: Date,
    syncEnd: Date
  ): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: SyncError[];
  }> {
    const result = { created: 0, updated: 0, deleted: 0, errors: [] as SyncError[] };

    // Get existing CRM events in the sync range
    const crmEvents = await CalendarEventService.getEvents({
      startDate: syncStart,
      endDate: syncEnd
    });

    const crmEventsByExternalId = new Map();
    const externalEventsById = new Map();

    // Index CRM events by external ID
    crmEvents
      .filter(e => e.integrationId === integration.id)
      .forEach(event => {
        if (event.externalEventId) {
          crmEventsByExternalId.set(event.externalEventId, event);
        }
      });

    // Index external events by ID
    externalEvents.forEach(event => {
      externalEventsById.set(event.id, event);
    });

    // Process external events
    for (const externalEvent of externalEvents) {
      try {
        const existingCrmEvent = crmEventsByExternalId.get(externalEvent.id);

        if (existingCrmEvent) {
          // Update existing event if changed
          if (this.hasEventChanged(existingCrmEvent, externalEvent, integration.provider)) {
            await this.updateCrmEventFromExternal(existingCrmEvent.id, externalEvent, integration.provider);
            result.updated++;
          }
        } else {
          // Create new event in CRM
          await this.createCrmEventFromExternal(integration, externalEvent);
          result.created++;
        }
      } catch (error: any) {
        result.errors.push({
          type: 'api_error',
          message: `Failed to sync external event ${externalEvent.id}: ${error.message}`,
          externalEventId: externalEvent.id
        });
      }
    }

    // Check for deleted external events
    for (const [externalId, crmEvent] of crmEventsByExternalId) {
      if (!externalEventsById.has(externalId)) {
        try {
          // Event was deleted from external calendar, delete from CRM too
          await CalendarEventService.deleteEvent(crmEvent.id, ''); // userId not needed for sync
          result.deleted++;
        } catch (error: any) {
          result.errors.push({
            type: 'api_error',
            message: `Failed to delete CRM event ${crmEvent.id}: ${error.message}`,
            eventId: crmEvent.id,
            externalEventId: externalId
          });
        }
      }
    }

    // Sync CRM events back to external calendar (if bidirectional enabled)
    if (integration.settings.bidirectionalSync) {
      for (const crmEvent of crmEvents) {
        if (crmEvent.integrationId === integration.id && !crmEvent.externalEventId) {
          try {
            await CalendarEventService.syncEventToExternal(crmEvent.id, integration.id);
            result.created++; // Count as created in external calendar
          } catch (error: any) {
            result.errors.push({
              type: 'api_error',
              message: `Failed to sync CRM event ${crmEvent.id} to external calendar: ${error.message}`,
              eventId: crmEvent.id
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Check if CRM event has changed compared to external event
   */
  private static hasEventChanged(crmEvent: any, externalEvent: any, provider: string): boolean {
    // Compare basic fields - handle different provider formats
    const crmStart = crmEvent.startTime.toISOString();
    let externalStart: string;
    let externalEnd: string;
    let externalTitle: string;

    if (provider === 'google') {
      externalStart = externalEvent.start?.dateTime || externalEvent.start?.date;
      externalEnd = externalEvent.end?.dateTime || externalEvent.end?.date;
      externalTitle = externalEvent.summary;
    } else if (provider === 'outlook') {
      externalStart = externalEvent.start?.dateTime;
      externalEnd = externalEvent.end?.dateTime;
      externalTitle = externalEvent.subject;
    } else {
      return false; // Unknown provider
    }

    const crmEnd = crmEvent.endTime.toISOString();
    const crmTitle = crmEvent.title;

    return crmStart !== externalStart ||
           crmEnd !== externalEnd ||
           crmTitle !== externalTitle;
  }

  /**
   * Update CRM event from external event data
   */
  private static async updateCrmEventFromExternal(crmEventId: string, externalEvent: any, provider: string): Promise<void> {
    let updates: any = {
      updated_at: new Date().toISOString()
    };

    if (provider === 'google') {
      updates = {
        ...updates,
        title: externalEvent.summary || 'Untitled Event',
        description: externalEvent.description,
        location: externalEvent.location
      };

      // Parse start time
      if (externalEvent.start?.dateTime) {
        updates.start_time = externalEvent.start.dateTime;
        updates.timezone = externalEvent.start.timeZone || 'UTC';
      } else if (externalEvent.start?.date) {
        // All-day event
        updates.start_time = `${externalEvent.start.date}T00:00:00Z`;
        updates.timezone = 'UTC';
      }

      // Parse end time
      if (externalEvent.end?.dateTime) {
        updates.end_time = externalEvent.end.dateTime;
      } else if (externalEvent.end?.date) {
        updates.end_time = `${externalEvent.end.date}T23:59:59Z`;
      }

      // Update attendees
      if (externalEvent.attendees) {
        updates.attendees = externalEvent.attendees.map((a: any) => ({
          email: a.email,
          name: a.displayName,
          status: this.mapGoogleAttendeeStatus(a.responseStatus)
        }));
      }
    } else if (provider === 'outlook') {
      updates = {
        ...updates,
        title: externalEvent.subject || 'Untitled Event',
        description: externalEvent.bodyPreview || externalEvent.body?.content,
        location: externalEvent.location?.displayName
      };

      // Parse start time
      if (externalEvent.start?.dateTime) {
        updates.start_time = externalEvent.start.dateTime;
        updates.timezone = externalEvent.start.timeZone || 'UTC';
      }

      // Parse end time
      if (externalEvent.end?.dateTime) {
        updates.end_time = externalEvent.end.dateTime;
      }

      // Update attendees
      if (externalEvent.attendees) {
        updates.attendees = externalEvent.attendees.map((a: any) => ({
          email: a.emailAddress?.address,
          name: a.emailAddress?.name,
          status: this.mapOutlookAttendeeStatus(a.status?.response)
        }));
      }
    }

    await supabase
      .from('calendar_events')
      .update(updates)
      .eq('id', crmEventId);
  }

  /**
   * Create CRM event from external event data
   */
  private static async createCrmEventFromExternal(integration: any, externalEvent: any): Promise<void> {
    let eventData: any = {
      integration_id: integration.id,
      external_event_id: externalEvent.id,
      status: 'confirmed',
      event_type: 'meeting',
      metadata: {
        source: 'external_sync',
        external_provider: integration.provider
      }
    };

    if (integration.provider === 'google') {
      eventData = {
        ...eventData,
        title: externalEvent.summary || 'Untitled Event',
        description: externalEvent.description,
        location: externalEvent.location,
        status: externalEvent.status === 'cancelled' ? 'cancelled' : 'confirmed'
      };

      // Parse start time
      if (externalEvent.start?.dateTime) {
        eventData.start_time = externalEvent.start.dateTime;
        eventData.timezone = externalEvent.start.timeZone || 'UTC';
      } else if (externalEvent.start?.date) {
        eventData.start_time = `${externalEvent.start.date}T00:00:00Z`;
        eventData.timezone = 'UTC';
      }

      // Parse end time
      if (externalEvent.end?.dateTime) {
        eventData.end_time = externalEvent.end.dateTime;
      } else if (externalEvent.end?.date) {
        eventData.end_time = `${externalEvent.end.date}T23:59:59Z`;
      }

      // Add attendees
      if (externalEvent.attendees) {
        eventData.attendees = externalEvent.attendees.map((a: any) => ({
          email: a.email,
          name: a.displayName,
          status: this.mapGoogleAttendeeStatus(a.responseStatus)
        }));
      }
    } else if (integration.provider === 'outlook') {
      eventData = {
        ...eventData,
        title: externalEvent.subject || 'Untitled Event',
        description: externalEvent.bodyPreview || externalEvent.body?.content,
        location: externalEvent.location?.displayName,
        status: externalEvent.isCancelled ? 'cancelled' : 'confirmed'
      };

      // Parse start time
      if (externalEvent.start?.dateTime) {
        eventData.start_time = externalEvent.start.dateTime;
        eventData.timezone = externalEvent.start.timeZone || 'UTC';
      }

      // Parse end time
      if (externalEvent.end?.dateTime) {
        eventData.end_time = externalEvent.end.dateTime;
      }

      // Add attendees
      if (externalEvent.attendees) {
        eventData.attendees = externalEvent.attendees.map((a: any) => ({
          email: a.emailAddress?.address,
          name: a.emailAddress?.name,
          status: this.mapOutlookAttendeeStatus(a.status?.response)
        }));
      }
    }

    await supabase
      .from('calendar_events')
      .insert(eventData);
  }

  /**
   * Map Google Calendar attendee status to our format
   */
  private static mapGoogleAttendeeStatus(status: string): string {
    switch (status) {
      case 'accepted': return 'accepted';
      case 'declined': return 'declined';
      case 'tentative': return 'tentative';
      default: return 'pending';
    }
  }

  /**
   * Map Outlook Calendar attendee status to our format
   */
  private static mapOutlookAttendeeStatus(status?: string): string {
    switch (status) {
      case 'accepted': return 'accepted';
      case 'declined': return 'declined';
      case 'tentativelyAccepted': return 'tentative';
      default: return 'pending';
    }
  }

  /**
   * Get sync logs for an integration
   */
  static async getSyncLogs(
    integrationId: string,
    limit: number = 20
  ): Promise<CalendarSyncLog[]> {
    const { data, error } = await supabase
      .from('calendar_sync_logs')
      .select('*')
      .eq('integration_id', integrationId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to get sync logs', { error, integrationId });
      throw new Error('Failed to get sync logs');
    }

    return data.map(this.mapDbToSyncLog);
  }

  /**
   * Run sync for all active integrations
   */
  static async syncAllIntegrations(): Promise<CalendarSyncLog[]> {
    const { data: integrations } = await supabase
      .from('calendar_integrations')
      .select('id')
      .eq('is_active', true)
      .eq('sync_status', 'idle');

    const results: CalendarSyncLog[] = [];

    for (const integration of integrations || []) {
      try {
        const result = await this.syncCalendarIntegration(integration.id);
        results.push(result);
      } catch (error) {
        logger.error('Failed to sync integration', { integrationId: integration.id, error });
      }
    }

    return results;
  }

  private static mapDbToSyncLog(db: any): CalendarSyncLog {
    return {
      id: db.id,
      integrationId: db.integration_id,
      syncType: db.sync_type,
      status: db.status,
      eventsCreated: db.events_created,
      eventsUpdated: db.events_updated,
      eventsDeleted: db.events_deleted,
      errors: db.errors || [],
      startedAt: new Date(db.started_at),
      completedAt: db.completed_at ? new Date(db.completed_at) : undefined,
      durationMs: db.duration_ms,
      createdAt: new Date(db.created_at)
    };
  }
}