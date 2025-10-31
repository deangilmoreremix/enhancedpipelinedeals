import React, { useState } from 'react';
import { Deal } from '../types';
import { Contact } from '../types/contact';
import { MessageSquare, Mail, Phone, Calendar, FileText, Send, Paperclip, Clock } from 'lucide-react';

interface DealCommunicationHubProps {
  deal: Deal;
  contact?: Contact | null;
}

export const DealCommunicationHub: React.FC<DealCommunicationHubProps> = ({ deal, contact }) => {
  const [activeTab, setActiveTab] = useState<'messages' | 'calls' | 'emails' | 'meetings'>('messages');

  const mockCommunications = {
    messages: [
      {
        id: '1',
        type: 'whatsapp',
        content: 'Hi, I\'d like to discuss the proposal you sent.',
        sender: contact?.name || 'John Doe',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        direction: 'incoming'
      },
      {
        id: '2',
        type: 'whatsapp',
        content: 'Absolutely! I\'m available tomorrow at 2 PM.',
        sender: 'You',
        timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // 1.5 hours ago
        direction: 'outgoing'
      }
    ],
    calls: [
      {
        id: '1',
        duration: '15:32',
        type: 'outbound',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        notes: 'Discussed pricing and timeline'
      }
    ],
    emails: [
      {
        id: '1',
        subject: 'Proposal for Enterprise Solution',
        sender: 'You',
        recipient: contact?.email || 'john@company.com',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        status: 'sent'
      }
    ],
    meetings: [
      {
        id: '1',
        title: 'Product Demo & Requirements Review',
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        duration: '1 hour',
        attendees: [contact?.name || 'John Doe', 'Sarah Johnson', 'Mike Chen'],
        status: 'scheduled'
      }
    ]
  };

  const tabs = [
    { id: 'messages', label: 'Messages', icon: MessageSquare, count: mockCommunications.messages.length },
    { id: 'calls', label: 'Calls', icon: Phone, count: mockCommunications.calls.length },
    { id: 'emails', label: 'Emails', icon: Mail, count: mockCommunications.emails.length },
    { id: 'meetings', label: 'Meetings', icon: Calendar, count: mockCommunications.meetings.length }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Communication Hub</h3>
        <div className="flex space-x-2">
          <button className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
            <Send className="w-4 h-4 inline mr-2" />
            New Message
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        {activeTab === 'messages' && (
          <div className="space-y-4">
            {mockCommunications.messages.map((message) => (
              <div key={message.id} className={`flex ${message.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.direction === 'outgoing'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}>
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'calls' && (
          <div className="space-y-4">
            {mockCommunications.calls.map((call) => (
              <div key={call.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Phone className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Call with {contact?.name || 'Contact'}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{call.timestamp.toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{call.duration}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{call.type}</p>
                  </div>
                </div>
                {call.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{call.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'emails' && (
          <div className="space-y-4">
            {mockCommunications.emails.map((email) => (
              <div key={email.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{email.subject}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {email.sender} → {email.recipient}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{email.timestamp.toLocaleDateString()}</p>
                    <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                      {email.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'meetings' && (
          <div className="space-y-4">
            {mockCommunications.meetings.map((meeting) => (
              <div key={meeting.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{meeting.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center mt-1">
                      <Calendar className="w-4 h-4 mr-2" />
                      {meeting.date.toLocaleDateString()} • {meeting.duration}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                    {meeting.status}
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Attendees:</p>
                  <div className="flex flex-wrap gap-2">
                    {meeting.attendees.map((attendee, index) => (
                      <span key={index} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                        {attendee}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};