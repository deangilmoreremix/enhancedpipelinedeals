import React from 'react';
import { Deal } from '../types';
import { Calendar, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface DealJourneyTimelineProps {
  deal: Deal;
}

export const DealJourneyTimeline: React.FC<DealJourneyTimelineProps> = ({ deal }) => {
  const timelineEvents = [
    {
      id: '1',
      title: 'Deal Created',
      description: 'Initial deal entry created in the system',
      date: deal.createdAt,
      type: 'creation',
      icon: Calendar,
      status: 'completed'
    },
    {
      id: '2',
      title: 'Initial Contact',
      description: 'First outreach to the prospect',
      date: new Date(deal.createdAt.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days later
      type: 'contact',
      icon: TrendingUp,
      status: 'completed'
    },
    {
      id: '3',
      title: 'Proposal Sent',
      description: 'Formal proposal delivered to client',
      date: new Date(deal.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week later
      type: 'milestone',
      icon: CheckCircle,
      status: deal.stage === 'proposal' || deal.stage === 'negotiation' || deal.stage === 'closed-won' || deal.stage === 'closed-lost' ? 'completed' : 'pending'
    },
    {
      id: '4',
      title: 'Negotiation Phase',
      description: 'Terms and pricing discussion',
      date: deal.dueDate || new Date(deal.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks later or due date
      type: 'milestone',
      icon: AlertCircle,
      status: deal.stage === 'negotiation' || deal.stage === 'closed-won' || deal.stage === 'closed-lost' ? 'completed' : 'pending'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Deal Journey Timeline</h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {Math.ceil((new Date().getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days active
        </div>
      </div>

      <div className="space-y-4">
        {timelineEvents.map((event, index) => {
          const Icon = event.icon;
          const isLast = index === timelineEvents.length - 1;

          return (
            <div key={event.id} className="flex items-start space-x-4">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  event.status === 'completed'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                {!isLast && (
                  <div className={`w-0.5 h-16 mt-2 ${
                    event.status === 'completed'
                      ? 'bg-green-200 dark:bg-green-800'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </div>

              <div className="flex-1 pb-8">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">{event.title}</h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {event.date.toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{event.description}</p>

                {event.status === 'completed' && (
                  <div className="flex items-center mt-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    <span className="text-xs text-green-600 dark:text-green-400">Completed</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">Next Steps</h4>
        <div className="space-y-2">
          <div className="flex items-center text-sm text-blue-700 dark:text-blue-400">
            <Clock className="w-4 h-4 mr-2" />
            Schedule follow-up call for proposal review
          </div>
          <div className="flex items-center text-sm text-blue-700 dark:text-blue-400">
            <TrendingUp className="w-4 h-4 mr-2" />
            Prepare negotiation strategy
          </div>
        </div>
      </div>
    </div>
  );
};