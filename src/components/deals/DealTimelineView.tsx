import React, { useState, useMemo } from 'react';
import { Deal } from '../../types';
import { Calendar, Clock, Target, TrendingUp, ArrowRight } from 'lucide-react';

interface DealTimelineViewProps {
  deals: Record<string, Deal>;
  onDealClick: (dealId: string) => void;
  onDealUpdate: (id: string, updates: Partial<Deal>) => void;
  searchTerm: string;
  filterStage: string;
}

interface TimelineEvent {
  id: string;
  deal: Deal;
  date: Date;
  type: 'created' | 'stage_change' | 'due' | 'closed';
  title: string;
  description: string;
}

export const DealTimelineView: React.FC<DealTimelineViewProps> = ({
  deals,
  onDealClick,
  onDealUpdate,
  searchTerm,
  filterStage
}) => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');

  // Filter deals
  const filteredDeals = useMemo(() => {
    let result = Object.values(deals);

    if (searchTerm.trim()) {
      result = result.filter(deal =>
        deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.contact.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStage !== 'all') {
      result = result.filter(deal => deal.stage === filterStage);
    }

    return result;
  }, [deals, searchTerm, filterStage]);

  // Generate timeline events
  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    filteredDeals.forEach(deal => {
      // Deal created event
      events.push({
        id: `${deal.id}-created`,
        deal,
        date: new Date(deal.createdAt),
        type: 'created',
        title: 'Deal Created',
        description: `${deal.title} was created`
      });

      // Stage progression events (mock based on deal age)
      const createdDate = new Date(deal.createdAt);
      const daysSinceCreated = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceCreated > 7 && deal.stage !== 'qualification') {
        events.push({
          id: `${deal.id}-qualified`,
          deal,
          date: new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000),
          type: 'stage_change',
          title: 'Moved to Qualification',
          description: `${deal.title} moved to qualification stage`
        });
      }

      if (daysSinceCreated > 14 && (deal.stage === 'proposal' || deal.stage === 'negotiation' || deal.stage === 'closed-won' || deal.stage === 'closed-lost')) {
        events.push({
          id: `${deal.id}-proposal`,
          deal,
          date: new Date(createdDate.getTime() + 14 * 24 * 60 * 60 * 1000),
          type: 'stage_change',
          title: 'Proposal Stage',
          description: `${deal.title} moved to proposal stage`
        });
      }

      // Due date event
      if (deal.dueDate) {
        events.push({
          id: `${deal.id}-due`,
          deal,
          date: new Date(deal.dueDate),
          type: 'due',
          title: 'Due Date',
          description: `${deal.title} expected to close`
        });
      }

      // Closed events
      if (deal.stage === 'closed-won' || deal.stage === 'closed-lost') {
        events.push({
          id: `${deal.id}-closed`,
          deal,
          date: new Date(deal.updatedAt),
          type: 'closed',
          title: deal.stage === 'closed-won' ? 'Deal Won' : 'Deal Lost',
          description: `${deal.title} was ${deal.stage === 'closed-won' ? 'won' : 'lost'}`
        });
      }
    });

    // Sort events by date
    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredDeals]);

  // Filter events based on time range
  const visibleEvents = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return timelineEvents.filter(event => event.date >= startDate);
  }, [timelineEvents, timeRange]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'created': return Target;
      case 'stage_change': return ArrowRight;
      case 'due': return Calendar;
      case 'closed': return TrendingUp;
      default: return Clock;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'created': return 'bg-blue-500';
      case 'stage_change': return 'bg-indigo-500';
      case 'due': return 'bg-yellow-500';
      case 'closed': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Timeline Controls */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Deal Timeline</h3>
        
        <div className="flex items-center space-x-2">
          {['week', 'month', 'quarter'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range as typeof timeRange)}
              className={`px-3 py-1 text-sm rounded-md transition-colors capitalize ${
                timeRange === range
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {visibleEvents.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">No events in timeline</h3>
            <p className="text-gray-500 dark:text-gray-500">
              No deal events found for the selected time range
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-600"></div>

            {/* Timeline Events */}
            <div className="space-y-6">
              {visibleEvents.map((event, index) => {
                const EventIcon = getEventIcon(event.type);
                const eventColor = getEventColor(event.type);

                return (
                  <div key={event.id} className="relative flex items-start space-x-4">
                    {/* Timeline Dot */}
                    <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${eventColor} shadow-lg`}>
                      <EventIcon className="w-4 h-4 text-white" />
                    </div>

                    {/* Event Content */}
                    <div className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">{event.title}</h4>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {event.date.toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{event.description}</p>
                          
                          <div className="flex items-center space-x-4">
                            <button
                              onClick={() => onDealClick(event.deal.id)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                            >
                              View Deal
                            </button>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {formatCurrency(event.deal.value)} • {event.deal.probability}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};