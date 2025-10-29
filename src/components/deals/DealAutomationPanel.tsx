import React from 'react';
import { Zap, Bell, Mail, Clock } from 'lucide-react';
import { Deal } from '../../types';

interface DealAutomationPanelProps {
  deal: Deal;
}

export const DealAutomationPanel: React.FC<DealAutomationPanelProps> = ({ deal }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Automation & Workflows</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Set up automated actions for {deal.title}
        </p>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Follow-up Reminders</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Automatically remind team members to follow up
                  </p>
                </div>
              </div>
              <button className="px-3 py-1 bg-blue-600 dark:bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800">
                Enable
              </button>
            </div>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Email Sequences</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Send automated email campaigns based on deal stage
                  </p>
                </div>
              </div>
              <button className="px-3 py-1 bg-green-600 dark:bg-green-700 text-white text-sm rounded-lg hover:bg-green-700 dark:hover:bg-green-800">
                Configure
              </button>
            </div>
          </div>

          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Stage Automation</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Automatically move deals between stages based on criteria
                  </p>
                </div>
              </div>
              <button className="px-3 py-1 bg-purple-600 dark:bg-purple-700 text-white text-sm rounded-lg hover:bg-purple-700 dark:hover:bg-purple-800">
                Setup
              </button>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Smart Triggers</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Create custom triggers for any deal event
                  </p>
                </div>
              </div>
              <button className="px-3 py-1 bg-yellow-600 dark:bg-yellow-700 text-white text-sm rounded-lg hover:bg-yellow-700 dark:hover:bg-yellow-800">
                Create
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
