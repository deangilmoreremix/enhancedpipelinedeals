import React from 'react';
import { Deal } from '../../types';
import { Contact } from '../../types/contact';
import { BarChart3, TrendingUp, DollarSign, Target } from 'lucide-react';

interface DealDashboardViewProps {
  deals: Record<string, Deal>;
  contacts: Contact[];
}

export const DealDashboardView: React.FC<DealDashboardViewProps> = ({ deals }) => {
  const dealsList = Object.values(deals);
  const totalValue = dealsList.reduce((sum, deal) => sum + deal.value, 0);
  const avgProbability = dealsList.length > 0
    ? dealsList.reduce((sum, deal) => sum + deal.probability, 0) / dealsList.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Pipeline Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ${totalValue.toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Deals</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {dealsList.length}
              </p>
            </div>
            <Target className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Win Probability</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {avgProbability.toFixed(0)}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <BarChart3 className="w-16 h-16 text-gray-400" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Analytics Dashboard</h3>
          <p className="text-gray-600 dark:text-gray-400">Detailed analytics coming soon...</p>
        </div>
      </div>
    </div>
  );
};
