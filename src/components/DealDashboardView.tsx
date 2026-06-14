import React, { useMemo } from 'react';
import { Deal } from '../types';
import {
  DollarSign, TrendingUp, Target, Award, BarChart3,
  PieChart, Users, Calendar, ArrowUp, ArrowDown
} from 'lucide-react';
import {
  BarChart, Bar, PieChart as RePieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer
} from 'recharts';

interface DealDashboardViewProps {
  deals: Record<string, Deal>;
  contacts: any[];
}

export const DealDashboardView: React.FC<DealDashboardViewProps> = ({ deals }) => {
  const analytics = useMemo(() => {
    const allDeals = Object.values(deals);
    const totalValue = allDeals.reduce((sum, deal) => sum + deal.value, 0);
    const totalDeals = allDeals.length;
    const averageDealSize = totalDeals > 0 ? totalValue / totalDeals : 0;

    const wonDeals = allDeals.filter(deal => deal.stage === 'closed-won');
    const lostDeals = allDeals.filter(deal => deal.stage === 'closed-lost');
    const activeDeals = allDeals.filter(deal => !['closed-won', 'closed-lost'].includes(deal.stage));

    const wonValue = wonDeals.reduce((sum, deal) => sum + deal.value, 0);
    const winRate = totalDeals > 0 ? (wonDeals.length / totalDeals) * 100 : 0;
    const averageProbability = totalDeals > 0
      ? allDeals.reduce((sum, deal) => sum + deal.probability, 0) / totalDeals
      : 0;

    const stageDistribution = [
      { name: 'Qualification', value: allDeals.filter(d => d.stage === 'qualification').length, color: '#3b82f6' },
      { name: 'Proposal', value: allDeals.filter(d => d.stage === 'proposal').length, color: '#6366f1' },
      { name: 'Negotiation', value: allDeals.filter(d => d.stage === 'negotiation').length, color: '#f59e0b' },
      { name: 'Won', value: wonDeals.length, color: '#10b981' },
      { name: 'Lost', value: lostDeals.length, color: '#ef4444' }
    ].filter(stage => stage.value > 0);

    const valueByStage = [
      { stage: 'Qualification', value: allDeals.filter(d => d.stage === 'qualification').reduce((s, d) => s + d.value, 0) / 1000 },
      { stage: 'Proposal', value: allDeals.filter(d => d.stage === 'proposal').reduce((s, d) => s + d.value, 0) / 1000 },
      { stage: 'Negotiation', value: allDeals.filter(d => d.stage === 'negotiation').reduce((s, d) => s + d.value, 0) / 1000 },
      { stage: 'Won', value: wonValue / 1000 },
      { stage: 'Lost', value: lostDeals.reduce((s, d) => s + d.value, 0) / 1000 }
    ];

    const now = new Date();
    const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const monthDeals = allDeals.filter(deal => {
        const dealDate = new Date(deal.createdAt);
        return dealDate.getMonth() === date.getMonth() &&
               dealDate.getFullYear() === date.getFullYear();
      });
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        deals: monthDeals.length,
        value: monthDeals.reduce((s, d) => s + d.value, 0) / 1000,
        won: monthDeals.filter(d => d.stage === 'closed-won').length
      };
    });

    const topDeals = [...activeDeals]
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const aiScoredDeals = allDeals.filter(d => d.aiScore && d.aiScore > 0);
    const averageAIScore = aiScoredDeals.length > 0
      ? aiScoredDeals.reduce((sum, d) => sum + (d.aiScore || 0), 0) / aiScoredDeals.length
      : 0;

    return {
      totalValue,
      totalDeals,
      averageDealSize,
      wonValue,
      winRate,
      activeDeals: activeDeals.length,
      wonDeals: wonDeals.length,
      lostDeals: lostDeals.length,
      averageProbability,
      stageDistribution,
      valueByStage,
      monthlyTrend,
      topDeals,
      averageAIScore
    };
  }, [deals]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const chartTextColor = 'hsl(var(--muted-foreground))';
  const chartGridColor = 'hsl(var(--border))';
  const chartTooltipStyle = {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.75rem',
    color: 'hsl(var(--popover-foreground))',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)'
  };
  const chartLegendStyle = {
    color: chartTextColor
  };

  const StatCard: React.FC<{
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ReactNode;
    iconBg: string;
    trend?: { value: number; direction: 'up' | 'down' };
  }> = ({ title, value, subtitle, icon, iconBg, trend }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Pipeline Value"
          value={formatCurrency(analytics.totalValue)}
          subtitle={`${analytics.totalDeals} total deals`}
          icon={<DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />}
          iconBg="bg-green-100 dark:bg-green-900/30"
        />

        <StatCard
          title="Won Deals"
          value={formatCurrency(analytics.wonValue)}
          subtitle={`${analytics.wonDeals} deals closed`}
          icon={<Award className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
        />

        <StatCard
          title="Win Rate"
          value={`${Math.round(analytics.winRate)}%`}
          subtitle={`${analytics.lostDeals} deals lost`}
          icon={<Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />}
          iconBg="bg-purple-100 dark:bg-purple-900/30"
        />

        <StatCard
          title="Avg Deal Size"
          value={formatCurrency(analytics.averageDealSize)}
          subtitle={`${analytics.activeDeals} active deals`}
          icon={<TrendingUp className="w-6 h-6 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <BarChart3 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Value by Stage</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.valueByStage}>
              <CartesianGrid stroke={chartGridColor} opacity={0.35} />
              <XAxis
                dataKey="stage"
                stroke={chartTextColor}
                tick={{ fill: chartTextColor }}
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke={chartTextColor}
                tick={{ fill: chartTextColor }}
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `$${value}K`}
              />
              <RechartsTooltip
                contentStyle={chartTooltipStyle}
                labelStyle={{ color: chartTextColor }}
                itemStyle={{ color: chartTextColor }}
                formatter={(value: number) => [`$${value.toFixed(0)}K`, 'Value']}
              />
              <Legend wrapperStyle={chartLegendStyle} />
              <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <PieChart className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stage Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RePieChart>
              <Pie
                data={analytics.stageDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent, x, y }: { name?: string; percent?: number; x?: number; y?: number }) => (
                  <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="hsl(var(--foreground))" fontSize={12}>
                    {name} {(percent * 100).toFixed(0)}%
                  </text>
                )}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {analytics.stageDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={chartTooltipStyle}
                labelStyle={{ color: chartTextColor }}
                itemStyle={{ color: chartTextColor }}
              />
              <Legend wrapperStyle={chartLegendStyle} />
            </RePieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Calendar className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">6-Month Trend</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.monthlyTrend}>
            <CartesianGrid stroke={chartGridColor} opacity={0.35} />
            <XAxis
              dataKey="month"
              stroke={chartTextColor}
              tick={{ fill: chartTextColor }}
              style={{ fontSize: '12px' }}
            />
            <YAxis
              yAxisId="left"
              stroke={chartTextColor}
              tick={{ fill: chartTextColor }}
              style={{ fontSize: '12px' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={chartTextColor}
              tick={{ fill: chartTextColor }}
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `$${value}K`}
            />
            <RechartsTooltip
              contentStyle={chartTooltipStyle}
              labelStyle={{ color: chartTextColor }}
              itemStyle={{ color: chartTextColor }}
            />
            <Legend wrapperStyle={chartLegendStyle} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="deals"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Total Deals"
                dot={{ fill: '#3b82f6', r: 4 }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="won"
                stroke="#10b981"
                strokeWidth={2}
                name="Won Deals"
                dot={{ fill: '#10b981', r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="value"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Value ($K)"
                dot={{ fill: '#f59e0b', r: 4 }}
              />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Users className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Deals by Value</h3>
          </div>
          <div className="space-y-3">
            {analytics.topDeals.length > 0 ? (
              analytics.topDeals.map((deal, index) => (
                <div
                  key={deal.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {index + 1}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{deal.title}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{deal.company}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatCurrency(deal.value)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {deal.probability}% likely
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-8">
                No active deals to display
              </p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <TrendingUp className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Key Metrics</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">Average Probability</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {Math.round(analytics.averageProbability)}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">Average AI Score</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {analytics.averageAIScore > 0 ? Math.round(analytics.averageAIScore) : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">Active Pipeline</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {analytics.activeDeals} deals
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">Weighted Pipeline</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {formatCurrency(
                  Object.values(deals)
                    .filter(d => !['closed-won', 'closed-lost'].includes(d.stage))
                    .reduce((sum, d) => sum + (d.value * d.probability / 100), 0)
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
