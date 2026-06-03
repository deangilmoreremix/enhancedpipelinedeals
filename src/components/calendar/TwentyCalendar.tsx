import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CalendarEventService, CalendarEvent } from '../../services/calendarEventService';
import { DealDeadlineService, DealDeadline } from '../../services/dealDeadlineService';
import { CalendarOAuthService } from '../../services/calendarOAuthService';
import { ReminderService } from '../../services/reminderService';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Calendar as CalendarIcon, Plus, Settings, Sync, Users, Clock, MapPin } from 'lucide-react';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: {
    'en-US': enUS,
  },
});

interface CalendarIntegration {
  id: string;
  provider: 'google' | 'outlook' | 'apple';
  email: string;
  settings: {
    syncEnabled: boolean;
    bidirectionalSync: boolean;
    defaultReminderMinutes: number;
    autoCreateEvents: boolean;
  };
  syncStatus: 'idle' | 'syncing' | 'error';
  syncError?: string;
  isActive: boolean;
}

interface TwentyCalendarProps {
  userId: string;
  dealId?: string; // Optional: show only events for this deal
  contactId?: string; // Optional: show only events for this contact
  onEventSelect?: (event: CalendarEvent) => void;
  onCreateEvent?: (eventData: any) => void;
  className?: string;
}

export const TwentyCalendar: React.FC<TwentyCalendarProps> = ({
  userId,
  dealId,
  contactId,
  onEventSelect,
  onCreateEvent,
  className = ''
}) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [deadlines, setDeadlines] = useState<DealDeadline[]>([]);
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Feature flags
  const calendarPhase6Enabled = useFeatureFlag('twenty_calendar_phase6');
  const oauthGoogleEnabled = useFeatureFlag('calendar_oauth_google');
  const oauthOutlookEnabled = useFeatureFlag('calendar_oauth_outlook');
  const meetingSchedulingEnabled = useFeatureFlag('calendar_meeting_scheduling');
  const eventLinkingEnabled = useFeatureFlag('calendar_event_linking');
  const dealDeadlinesEnabled = useFeatureFlag('deal_deadlines_calendar');

  // Load calendar data
  const loadCalendarData = useCallback(async () => {
    if (!calendarPhase6Enabled) return;

    setLoading(true);
    try {
      // Load calendar events
      const eventFilters: any = {};
      if (dealId) eventFilters.dealId = dealId;
      if (contactId) eventFilters.contactId = contactId;

      const [calendarEvents, deadlineData, integrationData] = await Promise.all([
        CalendarEventService.getEvents(eventFilters),
        dealDeadlinesEnabled ? DealDeadlineService.getDeadlines({ dealId, upcomingOnly: true }) : Promise.resolve([]),
        CalendarOAuthService.getUserIntegrations(userId)
      ]);

      setEvents(calendarEvents);
      setDeadlines(deadlineData);
      setIntegrations(integrationData);
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, dealId, contactId, calendarPhase6Enabled, dealDeadlinesEnabled]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Sync calendar integrations
  const syncIntegrations = async () => {
    if (!integrations.length) return;

    setSyncing(true);
    try {
      const syncPromises = integrations
        .filter(i => i.settings.syncEnabled)
        .map(async (integration) => {
          const response = await fetch(`/api/calendar/sync/${integration.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ syncType: 'incremental' })
          });
          return response.json();
        });

      await Promise.all(syncPromises);
      await loadCalendarData(); // Refresh data after sync
    } catch (error) {
      console.error('Failed to sync calendars:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Handle event creation
  const handleCreateEvent = async (eventData: any) => {
    try {
      await CalendarEventService.createEvent(userId, eventData);
      await loadCalendarData();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  };

  // Handle event selection
  const handleEventSelect = (event: any) => {
    setSelectedEvent(event);
    onEventSelect?.(event);
  };

  // Connect calendar integration
  const connectCalendar = async (provider: 'google' | 'outlook') => {
    try {
      const response = await fetch(`/api/calendar/oauth/${provider}?userId=${userId}`);
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to get OAuth URL:', error);
    }
  };

  // Transform events for calendar display
  const calendarEvents = [
    ...events.map(event => ({
      id: event.id,
      title: event.title,
      start: event.startTime,
      end: event.endTime,
      resource: event,
      type: 'event'
    })),
    ...deadlines.map(deadline => ({
      id: `deadline-${deadline.id}`,
      title: `⏰ ${deadline.title}`,
      start: deadline.deadlineAt,
      end: new Date(deadline.deadlineAt.getTime() + 60 * 60 * 1000), // 1 hour
      resource: deadline,
      type: 'deadline'
    }))
  ];

  // Custom event styling
  const eventStyleGetter = (event: any) => {
    let backgroundColor = '#3174ad'; // Default blue

    if (event.type === 'deadline') {
      switch (event.resource.priority) {
        case 'high':
        case 'critical':
          backgroundColor = '#dc3545'; // Red
          break;
        case 'medium':
          backgroundColor = '#ffc107'; // Yellow
          break;
        default:
          backgroundColor = '#28a745'; // Green
      }
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  if (!calendarPhase6Enabled) {
    return (
      <div className={`flex items-center justify-center h-64 bg-gray-50 rounded-lg ${className}`}>
        <div className="text-center">
          <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Calendar Integration</h3>
          <p className="mt-1 text-sm text-gray-500">Coming soon in Phase 6</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <CalendarIcon className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-medium text-gray-900">
            {dealId ? 'Deal Calendar' : contactId ? 'Contact Calendar' : 'Calendar'}
          </h2>
        </div>

        <div className="flex items-center space-x-2">
          {meetingSchedulingEnabled && (
            <Button
              onClick={() => setShowCreateModal(true)}
              size="sm"
              className="flex items-center space-x-1"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule Meeting</span>
            </Button>
          )}

          <Button
            onClick={syncIntegrations}
            disabled={syncing || !integrations.some(i => i.settings.syncEnabled)}
            variant="outline"
            size="sm"
            className="flex items-center space-x-1"
          >
            <Sync className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync'}</span>
          </Button>

          <Button
            onClick={() => setShowSettingsModal(true)}
            variant="outline"
            size="sm"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={handleEventSelect}
            views={['month', 'week', 'day', 'agenda']}
            defaultView="month"
            selectable
            onSelectSlot={(slotInfo) => {
              if (meetingSchedulingEnabled) {
                setShowCreateModal(true);
                // Pre-fill start/end times
              }
            }}
          />
        )}
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <Modal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          title="Event Details"
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">{selectedEvent.title}</h3>
              {selectedEvent.description && (
                <p className="mt-1 text-sm text-gray-600">{selectedEvent.description}</p>
              )}
            </div>

            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>
                {format(selectedEvent.startTime, 'PPp')} - {format(selectedEvent.endTime, 'p')}
              </span>
            </div>

            {selectedEvent.location && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>{selectedEvent.location}</span>
              </div>
            )}

            {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Users className="h-4 w-4" />
                <div className="flex flex-wrap gap-1">
                  {selectedEvent.attendees.slice(0, 3).map((attendee, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {attendee.name || attendee.email}
                    </Badge>
                  ))}
                  {selectedEvent.attendees.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{selectedEvent.attendees.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {selectedEvent.eventType && (
              <Badge variant={selectedEvent.eventType === 'meeting' ? 'default' : 'secondary'}>
                {selectedEvent.eventType}
              </Badge>
            )}
          </div>
        </Modal>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <CreateEventModal
          userId={userId}
          dealId={dealId}
          contactId={contactId}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateEvent}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <CalendarSettingsModal
          integrations={integrations}
          oauthGoogleEnabled={oauthGoogleEnabled}
          oauthOutlookEnabled={oauthOutlookEnabled}
          onConnect={connectCalendar}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
};

// Create Event Modal Component
interface CreateEventModalProps {
  userId: string;
  dealId?: string;
  contactId?: string;
  onClose: () => void;
  onCreate: (eventData: any) => void;
}

const CreateEventModal: React.FC<CreateEventModalProps> = ({
  userId,
  dealId,
  contactId,
  onClose,
  onCreate
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    location: '',
    meetingUrl: '',
    eventType: 'meeting' as const,
    attendees: [] as string[]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const eventData = {
      ...formData,
      dealId,
      contactId,
      startTime: new Date(formData.startTime),
      endTime: new Date(formData.endTime),
      attendees: formData.attendees.map(email => ({ email }))
    };

    onCreate(eventData);
  };

  return (
    <Modal isOpen onClose={onClose} title="Schedule Meeting">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={formData.title}
          onChange={(value) => setFormData(prev => ({ ...prev, title: value }))}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Time"
            type="datetime-local"
            value={formData.startTime}
            onChange={(value) => setFormData(prev => ({ ...prev, startTime: value }))}
            required
          />
          <Input
            label="End Time"
            type="datetime-local"
            value={formData.endTime}
            onChange={(value) => setFormData(prev => ({ ...prev, endTime: value }))}
            required
          />
        </div>

        <Input
          label="Location"
          value={formData.location}
          onChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
        />

        <Input
          label="Meeting URL"
          value={formData.meetingUrl}
          onChange={(value) => setFormData(prev => ({ ...prev, meetingUrl: value }))}
        />

        <Select
          label="Event Type"
          value={formData.eventType}
          onChange={(value) => setFormData(prev => ({ ...prev, eventType: value }))}
          options={[
            { value: 'meeting', label: 'Meeting' },
            { value: 'deadline', label: 'Deadline' },
            { value: 'followup', label: 'Follow-up' },
            { value: 'reminder', label: 'Reminder' }
          ]}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Create Event
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// Calendar Settings Modal Component
interface CalendarSettingsModalProps {
  integrations: CalendarIntegration[];
  oauthGoogleEnabled: boolean;
  oauthOutlookEnabled: boolean;
  onConnect: (provider: 'google' | 'outlook') => void;
  onClose: () => void;
}

const CalendarSettingsModal: React.FC<CalendarSettingsModalProps> = ({
  integrations,
  oauthGoogleEnabled,
  oauthOutlookEnabled,
  onConnect,
  onClose
}) => {
  return (
    <Modal isOpen onClose={onClose} title="Calendar Settings">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Connected Calendars</h3>

          {integrations.length === 0 ? (
            <p className="text-gray-500">No calendar integrations connected</p>
          ) : (
            <div className="space-y-3">
              {integrations.map((integration) => (
                <div key={integration.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      integration.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                    <div>
                      <p className="font-medium">{integration.provider}</p>
                      <p className="text-sm text-gray-500">{integration.email}</p>
                    </div>
                  </div>
                  <Badge variant={integration.syncStatus === 'error' ? 'destructive' : 'secondary'}>
                    {integration.syncStatus}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Connect New Calendar</h3>
          <div className="space-y-2">
            {oauthGoogleEnabled && (
              <Button
                onClick={() => onConnect('google')}
                variant="outline"
                className="w-full justify-start"
              >
                <img src="/google-icon.svg" alt="Google" className="w-5 h-5 mr-2" />
                Connect Google Calendar
              </Button>
            )}

            {oauthOutlookEnabled && (
              <Button
                onClick={() => onConnect('outlook')}
                variant="outline"
                className="w-full justify-start"
              >
                <img src="/outlook-icon.svg" alt="Outlook" className="w-5 h-5 mr-2" />
                Connect Outlook Calendar
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};