import React from 'react';
import { Zap, Calendar, Bell } from 'lucide-react';

interface DealAutomationPanelProps {
  dealId: string;
}

export const DealAutomationPanel: React.FC<DealAutomationPanelProps> = ({ dealId }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
        <Zap className="w-5 h-5 text-yellow-500" />
        <span>Automation</span>
      </h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Auto follow-up</span>
          </div>
          <button className="text-xs px-2 py-1 bg-blue-600 text-white rounded">Setup</button>
        </div>
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Stage reminders</span>
          </div>
          <button className="text-xs px-2 py-1 bg-blue-600 text-white rounded">Setup</button>
        </div>
      </div>
    </div>
  );
};
