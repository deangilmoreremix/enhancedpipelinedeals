import React from 'react';
import { Deal } from '../../types';
import { DollarSign, TrendingUp, Target, BarChart3 } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

interface WeightedPipelineTotalProps {
  deals: Deal[];
  totalValue?: number;
  totalDeals?: number;
  showBreakdown?: boolean;
}

interface WeightedStats {
  weightedTotal: number;
  totalValue: number;
  totalDeals: number;
  weightedAverage: number;
  stageBreakdown: Record<string, { value: number; weighted: number; count: number }>;
}

const WeightedPipelineTotal: React.FC<WeightedPipelineTotalProps> = ({
  deals,
  totalValue,
  totalDeals,
  showBreakdown = true
}) => {
  const calculateWeightedStats = (): WeightedStats => {
    const stats: WeightedStats = {
      weightedTotal: 0,
      totalValue: 0,
      totalDeals: deals.length,
      weightedAverage: 0,
      stageBreakdown: {}
    };

    deals.forEach((deal) => {
      const probability = deal.probability ?? 100;
      const weightedValue = (deal.value * probability) / 100;

      stats.weightedTotal += weightedValue;
      stats.totalValue += deal.value;

      if (!stats.stageBreakdown[deal.stage]) {
        stats.stageBreakdown[deal.stage] = { value: 0, weighted: 0, count: 0 };
      }
      stats.stageBreakdown[deal.stage].value += deal.value;
      stats.stageBreakdown[deal.stage].weighted += weightedValue;
      stats.stageBreakdown[deal.stage].count += 1;
    });

    stats.weightedAverage = stats.totalDeals > 0 ? stats.weightedTotal / stats.totalDeals : 0;

    return stats;
  };

  const stats = calculateWeightedStats();
  const displayTotal = totalValue ?? stats.totalValue;
  const displayDeals = totalDeals ?? stats.totalDeals;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value)}%`;
  };

  const enhancedStats = [
    {
      name: 'Weighted Pipeline Value',
      value: formatCurrency(stats.weightedTotal),
      icon: DollarSign,
      color: 'bg-blue-500',
      tooltip: 'Expected value calculated by applying probability to each deal value'
    },
    {
      name: 'Total Pipeline Value',
      value: formatCurrency(displayTotal),
      icon: TrendingUp,
      color: 'bg-green-500',
      tooltip: 'Sum of all deal values in your pipeline'
    },
    {
      name: 'Weighted Average',
      value: formatCurrency(stats.weightedAverage),
      icon: Target,
      color: 'bg-purple-500',
      tooltip: 'Average weighted deal value across all active deals'
    },
    {
      name: 'Active Deals',
      value: displayDeals.toString(),
      icon: BarChart3,
      color: 'bg-orange-500',
      tooltip: 'Total number of deals in your pipeline'
    }
  ];

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      qualification: 'bg-blue-100 text-blue-700',
      proposal: 'bg-yellow-100 text-yellow-700',
      negotiation: 'bg-orange-100 text-orange-700',
      'closed-won': 'bg-green-100 text-green-700',
      'closed-lost': 'bg-red-100 text-red-700'
    };
    return colors[stage] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {enhancedStats.map((stat) => (
          <Tooltip key={stat.name} content={stat.tooltip} position="bottom">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <stat.icon className="h-6 w-6 text-white dark:text-gray-100" />
                  </div>
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

      {showBreakdown && Object.keys(stats.stageBreakdown).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pipeline Breakdown by Stage</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Stage</th>
                  <th className="text-right py-2 font-medium text-gray-700 dark:text-gray-300">Deals</th>
                  <th className="text-right py-2 font-medium text-gray-700 dark:text-gray-300">Total Value</th>
                  <th className="text-right py-2 font-medium text-gray-700 dark:text-gray-300">Weighted Value</th>
                  <th className="text-right py-2 font-medium text-gray-700 dark:text-gray-300">Avg Probability</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.stageBreakdown).map(([stage, data]) => (
                  <tr key={stage} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <td className="py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getStageColor(stage)}`}>
                        {stage.replace(/-/g, ' ')}
                      </span>
                    </td>
                    <td className="text-right py-3 font-medium">{data.count}</td>
                    <td className="text-right py-3">{formatCurrency(data.value)}</td>
                    <td className="text-right py-3 font-medium text-green-600">{formatCurrency(data.weighted)}</td>
                    <td className="text-right py-3">
                      {formatPercentage(data.count > 0 ? (data.weighted / data.value) * 100 : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeightedPipelineTotal;