import React, { useState, useEffect, useCallback } from 'react';
import { CalendarEventService, CalendarEvent } from '../../services/calendarEventService';
import { DealDeadlineService, DealDeadline } from '../../services/dealDeadlineService';
import { ReminderService } from '../../services/reminderService';
import { CalendarConflictService } from '../../services/calendarConflictService';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { Calendar, Plus, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface DealCalendarIntegrationProps {
  dealId: string;
  userId: string;
  className?: string;
}

export const DealCalendarIntegration: React.FC<DealCalendarIntegrationProps> = ({
  dealId,
  userId,
  className = ''
}) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [deadlines, setDeadlines] = useState<DealDeadline[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [conflictCheck, setConflictCheck] = useState<any>(null);

  // Feature flags
  const calendarPhase6Enabled = useFeatureFlag('twenty_calendar_phase6');
  const meetingSchedulingEnabled = useFeatureFlag('calendar_meeting_scheduling');
  const dealDeadlinesEnabled = useFeatureFlag('deal_deadlines_calendar');
  const conflictDetectionEnabled = useFeatureFlag('calendar_conflict_detection');

  // Load deal calendar data
  const loadCalendarData = useCallback(async () => {
    if (!calendarPhase6Enabled) return;

    setLoading(true);
    try {
      const [calendarEvents, deadlineData] = await Promise.all([
        CalendarEventService.getEvents({ dealId }),
        dealDeadlinesEnabled ? DealDeadlineService.getDeadlines({ dealId }) : Promise.resolve([])
      ]);

      setEvents(calendarEvents);
      setDeadlines(deadlineData);
    } catch (error) {
      console.error('Failed to load deal calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, [dealId, calendarPhase6Enabled, dealDeadlinesEnabled]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Check for conflicts when scheduling
  const checkSchedulingConflicts = async (startTime: Date, endTime: Date) => {
    if (!conflictDetectionEnabled) return;

    try {
      const conflictData = await CalendarConflictService.checkConflicts({
        userId,
        startTime,
        endTime,
        checkAttendees: true
      });
      setConflicts(conflictData);
      setConflictCheck({ startTime, endTime, conflicts: conflictData });
    } catch (error) {
      console.error('Failed to check conflicts:', error);
    }
  };

  // Schedule meeting from deal
  const handleScheduleMeeting = async (meetingData: any) => {
    try {
      // Check for conflicts first
      if (conflictDetectionEnabled) {
        await checkSchedulingConflicts(
          new Date(meetingData.startTime),
          new Date(meetingData.endTime)
        );

        if (conflicts.length > 0) {
          // Ask user to confirm despite conflicts
          const proceed = window.confirm(
            `Found ${conflicts.length} scheduling conflict(s). Proceed anyway?`
          );
          if (!proceed) return;
        }
      }

      await CalendarEventService.scheduleMeetingFromDeal(dealId, userId, meetingData);
      await loadCalendarData();
      setShowScheduleModal(false);
      setConflictCheck(null);
      setConflicts([]);
    } catch (error) {
      console.error('Failed to schedule meeting:', error);
    }
  };

  // Complete deadline
  const handleCompleteDeadline = async (deadlineId: string) => {
    try {
      await DealDeadlineService.completeDeadline(deadlineId, userId);
      await loadCalendarData();
    } catch (error) {
      console.error('Failed to complete deadline:', error);
    }
  };

  if (!calendarPhase6Enabled) {
    return (
      <div className={`flex items-center justify-center h-32 bg-gray-50 rounded-lg ${className}`}>
        <div className="text-center">
          <Calendar className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">Calendar integration coming soon</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-medium text-gray-900">Deal Calendar</h2>
          <Badge variant="secondary">{events.length + deadlines.length}</Badge>
        </div>

        {meetingSchedulingEnabled && (
          <Button
            onClick={() => setShowScheduleModal(true)}
            size="sm"
            className="flex items-center space-x-1"
          >
            <Plus className="h-4 w-4" />
            <span>Schedule Meeting</span>
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upcoming Deadlines */}
            {dealDeadlinesEnabled && deadlines.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  Upcoming Deadlines
                </h3>
                <div className="space-y-2">
                  {deadlines
                    .filter(d => d.status === 'active')
                    .sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime())
                    .slice(0, 3)
                    .map((deadline) => (
                      <div key={deadline.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{deadline.title}</p>
                          <p className="text-xs text-gray-500">
                            Due: {deadline.deadlineAt.toLocaleDateString()} at {deadline.deadlineAt.toLocaleTimeString()}
                          </p>
                          {deadline.description && (
                            <p className="text-xs text-gray-600 mt-1">{deadline.description}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant={
                              deadline.priority === 'high' || deadline.priority === 'critical'
                                ? 'destructive'
                                : deadline.priority === 'medium'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {deadline.priority}
                          </Badge>
                          <Button
                            onClick={() => handleCompleteDeadline(deadline.id)}
                            size="sm"
                            variant="outline"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Recent Events */}
            {events.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  Recent Meetings
                </h3>
                <div className="space-y-2">
                  {events
                    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
                    .slice(0, 5)
                    .map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{event.title}</p>
                          <p className="text-xs text-gray-500">
                            {event.startTime.toLocaleDateString()} at {event.startTime.toLocaleTimeString()}
                          </p>
                          {event.location && (
                            <p className="text-xs text-gray-600">📍 {event.location}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={event.status === 'confirmed' ? 'default' : 'secondary'}>
                            {event.status}
                          </Badge>
                          {event.attendees && event.attendees.length > 0 && (
                            <span className="text-xs text-gray-500">
                              {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* No data state */}
            {events.length === 0 && deadlines.length === 0 && (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No calendar events</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Schedule your first meeting or set deal deadlines to get started.
                </p>
                {meetingSchedulingEnabled && (
                  <Button
                    onClick={() => setShowScheduleModal(true)}
                    className="mt-4"
                  >
                    Schedule Meeting
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Schedule Meeting Modal */}
      {showScheduleModal && (
        <ScheduleMeetingModal
          dealId={dealId}
          userId={userId}
          onClose={() => {
            setShowScheduleModal(false);
            setConflictCheck(null);
            setConflicts([]);
          }}
          onSchedule={handleScheduleMeeting}
          conflictCheck={conflictCheck}
          conflicts={conflicts}
          onCheckConflicts={checkSchedulingConflicts}
          conflictDetectionEnabled={conflictDetectionEnabled}
        />
      )}
    </div>
  );
};

// Schedule Meeting Modal Component
interface ScheduleMeetingModalProps {
  dealId: string;
  userId: string;
  onClose: () => void;
  onSchedule: (meetingData: any) => void;
  conflictCheck: any;
  conflicts: any[];
  onCheckConflicts: (startTime: Date, endTime: Date) => void;
  conflictDetectionEnabled: boolean;
}

const ScheduleMeetingModal: React.FC<ScheduleMeetingModalProps> = ({
  dealId,
  userId,
  onClose,
  onSchedule,
  conflictCheck,
  conflicts,
  onCheckConflicts,
  conflictDetectionEnabled
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    durationMinutes: 60,
    includeContact: true,
    additionalAttendees: [] as string[]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const startTime = new Date(formData.startTime);
    const endTime = new Date(startTime.getTime() + formData.durationMinutes * 60 * 1000);

    onSchedule({
      title: formData.title,
      description: formData.description,
      startTime,
      durationMinutes: formData.durationMinutes,
      includeContact: formData.includeContact,
      additionalAttendees: formData.additionalAttendees.filter(email => email.trim())
    });
  };

  const handleTimeChange = (startTimeStr: string) => {
    setFormData(prev => ({ ...prev, startTime: startTimeStr }));

    if (conflictDetectionEnabled && startTimeStr) {
      const startTime = new Date(startTimeStr);
      const endTime = new Date(startTime.getTime() + formData.durationMinutes * 60 * 1000);
      onCheckConflicts(startTime, endTime);
    }
  };

  const handleDurationChange = (duration: number) => {
    setFormData(prev => ({ ...prev, durationMinutes: duration }));

    if (conflictDetectionEnabled && formData.startTime) {
      const startTime = new Date(formData.startTime);
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
      onCheckConflicts(startTime, endTime);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Schedule Meeting">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Meeting Title"
          value={formData.title}
          onChange={(value) => setFormData(prev => ({ ...prev, title: value }))}
          placeholder="e.g., Product Demo, Follow-up Discussion"
          required
        />

        <Input
          label="Description (Optional)"
          value={formData.description}
          onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
          placeholder="Meeting agenda or notes"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Time"
            type="datetime-local"
            value={formData.startTime}
            onChange={handleTimeChange}
            required
          />

          <Select
            label="Duration"
            value={formData.durationMinutes.toString()}
            onChange={(value) => handleDurationChange(parseInt(value))}
            options={[
              { value: '15', label: '15 minutes' },
              { value: '30', label: '30 minutes' },
              { value: '60', label: '1 hour' },
              { value: '90', label: '1.5 hours' },
              { value: '120', label: '2 hours' }
            ]}
          />
        </div>

        {/* Conflict Detection */}
        {conflictDetectionEnabled && conflictCheck && (
          <div className="space-y-2">
            {conflicts.length > 0 ? (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <div>
                  <p className="font-medium">Scheduling Conflicts Detected</p>
                  <p className="text-sm">Found {conflicts.length} conflict(s) for the selected time:</p>
                  <ul className="list-disc list-inside mt-1 text-sm">
                    {conflicts.slice(0, 3).map((conflict, index) => (
                      <li key={index}>{conflict.description}</li>
                    ))}
                  </ul>
                </div>
              </Alert>
            ) : (
              <Alert variant="success">
                <CheckCircle className="h-4 w-4" />
                <p>No conflicts detected for the selected time.</p>
              </Alert>
            )}
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={conflicts.length > 0}>
            Schedule Meeting
          </Button>
        </div>
      </form>
    </Modal>
  );
};</content>
<parameter name="filePath">/workspaces/enhancedpipelinedeals/src/components/calendar/DealCalendarIntegration.tsx