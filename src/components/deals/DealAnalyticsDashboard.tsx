import React from 'react';
import { BarChart3, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { Deal } from '../../types';

interface DealAnalyticsDashboardProps {
  deal: Deal;
}

export const DealAnalyticsDashboard: React.FC<DealAnalyticsDashboardProps> = ({ deal }) => {
  const daysActive = Math.ceil((new Date().getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const daysUntilDue = deal.dueDate
    ? Math.ceil((deal.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Deal Analytics</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">VALUE</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${deal.value.toLocaleString()}
            </p>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">PROBABILITY</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {deal.probability}%
            </p>
          </div>

          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">DAYS ACTIVE</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {daysActive}
            </p>
          </div>

          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">STAGE</span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">
              {deal.stage.replace('-', ' ')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Performance Metrics</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Deal Progress</span>
                  <span className="text-gray-900 dark:text-white font-medium">{deal.probability}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${deal.probability}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Expected Close Rate</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {deal.probability >= 80 ? 'High' : deal.probability >= 50 ? 'Medium' : 'Low'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      deal.probability >= 80 ? 'bg-green-500' :
                      deal.probability >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, deal.probability + 20)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {daysUntilDue !== null && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Timeline Status</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {daysUntilDue > 0
                  ? `${daysUntilDue} days remaining until due date`
                  : daysUntilDue === 0
                  ? 'Due today!'
                  : `${Math.abs(daysUntilDue)} days overdue`
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
