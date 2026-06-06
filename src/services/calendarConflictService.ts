import { supabase } from '../core/supabaseClient';
import { logger } from '../core/logger';
import { CalendarEventService, CalendarEvent } from './calendarEventService';

export interface CalendarConflict {
  id: string;
  userId: string;
  eventId: string;
  conflictingEventId: string;
  conflictType: 'overlap' | 'double_booking' | 'resource_conflict';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestedResolution?: string;
  resolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface ConflictCheckOptions {
  userId: string;
  startTime: Date;
  endTime: Date;
  excludeEventId?: string;
  checkAttendees?: boolean;
  checkResources?: boolean;
}

export class CalendarConflictService {
  /**
   * Check for conflicts when scheduling a new event
   */
  static async checkConflicts(options: ConflictCheckOptions): Promise<CalendarConflict[]> {
    const conflicts: CalendarConflict[] = [];

    // Get existing events in the time range
    const existingEvents = await CalendarEventService.getEvents({
      startDate: new Date(options.startTime.getTime() - 60 * 60 * 1000), // 1 hour buffer
      endDate: new Date(options.endTime.getTime() + 60 * 60 * 1000)
    });

    // Filter events for the user and exclude the event being checked if updating
    const userEvents = existingEvents.filter(event =>
      !options.excludeEventId || event.id !== options.excludeEventId
    );

    // Check for time overlaps
    for (const existingEvent of userEvents) {
      if (this.eventsOverlap(options.startTime, options.endTime, existingEvent.startTime, existingEvent.endTime)) {
        conflicts.push({
          id: `conflict-${Date.now()}-${Math.random()}`,
          userId: options.userId,
          eventId: options.excludeEventId || 'new-event',
          conflictingEventId: existingEvent.id,
          conflictType: 'overlap',
          severity: this.calculateConflictSeverity(existingEvent),
          description: `Conflicts with "${existingEvent.title}" from ${existingEvent.startTime.toLocaleString()} to ${existingEvent.endTime.toLocaleString()}`,
          suggestedResolution: this.suggestResolution(existingEvent, options),
          resolved: false,
          createdAt: new Date()
        });
      }
    }

    // Check attendee conflicts if requested
    if (options.checkAttendees) {
      // This would require getting attendee calendars - simplified for now
      const attendeeConflicts = await this.checkAttendeeConflicts(options);
      conflicts.push(...attendeeConflicts);
    }

    return conflicts;
  }

  /**
   * Resolve a conflict
   */
  static async resolveConflict(
    conflictId: string,
    resolution: 'ignore' | 'reschedule' | 'cancel' | 'accept',
    userId: string
  ): Promise<void> {
    // In a real implementation, this would update a conflicts table
    // For now, just log the resolution
    logger.info('Conflict resolved', { conflictId, resolution, userId });

    // Could send notifications or update event statuses based on resolution
  }

  /**
   * Get optimal meeting times avoiding conflicts
   */
  static async findOptimalMeetingTimes(
    userId: string,
    durationMinutes: number,
    preferredTimes: Date[],
    maxSuggestions: number = 5
  ): Promise<Date[]> {
    const suggestions: Date[] = [];

    for (const preferredTime of preferredTimes) {
      const endTime = new Date(preferredTime.getTime() + durationMinutes * 60 * 1000);

      const conflicts = await this.checkConflicts({
        userId,
        startTime: preferredTime,
        endTime,
        checkAttendees: false
      });

      if (conflicts.length === 0) {
        suggestions.push(preferredTime);
        if (suggestions.length >= maxSuggestions) break;
      }
    }

    return suggestions;
  }

  /**
   * Check if two time ranges overlap
   */
  private static eventsOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): boolean {
    return start1 < end2 && end1 > start2;
  }

  /**
   * Calculate conflict severity based on event type and priority
   */
  private static calculateConflictSeverity(event: CalendarEvent): 'low' | 'medium' | 'high' {
    if (event.eventType === 'deadline') return 'high';
    if (event.eventType === 'meeting') return 'medium';
    return 'low';
  }

  /**
   * Suggest resolution for a conflict
   */
  private static suggestResolution(conflictingEvent: CalendarEvent, newEvent: ConflictCheckOptions): string {
    const suggestions = [
      'Reschedule to a different time',
      'Make the meeting shorter',
      'Check if the conflicting event can be moved'
    ];

    // Prioritize based on event types
    if (conflictingEvent.eventType === 'deadline') {
      return 'The conflicting event is a deadline - consider rescheduling your meeting';
    }

    return suggestions[Math.floor(Math.random() * suggestions.length)];
  }

  /**
   * Check conflicts with attendee schedules (simplified)
   */
  private static async checkAttendeeConflicts(options: ConflictCheckOptions): Promise<CalendarConflict[]> {
    // This would integrate with external calendar APIs to check attendee availability
    // For now, return empty array
    return [];
  }

  /**
   * Get conflict statistics for dashboard
   */
  static async getConflictStats(userId: string): Promise<{
    totalConflicts: number;
    resolvedConflicts: number;
    unresolvedConflicts: number;
    averageResolutionTime: number;
  }> {
    // This would query a conflicts table
    // For now, return mock data
    return {
      totalConflicts: 0,
      resolvedConflicts: 0,
      unresolvedConflicts: 0,
      averageResolutionTime: 0
    };
  }
}