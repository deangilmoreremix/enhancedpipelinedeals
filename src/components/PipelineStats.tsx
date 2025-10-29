import React from 'react';
import { DollarSign, TrendingUp, Target, BarChart3 } from 'lucide-react';
import { Tooltip } from './ui/Tooltip';

interface PipelineStatsProps {
  totalValue?: number;
  totalDeals?: number;
  averageDealSize?: number;
  conversionRate?: number;
}

const PipelineStats: React.FC<PipelineStatsProps> = ({
  totalValue = 380000,
  totalDeals = 6,
  averageDealSize = 63333,
  conversionRate = 16.7
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const stats = [
    {
      name: 'Total Pipeline Value',
      value: formatCurrency(totalValue),
      icon: DollarSign,
      change: '+12.5%',
      changeType: 'positive' as const,
      color: 'bg-blue-500',
      tooltip: 'Sum of all deal values currently in your pipeline across all stages'
    },
    {
      name: 'Active Deals',
      value: totalDeals.toString(),
      icon: BarChart3,
      change: '+3',
      changeType: 'positive' as const,
      color: 'bg-green-500',
      tooltip: 'Total number of deals in progress (excluding closed deals)'
    },
    {
      name: 'Average Deal Size',
      value: formatCurrency(averageDealSize),
      icon: TrendingUp,
      change: '+8.2%',
      changeType: 'positive' as const,
      color: 'bg-purple-500',
      tooltip: 'Average monetary value per deal, calculated from total pipeline value'
    },
    {
      name: 'Win Rate',
      value: `${conversionRate}%`,
      icon: Target,
      change: '+2.1%',
      changeType: 'positive' as const,
      color: 'bg-orange-500',
      tooltip: 'Percentage of deals won vs total deals (won + lost)'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat) => (
        <Tooltip key={stat.name} content={stat.tooltip} position="bottom">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white dark:text-gray-100" />
                </div>
              </div>
              <div className={`inline-flex items-baseline px-2.5 py-0.5 rounded-full text-sm font-medium ${
                stat.changeType === 'positive'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {stat.change}
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.name}</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
            </div>
          </div>
        </Tooltip>
      ))}
    </div>
  );
};

export default PipelineStats;