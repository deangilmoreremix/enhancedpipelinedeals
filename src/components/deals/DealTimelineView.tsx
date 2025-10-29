import React from 'react';
import { Deal } from '../../types';
import { Clock } from 'lucide-react';

interface DealTimelineViewProps {
  deals: Deal[];
}

export const DealTimelineView: React.FC<DealTimelineViewProps> = ({ deals }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
      <Clock className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Timeline View</h3>
      <p className="text-gray-600 dark:text-gray-400">
        Timeline view coming soon. You'll be able to see deals organized chronologically.
      </p>
    </div>
  );
};
