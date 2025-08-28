import React from 'react';
import { Deal } from '../../types';
import { 
  ArrowRight, Calendar, CheckCircle, Clock, Phone, Mail, 
  FileText, Target, AlertCircle, DollarSign, Plus, User, 
  Briefcase, Award, MessageSquare, Building2
} from 'lucide-react';

interface DealJourneyTimelineProps {
  deal: Deal;
}

export const DealJourneyTimeline: React.FC<DealJourneyTimelineProps> = ({ deal }) => {
  // Generate some sample timeline events based on deal data
  const generateTimelineEvents = () => {
    const today = new Date();
    
    const events = [
      {
        id: 1,
        type: 'created',
        title: 'Deal Created',
        description: `Deal ${deal.title} was created`,
        date: deal.createdAt,
        icon: DollarSign,
        iconColor: 'bg-green-500',
        complete: true
      }
    ];

    // Add stage-based events
    if (deal.stage !== 'qualification') {
      const qualDate = new Date(deal.createdAt.getTime() + (7 * 24 * 60 * 60 * 1000));
      events.push({
        id: 2,
        type: 'stage',
        title: 'Qualified Lead',
        description: 'Deal moved to qualification stage',
        date: qualDate,
        icon: CheckCircle,
        iconColor: 'bg-blue-600',
        complete: true
      });
    }
    
    if (deal.stage === 'proposal' || deal.stage === 'negotiation' || deal.stage === 'closed-won' || deal.stage === 'closed-lost') {
      const propDate = new Date(deal.createdAt.getTime() + (14 * 24 * 60 * 60 * 1000));
      events.push({
        id: 3,
        type: 'stage',
        title: 'Proposal Sent',
        description: 'Proposal was sent and reviewed by client',
        date: propDate,
        icon: FileText,
        iconColor: 'bg-indigo-600',
        complete: true
      });
    }
    
    if (deal.stage === 'negotiation' || deal.stage === 'closed-won' || deal.stage === 'closed-lost') {
      const negDate = new Date(deal.createdAt.getTime() + (21 * 24 * 60 * 60 * 1000));
      events.push({
        id: 4,
        type: 'stage',
        title: 'Negotiation Started',
        description: 'Contract terms and pricing being negotiated',
        date: negDate,
        icon: Briefcase,
        iconColor: 'bg-purple-600',
        complete: true
      });
    }
    
    if (deal.stage === 'closed-won') {
      const wonDate = new Date(deal.createdAt.getTime() + (30 * 24 * 60 * 60 * 1000));
      events.push({
        id: 5,
        type: 'closed',
        title: 'Deal Won',
        description: `Deal closed successfully for ${formatCurrency(deal.value)}`,
        date: wonDate,
        icon: Award,
        iconColor: 'bg-green-600',
        complete: true
      });
    }
    
    if (deal.stage === 'closed-lost') {
      const lostDate = new Date(deal.createdAt.getTime() + (28 * 24 * 60 * 60 * 1000));
      events.push({
        id: 6,
        type: 'closed',
        title: 'Deal Lost',
        description: 'Deal was lost due to budget constraints',
        date: lostDate,
        icon: AlertCircle,
        iconColor: 'bg-red-600',
        complete: true
      });
    }
    
    // Add future event
    if (deal.stage !== 'closed-won' && deal.stage !== 'closed-lost') {
      const nextStage = deal.stage === 'qualification' ? 'Proposal' : 
                        deal.stage === 'proposal' ? 'Negotiation' : 'Closing';
      const nextDate = deal.dueDate || new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
      
      events.push({
        id: 7,
        type: 'upcoming',
        title: `Expected ${nextStage}`,
        description: `Expected to move to ${nextStage.toLowerCase()} stage`,
        date: nextDate,
        icon: Calendar,
        iconColor: 'bg-yellow-500',
        complete: false
      });
    }
    
    // Add communication events
    const commDate = new Date(deal.updatedAt.getTime() - (3 * 24 * 60 * 60 * 1000));
    events.push({
      id: 8,
      type: 'communication',
      title: 'Client Meeting',
      description: 'Virtual meeting to discuss project requirements',
      date: commDate,
      icon: MessageSquare,
      iconColor: 'bg-blue-500',
      complete: true
    });

    // Sort events by date
    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const timelineEvents = generateTimelineEvents();
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Deal Journey</h3>
        <button className="text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center">
          <Target className="w-4 h-4 mr-1" /> Set Milestones
        </button>
      </div>
      
      {/* Timeline Visualization */}
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-200 z-0"></div>
        
        <div className="space-y-8">
          {timelineEvents.map((event, index) => (
            <div key={event.id} className="relative z-10 flex items-start">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full ${event.iconColor} flex items-center justify-center shadow-md mr-4`}>
                <event.icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-medium text-gray-900">{event.title}</h4>
                  <span className={`text-sm ${event.complete ? 'text-gray-500' : 'text-blue-600 font-medium'}`}>
                    {event.complete ? formatDate(event.date) : 'Expected'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                
                {/* Additional actions based on event type */}
                {event.type === 'upcoming' && (
                  <div className="mt-3 flex space-x-3">
                    <button className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors">
                      Reschedule
                    </button>
                    <button className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors">
                      Mark Complete
                    </button>
                  </div>
                )}
                
                {event.type === 'communication' && (
                  <div className="mt-2 text-sm text-gray-500">
                    <p className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Add new journey point */}
          <div className="relative z-10 flex items-start">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 border-dashed flex items-center justify-center mr-4">
              <Plus className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 border-dashed p-4">
              <button className="w-full text-left">
                <h4 className="text-base font-medium text-blue-700">Add Milestone</h4>
                <p className="text-sm text-blue-600 mt-1">Record a new milestone or interaction</p>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Journey Metrics Summary */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h5 className="text-sm font-medium text-gray-600 mb-1">Created</h5>
          <p className="text-lg font-semibold text-gray-900">{formatDate(deal.createdAt)}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h5 className="text-sm font-medium text-gray-600 mb-1">Days Active</h5>
          <p className="text-lg font-semibold text-gray-900">
            {Math.ceil((new Date().getTime() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24))}
          </p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h5 className="text-sm font-medium text-gray-600 mb-1">Stage Changes</h5>
          <p className="text-lg font-semibold text-gray-900">
            {timelineEvents.filter(e => e.type === 'stage').length}
          </p>
        </div>
      </div>

      {/* Key Milestones */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mt-6">
        <h4 className="text-base font-semibold text-gray-900 mb-4">Key Milestones</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col items-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="p-3 bg-blue-100 rounded-full mb-2">
              <Target className="h-5 w-5 text-blue-700" />
            </div>
            <p className="font-medium text-blue-900">Deal Qualification</p>
            <p className="text-sm text-blue-700">
              {deal.stage === 'qualification' ? 'In Progress' : 'Completed'}
            </p>
          </div>
          
          <div className="flex flex-col items-center p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="p-3 bg-indigo-100 rounded-full mb-2">
              <FileText className="h-5 w-5 text-indigo-700" />
            </div>
            <p className="font-medium text-indigo-900">Proposal/Quote</p>
            <p className="text-sm text-indigo-700">
              {deal.stage === 'qualification' ? 'Pending' : 
               deal.stage === 'proposal' ? 'In Progress' : 'Completed'}
            </p>
          </div>
          
          <div className="flex flex-col items-center p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="p-3 bg-green-100 rounded-full mb-2">
              <Award className="h-5 w-5 text-green-700" />
            </div>
            <p className="font-medium text-green-900">Deal Closing</p>
            <p className="text-sm text-green-700">
              {deal.stage === 'closed-won' ? 'Won' : 
               deal.stage === 'closed-lost' ? 'Lost' : 
               deal.stage === 'negotiation' ? 'In Progress' : 'Pending'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};