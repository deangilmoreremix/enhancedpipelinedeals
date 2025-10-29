import React from 'react';
import { Mail, Phone, MessageSquare } from 'lucide-react';

interface DealCommunicationHubProps {
  dealId: string;
}

export const DealCommunicationHub: React.FC<DealCommunicationHubProps> = ({ dealId }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Communication Hub</h3>
      <div className="grid grid-cols-3 gap-4">
        <button className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
          <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
        </button>
        <button className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
          <Phone className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Call</span>
        </button>
        <button className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
          <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Message</span>
        </button>
      </div>
    </div>
  );
};
