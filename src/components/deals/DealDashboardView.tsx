import React from 'react';
import { Deal } from '../../types';
import { BarChart3 } from 'lucide-react';

interface DealDashboardViewProps {
  deals: Deal[];
}

export const DealDashboardView: React.FC<DealDashboardViewProps> = ({ deals }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
      <BarChart3 className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Dashboard View</h3>
      <p className="text-gray-600 dark:text-gray-400">
        Dashboard view coming soon. You'll be able to see comprehensive analytics and insights.
      </p>
    </div>
  );
};
