import React, { useState, useMemo } from 'react';
import { Deal, CalendarViewConfig } from '../types';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, DollarSign } from 'lucide-react';

interface AdvancedCalendarViewProps {
  deals: Record<string, Deal>;
  config: CalendarViewConfig;
  onDealClick: (dealId: string) => void;
  onDateClick?: (date: Date) => void;
  onEventClick?: (dealId: string) => void;
}

export const AdvancedCalendarView: React.FC<AdvancedCalendarViewProps> = ({
  deals,
  config,
  onDealClick,
  onDateClick,
  onEventClick
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Process deals into calendar events
  const calendarEvents = useMemo(() => {
    const events: Array<{
      id: string;
      title: string;
      date: Date;
      deal: Deal;
      color: string;
      allDay: boolean;
    }> = [];

    Object.values(deals).forEach(deal => {
      const dateField = config.dateField || 'dueDate';
      const dateValue = deal[dateField as keyof Deal];

      if (dateValue) {
        const eventDate = new Date(dateValue as string | Date);

        // Determine event color
        let color = '#3b82f6'; // default blue
        if (config.eventTemplate.colorField) {
          const colorField = config.eventTemplate.colorField;
          const colorValue = deal[colorField as keyof Deal];
          if (colorValue && typeof colorValue === 'string') {
            // Map stage to color
            const stageColors: Record<string, string> = {
              'qualification': '#3b82f6',
              'proposal': '#6366f1',
              'negotiation': '#f59e0b',
              'closed-won': '#10b981',
              'closed-lost': '#ef4444'
            };
            color = stageColors[colorValue] || color;
          }
        }

        // Create title
        let title = deal.title || `${deal.company} - ${deal.contact}`;
        if (config.eventTemplate.titleField) {
          const titleValue = deal[config.eventTemplate.titleField as keyof Deal];
          if (titleValue) {
            title = String(titleValue);
          }
        }

        events.push({
          id: deal.id,
          title,
          date: eventDate,
          deal,
          color,
          allDay: !config.eventTemplate.startTimeField
        });
      }
    });

    return events;
  }, [deals, config]);

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return calendarEvents.filter(event =>
      event.date.toDateString() === date.toDateString()
    );
  };

  // Navigate calendar
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const current = new Date(startDate);

    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  // Render different calendar views
  const renderMonthView = () => (
    <div className="bg-white rounded-lg shadow">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-semibold text-gray-900">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={navigateToday}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Today
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = day.toDateString() === new Date().toDateString();
            const isSelected = selectedDate?.toDateString() === day.toDateString();
            const dayEvents = getEventsForDate(day);

            return (
              <div
                key={index}
                className={`min-h-24 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50 ${
                  !isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'
                } ${isToday ? 'bg-blue-50 border-blue-300' : ''} ${
                  isSelected ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => {
                  setSelectedDate(day);
                  onDateClick?.(day);
                }}
              >
                <div className="text-sm font-medium mb-1">
                  {day.getDate()}
                </div>

                {/* Events for this day */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: event.color, color: 'white' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDealClick(event.deal.id);
                        onEventClick?.(event.deal.id);
                      }}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDays.push(day);
    }

    return (
      <div className="bg-white rounded-lg shadow">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900">
              Week of {startOfWeek.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-7 gap-4">
            {weekDays.map(day => {
              const dayEvents = getEventsForDate(day);
              const isToday = day.toDateString() === new Date().toDateString();

              return (
                <div key={day.toISOString()} className="min-h-64">
                  <div className={`p-2 text-center border-b ${isToday ? 'bg-blue-50' : ''}`}>
                    <div className="font-medium text-gray-900">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="text-2xl font-bold text-gray-700">{day.getDate()}</div>
                  </div>

                  <div className="p-2 space-y-2">
                    {dayEvents.map(event => (
                      <div
                        key={event.id}
                        className="p-2 rounded text-sm cursor-pointer hover:opacity-80"
                        style={{ backgroundColor: event.color, color: 'white' }}
                        onClick={() => onDealClick(event.deal.id)}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        <div className="text-xs opacity-90">{event.deal.company}</div>
                        <div className="text-xs opacity-90">
                          ${event.deal.value.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderAgendaView = () => {
    const upcomingEvents = calendarEvents
      .filter(event => event.date >= new Date())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 50);

    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Upcoming Events</h2>
        </div>

        <div className="divide-y divide-gray-200">
          {upcomingEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No upcoming events</p>
            </div>
          ) : (
            upcomingEvents.map(event => (
              <div
                key={event.id}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => onDealClick(event.deal.id)}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                    style={{ backgroundColor: event.color }}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{event.title}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {event.date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                      {config.eventTemplate.startTimeField && (
                        <span className="ml-2">
                          at {event.date.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {event.deal.contact}
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${event.deal.value.toLocaleString()}
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs ${
                        event.deal.stage === 'closed-won' ? 'bg-green-100 text-green-800' :
                        event.deal.stage === 'closed-lost' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {event.deal.stage.replace('-', ' ').toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // Render selected view
  const renderView = () => {
    switch (config.viewMode) {
      case 'week':
        return renderWeekView();
      case 'day':
        // Simplified day view - could be expanded
        return renderWeekView();
      case 'agenda':
        return renderAgendaView();
      case 'month':
      default:
        return renderMonthView();
    }
  };

  return (
    <div className="h-full p-6 bg-gray-50">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Deal Calendar</h1>
        <p className="text-gray-600">View and manage your deals by date</p>
      </div>

      {renderView()}

      {/* Event details sidebar */}
      {selectedDate && (
        <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-lg border-l border-gray-200 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            {getEventsForDate(selectedDate).map(event => (
              <div
                key={event.id}
                className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                onClick={() => onDealClick(event.deal.id)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-4 h-4 rounded-full mt-1"
                    style={{ backgroundColor: event.color }}
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{event.title}</h4>
                    <div className="text-sm text-gray-600 mt-1">
                      {event.deal.company}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${event.deal.value.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {event.deal.probability}% probability
                      </div>
                    </div>
                    {event.deal.notes && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {event.deal.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {getEventsForDate(selectedDate).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No events on this date</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};