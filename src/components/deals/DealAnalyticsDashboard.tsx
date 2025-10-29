import React from 'react';
import { BarChart3, TrendingUp, Activity } from 'lucide-react';

interface DealAnalyticsDashboardProps {
  dealId: string;
}

export const DealAnalyticsDashboard: React.FC<DealAnalyticsDashboardProps> = ({ dealId }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
        <BarChart3 className="w-5 h-5" />
        <span>Analytics</span>
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-2" />
          <p className="text-xs text-gray-600 dark:text-gray-400">Deal Momentum</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">Rising</p>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <Activity className="w-6 h-6 text-green-600 dark:text-green-400 mb-2" />
          <p className="text-xs text-gray-600 dark:text-gray-400">Engagement</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">High</p>
        </div>
      </div>
    </div>
  );
};
