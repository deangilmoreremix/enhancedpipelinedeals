import React from 'react';
import { Deal } from '../../types';
import { Calendar } from 'lucide-react';

interface DealCalendarViewProps {
  deals: Record<string, Deal>;
  onDealClick: (dealId: string) => void;
  onDealUpdate: (id: string, updates: Partial<Deal>) => void;
  searchTerm: string;
  filterStage: string;
}

export const DealCalendarView: React.FC<DealCalendarViewProps> = ({ deals }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
      <div className="flex flex-col items-center justify-center space-y-4">
        <Calendar className="w-16 h-16 text-gray-400" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Calendar View</h3>
        <p className="text-gray-600 dark:text-gray-400">Calendar view coming soon...</p>
      </div>
    </div>
  );
};
