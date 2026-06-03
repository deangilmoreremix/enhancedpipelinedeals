import React, { useMemo } from 'react';
import { Deal } from '../../types';
import {
  DollarSign, TrendingUp, Target, Award, BarChart3, PieChart,
  ArrowUp, ArrowDown, Activity, Clock, Zap
} from 'lucide-react';

interface KPIWidgetsProps {
  deals: Record<string, Deal>;
  timeRange?: 'today' | 'week' | 'month' | 'quarter' | 'year';
  onKPIClick?: (kpi: string) => void;
}

export const KPIWidgets: React.FC<KPIWidgetsProps> = ({
  deals,
  timeRange = 'month',
  onKPIClick
}) => {
  const analytics = useMemo(() => {
    const allDeals = Object.values(deals);
    const now = new Date();
    const rangeStart = new Date();

    switch (timeRange) {
      case 'today':
        rangeStart.setHours(0, 0, 0, 0);
        break;
      case 'week':
        rangeStart.setDate(now.getDate() - 7);
        break;
      case 'month':
        rangeStart.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        rangeStart.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        rangeStart.setFullYear(now.getFullYear() - 1);
        break;
    }

    const periodDeals = allDeals.filter(
      d => new Date(d.createdAt) >= rangeStart
    );

    const totalValue = periodDeals.reduce((sum, d) => sum + d.value, 0);
    const wonDeals = periodDeals.filter(d => d.stage === 'closed-won');
    const lostDeals = periodDeals.filter(d => d.stage === 'closed-lost');
    const activeDeals = periodDeals.filter(
      d => !['closed-won', 'closed-lost'].includes(d.stage)
    );

    const wonValue = wonDeals.reduce((sum, d) => sum + d.value, 0);
    const winRate = periodDeals.length > 0 ? (wonDeals.length / periodDeals.length) * 100 : 0;
    const conversionRate = activeDeals.length > 0 ? (wonDeals.length / activeDeals.length) * 100 : 0;

    const avgDealSize = periodDeals.length > 0 ? totalValue / periodDeals.length : 0;
    const avgDealAge = periodDeals.length > 0
      ? periodDeals.reduce((sum, d) => sum + (now.getTime() - new Date(d.createdAt).getTime()), 0) / (periodDeals.length * 1000 * 60 * 60 * 24)
      : 0;

    const avgProbability = periodDeals.length > 0
      ? periodDeals.reduce((sum, d) => sum + d.probability, 0) / periodDeals.length
      : 0;

    const weightedPipeline = activeDeals.reduce(
      (sum, d) => sum + (d.value * d.probability / 100), 0
    );

    const previousPeriodDeals = allDeals.filter(
      d => new Date(d.createdAt) < rangeStart && new Date(d.createdAt) >= new Date(rangeStart.getTime() - (now.getTime() - rangeStart.getTime()))
    );
    const previousWonValue = previousPeriodDeals
      .filter(d => d.stage === 'closed-won')
      .reduce((sum, d) => sum + d.value, 0);

    const growthRate = previousWonValue > 0 ? ((wonValue - previousWonValue) / previousWonValue) * 100 : 0;

    const stageValues = {
      qualification: allDeals.filter(d => d.stage === 'qualification').reduce((s, d) => s + d.value, 0),
      proposal: allDeals.filter(d => d.stage === 'proposal').reduce((s, d) => s + d.value, 0),
      negotiation: allDeals.filter(d => d.stage === 'negotiation').reduce((s, d) => s + d.value, 0)
    };

    return {
      totalValue,
      wonValue,
      winRate,
      conversionRate,
      avgDealSize,
      avgDealAge,
      avgProbability,
      weightedPipeline,
      growthRate,
      activeDeals: activeDeals.length,
      wonDeals: wonDeals.length,
      lostDeals: lostDeals.length,
      stageValues
    };
  }, [deals, timeRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const KPIWidget: React.FC<{
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ReactNode;
    iconBg: string;
    trend?: { value: number; direction: 'up' | 'down' };
    onClick?: () => void;
  }> = ({ title, value, subtitle, icon, iconBg, trend, onClick }) => (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center space-x-1 mt-2 text-sm font-medium ${
              trend.direction === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {trend.direction === 'up' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-gray-500 dark:text-gray-400">vs prev period</span>
            </div>
          )}
        </div>
        <div className={`p-3 ${iconBg} rounded-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
        <BarChart3 className="w-5 h-5 mr-2" />
        Key Performance Indicators
        <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400 capitalize">
          ({timeRange} view)
        </span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIWidget
          title="Total Pipeline Value"
          value={formatCurrency(analytics.totalValue)}
          subtitle={`${analytics.activeDeals} active deals`}
          icon={<DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />}
          iconBg="bg-green-100 dark:bg-green-900/30"
          trend={{ value: analytics.growthRate, direction: analytics.growthRate >= 0 ? 'up' : 'down' }}
          onClick={() => onKPIClick?.('totalValue')}
        />

        <KPIWidget
          title="Won Deals"
          value={formatCurrency(analytics.wonValue)}
          subtitle={`${analytics.wonDeals} deals closed`}
          icon={<Award className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          onClick={() => onKPIClick?.('wonDeals')}
        />

        <KPIWidget
          title="Win Rate"
          value={`${Math.round(analytics.winRate)}%`}
          subtitle={`${analytics.lostDeals} deals lost`}
          icon={<Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />}
          iconBg="bg-purple-100 dark:bg-purple-900/30"
          onClick={() => onKPIClick?.('winRate')}
        />

        <KPIWidget
          title="Avg Deal Size"
          value={formatCurrency(analytics.avgDealSize)}
          subtitle={`${analytics.activeDeals} in pipeline`}
          icon={<TrendingUp className="w-6 h-6 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          onClick={() => onKPIClick?.('avgDealSize')}
        />

        <KPIWidget
          title="Weighted Pipeline"
          value={formatCurrency(analytics.weightedPipeline)}
          subtitle={`${Math.round(analytics.avgProbability)}% avg probability`}
          icon={<Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />}
          iconBg="bg-indigo-100 dark:bg-indigo-900/30"
          onClick={() => onKPIClick?.('weightedPipeline')}
        />

        <KPIWidget
          title="Conversion Rate"
          value={`${Math.round(analytics.conversionRate)}%`}
          subtitle="Leads to won deals"
          icon={<Activity className="w-6 h-6 text-teal-600 dark:text-teal-400" />}
          iconBg="bg-teal-100 dark:bg-teal-900/30"
          onClick={() => onKPIClick?.('conversionRate')}
        />

        <KPIWidget
          title="Avg Deal Age"
          value={`${Math.round(analytics.avgDealAge)} days`}
          subtitle="Time in pipeline"
          icon={<Clock className="w-6 h-6 text-rose-600 dark:text-rose-400" />}
          iconBg="bg-rose-100 dark:bg-rose-900/30"
          onClick={() => onKPIClick?.('avgDealAge')}
        />

        <KPIWidget
          title="Stage Distribution"
          value={`${Object.keys(analytics.stageValues).length} stages`}
          subtitle="Qualification to Closed"
          icon={<PieChart className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />}
          iconBg="bg-cyan-100 dark:bg-cyan-900/30"
          onClick={() => onKPIClick?.('stageDistribution')}
        />
      </div>
    </div>
  );
};

export default KPIWidgets;