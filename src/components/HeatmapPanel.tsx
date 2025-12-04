import React, { useState, useMemo } from 'react';
import { Flame, TrendingUp, TrendingDown, Activity, Calendar, Users } from 'lucide-react';
import { ModernButton } from './ui/ModernButton';

export const HeatmapPanel: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [metric, setMetric] = useState<'value' | 'count' | 'conversion'>('value');

  // Mock heatmap data
  const heatmapData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const data = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      data.push({
        date: date.toISOString().split('T')[0],
        deals: Math.floor(Math.random() * 20) + 1,
        value: Math.floor(Math.random() * 50000) + 10000,
        conversions: Math.floor(Math.random() * 5),
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        month: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }

    return data.reverse();
  }, [timeRange]);

  const getHeatmapColor = (value: number, maxValue: number) => {
    const intensity = value / maxValue;
    if (intensity < 0.25) return 'bg-gray-100 dark:bg-gray-800';
    if (intensity < 0.5) return 'bg-blue-200 dark:bg-blue-900';
    if (intensity < 0.75) return 'bg-blue-400 dark:bg-blue-700';
    return 'bg-blue-600 dark:bg-blue-500';
  };

  const maxValue = Math.max(...heatmapData.map(d =>
    metric === 'value' ? d.value : metric === 'count' ? d.deals : d.conversions
  ));

  const insights = [
    { label: 'Peak Day', value: 'Wednesday', change: '+23%', trend: 'up' },
    { label: 'Best Hour', value: '2-4 PM', change: '+18%', trend: 'up' },
    { label: 'Top Source', value: 'LinkedIn', change: '+31%', trend: 'up' },
    { label: 'Conversion Rate', value: '24.5%', change: '-2%', trend: 'down' }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Flame className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" />
            Deal Heatmap
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Visual analysis of deal patterns and performance trends
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as 'value' | 'count' | 'conversion')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="value">Deal Value</option>
            <option value="count">Deal Count</option>
            <option value="conversion">Conversions</option>
          </select>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="mb-6">
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {heatmapData.map((day, index) => {
            const value = metric === 'value' ? day.value : metric === 'count' ? day.deals : day.conversions;
            const colorClass = getHeatmapColor(value, maxValue);

            return (
              <div
                key={day.date}
                className={`aspect-square rounded-sm ${colorClass} flex items-center justify-center text-xs font-medium cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all`}
                title={`${day.month}: ${metric === 'value' ? `$${value.toLocaleString()}` : value} ${metric === 'conversion' ? 'conversions' : metric === 'count' ? 'deals' : 'value'}`}
              >
                {value > maxValue * 0.8 && <div className="w-2 h-2 bg-white rounded-full opacity-60" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {insights.map((insight, index) => (
          <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{insight.label}</span>
              <div className={`flex items-center text-xs font-medium ${
                insight.trend === 'up'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {insight.trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                {insight.change}
              </div>
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{insight.value}</div>
          </div>
        ))}
      </div>

      {/* Performance Metrics */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
          <Activity className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
          Performance Analysis
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Best Performing Day</span>
              <Calendar className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">Wednesday</div>
            <div className="text-xs text-green-600 dark:text-green-400">+23% vs average</div>
          </div>

          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Peak Activity Hour</span>
              <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">2-4 PM</div>
            <div className="text-xs text-blue-600 dark:text-blue-400">Highest engagement</div>
          </div>

          <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Top Lead Source</span>
              <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">LinkedIn</div>
            <div className="text-xs text-purple-600 dark:text-purple-400">31% of deals</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
        <div className="flex space-x-3">
          <ModernButton variant="outline" size="sm">
            Export Data
          </ModernButton>
          <ModernButton variant="primary" size="sm">
            View Details
          </ModernButton>
        </div>
      </div>
    </div>
  );
};