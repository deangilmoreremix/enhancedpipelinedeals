import React from 'react';
import { Mail, Phone, MessageSquare, Calendar } from 'lucide-react';
import { Deal } from '../../types';
import { Contact } from '../../types/contact';

interface DealCommunicationHubProps {
  deal: Deal;
  contact: Contact | null;
}

export const DealCommunicationHub: React.FC<DealCommunicationHubProps> = ({ deal, contact }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Communication Hub</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Manage all communications related to {deal.title}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800 transition-colors">
            <Mail className="w-6 h-6 text-green-600 dark:text-green-400 mb-2" />
            <p className="font-medium text-gray-900 dark:text-white">Send Email</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Compose a new message</p>
          </button>

          <button className="p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors">
            <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-2" />
            <p className="font-medium text-gray-900 dark:text-white">Make Call</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Start a phone call</p>
          </button>

          <button className="p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-800 transition-colors">
            <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400 mb-2" />
            <p className="font-medium text-gray-900 dark:text-white">Send Message</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Quick text message</p>
          </button>

          <button className="p-4 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors">
            <Calendar className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-2" />
            <p className="font-medium text-gray-900 dark:text-white">Schedule Meeting</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Book a time slot</p>
          </button>
        </div>

        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Recent Activity</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No recent communication activity for this deal.
          </p>
        </div>
      </div>
    </div>
  );
};
