import React, { useState } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { ModernButton } from '../ui/ModernButton';
import { Contact } from '../../types/contact';
import {
  Calendar,
  Mail,
  Phone,
  MessageSquare,
  FileText,
  User,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Video,
  Coffee,
  DollarSign,
  Target,
  Filter,
  Download
} from 'lucide-react';

interface JourneyEvent {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'proposal' | 'note' | 'demo' | 'contract' | 'follow-up';
  title: string;
  description: string;
  date: string;
  outcome?: 'positive' | 'neutral' | 'negative';
  value?: number;
  attachments?: string[];
  participants?: string[];
}

interface ContactJourneyTimelineProps {
  contact: Contact;
}

const eventIcons = {
  email: Mail,
  call: Phone,
  meeting: Coffee,
  proposal: FileText,
  note: MessageSquare,
  demo: Video,
  contract: DollarSign,
  'follow-up': Clock
};

const eventColors = {
  email: 'bg-blue-500',
  call: 'bg-green-500',
  meeting: 'bg-purple-500',
  proposal: 'bg-orange-500',
  note: 'bg-gray-500',
  demo: 'bg-red-500',
  contract: 'bg-yellow-500',
  'follow-up': 'bg-indigo-500'
};

const outcomeColors = {
  positive: 'text-green-600 bg-green-50',
  neutral: 'text-gray-600 bg-gray-50',
  negative: 'text-red-600 bg-red-50'
};

// Sample journey data
const sampleJourneyEvents: JourneyEvent[] = [
  {
    id: '1',
    type: 'email',
    title: 'Initial Outreach',
    description: 'Sent introduction email about our enterprise solutions',
    date: '2024-01-15T10:30:00Z',
    outcome: 'positive',
    attachments: ['Company Brochure.pdf']
  },
  {
    id: '2',
    type: 'call',
    title: 'Discovery Call',
    description: '30-minute call to understand business needs and pain points',
    date: '2024-01-18T14:00:00Z',
    outcome: 'positive',
    participants: ['Jane Doe', 'Sales Rep']
  },
  {
    id: '3',
    type: 'demo',
    title: 'Product Demo',
    description: 'Live demonstration of key features and capabilities',
    date: '2024-01-22T11:00:00Z',
    outcome: 'positive',
    participants: ['Jane Doe', 'Tech Team', 'Sales Rep']
  },
  {
    id: '4',
    type: 'proposal',
    title: 'Proposal Sent',
    description: 'Customized proposal with pricing and implementation timeline',
    date: '2024-01-25T09:00:00Z',
    outcome: 'neutral',
    value: 85000,
    attachments: ['Proposal.pdf', 'Implementation Plan.pdf']
  },
  {
    id: '5',
    type: 'follow-up',
    title: 'Follow-up Scheduled',
    description: 'Scheduled follow-up call to discuss proposal feedback',
    date: '2024-01-30T15:00:00Z',
    outcome: 'neutral'
  }
];

export const ContactJourneyTimeline: React.FC<ContactJourneyTimelineProps> = ({ contact }) => {
  const [filter, setFilter] = useState<string>('all');
  const [journeyEvents] = useState<JourneyEvent[]>(sampleJourneyEvents);

  const filteredEvents = journeyEvents.filter(event =>
    filter === 'all' || event.type === filter
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const eventTypes = [
    { value: 'all', label: 'All Events' },
    { value: 'email', label: 'Emails' },
    { value: 'call', label: 'Calls' },
    { value: 'meeting', label: 'Meetings' },
    { value: 'demo', label: 'Demos' },
    { value: 'proposal', label: 'Proposals' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Customer Journey</h3>
          <p className="text-gray-600">Complete interaction timeline with {contact.name}</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {eventTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <ModernButton variant="outline" size="sm" className="flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </ModernButton>
        </div>
      </div>

      {/* Journey Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{journeyEvents.length}</p>
              <p className="text-sm text-gray-600">Total Interactions</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {journeyEvents.filter(e => e.outcome === 'positive').length}
              </p>
              <p className="text-sm text-gray-600">Positive Outcomes</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">15</p>
              <p className="text-sm text-gray-600">Days in Pipeline</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">$85K</p>
              <p className="text-sm text-gray-600">Pipeline Value</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Timeline */}
      <GlassCard className="p-6">
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

          {/* Timeline Events */}
          <div className="space-y-6">
            {filteredEvents.map((event, index) => {
              const Icon = eventIcons[event.type];
              const eventColor = eventColors[event.type];
              const { date, time } = formatDate(event.date);

              return (
                <div key={event.id} className="relative flex items-start space-x-4">
                  {/* Timeline Dot */}
                  <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${eventColor} shadow-lg`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>

                  {/* Event Content */}
                  <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">{event.title}</h4>
                        <p className="text-gray-600">{event.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{date}</p>
                        <p className="text-sm text-gray-500">{time}</p>
                      </div>
                    </div>

                    {/* Event Details */}
                    <div className="flex items-center space-x-4 mt-3">
                      {event.outcome && (
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${outcomeColors[event.outcome]}`}>
                          {event.outcome.charAt(0).toUpperCase() + event.outcome.slice(1)}
                        </span>
                      )}

                      {event.value && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium">
                          ${event.value.toLocaleString()}
                        </span>
                      )}

                      {event.participants && (
                        <span className="text-xs text-gray-500">
                          {event.participants.length} participant{event.participants.length > 1 ? 's' : ''}
                        </span>
                      )}

                      {event.attachments && (
                        <span className="text-xs text-gray-500">
                          {event.attachments.length} attachment{event.attachments.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Attachments */}
                    {event.attachments && event.attachments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-sm font-medium text-gray-700 mb-2">Attachments:</p>
                        <div className="flex flex-wrap gap-2">
                          {event.attachments.map((attachment, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
                              <FileText className="w-3 h-3 mr-1" />
                              {attachment}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </GlassCard>
    </div>
  );
};