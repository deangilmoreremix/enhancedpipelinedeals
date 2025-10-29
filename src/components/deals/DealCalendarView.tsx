import React from 'react';
import { Deal } from '../../types';
import { Calendar } from 'lucide-react';

interface DealCalendarViewProps {
  deals: Deal[];
}

export const DealCalendarView: React.FC<DealCalendarViewProps> = ({ deals }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
      <Calendar className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Calendar View</h3>
      <p className="text-gray-600 dark:text-gray-400">
        Calendar view coming soon. You'll be able to see deals organized by their due dates.
      </p>
    </div>
  );
};
