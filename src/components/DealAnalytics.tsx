import React, { useState, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  DollarSign, 
  Target, 
  Users, 
  TrendingUp, 
  Activity, 
  ZapOff, 
  Calendar,
  ArrowUp,
  BarChart3,
  ChevronDown
} from 'lucide-react';
import { Deal } from '../types';

interface DealAnalyticsProps {
  deals: Record<string, Deal>;
  contacts?: any[];
}

interface KPIMetric {
  title: string;
  value: string;
  change: number;
  changeType: 'increase' | 'decrease';
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface PipelineStage {
  name: string;
  value: number;
  deals: number;
  color: string;
}

const DealAnalytics: React.FC<DealAnalyticsProps> = ({ deals, contacts = [] }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  // Calculate KPI metrics
  const calculateKPIs = (): KPIMetric[] => {
    const dealsArray = deals ? Object.values(deals) : [];
    const totalRevenue = dealsArray
      .filter(deal => deal.stage === 'closed-won')
      .reduce((sum, deal) => sum + deal.value, 0);
    const totalDeals = dealsArray.length;
    const wonDeals = dealsArray.filter(deal => deal.stage === 'closed-won').length;
    const conversionRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;
    const totalContacts = contacts?.length || 0;
    const avgDealSize = wonDeals > 0 ? totalRevenue / wonDeals : 0;
    
    return [
      {
        title: 'Total Revenue',
        value: `$${(totalRevenue / 1000).toFixed(1)}k`,
        change: 12.5,
        changeType: 'increase',
        icon: DollarSign,
        description: 'Revenue from closed deals'
      },
      {
        title: 'Conversion Rate',
        value: `${conversionRate.toFixed(1)}%`,
        change: 8.2,
        changeType: 'increase',
        icon: Target,
        description: 'Deals won vs total deals'
      },
      {
        title: 'Total Contacts',
        value: totalContacts.toString(),
        change: 15.3,
        changeType: 'increase',
        icon: Users,
        description: 'Active contacts in pipeline'
      },
      {
        title: 'Avg Deal Size',
        value: `$${(avgDealSize / 1000).toFixed(1)}k`,
        change: -2.1,
        changeType: 'decrease',
        icon: TrendingUp,
        description: 'Average revenue per deal'
      }
    ];
  };

  // Calculate stage data
  const stageData = useMemo(() => {
    const dealsArray = Object.values(deals);
    const stageValues: Record<string, number> = {};
    const dealCounts: Record<string, number> = {};
    
    ['qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost'].forEach(stage => {
      const stageDeals = dealsArray.filter(deal => deal.stage === stage);
      stageValues[stage] = stageDeals.reduce((sum, deal) => sum + deal.value, 0);
      dealCounts[stage] = stageDeals.length;
    });

    return { stageValues, dealCounts };
  }, [deals]);

  // Enhanced pipeline stage data with colors
  const pipelineStageData: PipelineStage[] = [
    {
      name: 'Qualification',
      value: stageData.stageValues.qualification || 0,
      deals: stageData.dealCounts.qualification || 0,
      color: '#3B82F6'
    },
    {
      name: 'Proposal',
      value: stageData.stageValues.proposal || 0,
      deals: stageData.dealCounts.proposal || 0,
      color: '#8B5CF6'
    },
    {
      name: 'Negotiation',
      value: stageData.stageValues.negotiation || 0,
      deals: stageData.dealCounts.negotiation || 0,
      color: '#F59E0B'
    },
    {
      name: 'Won',
      value: stageData.stageValues['closed-won'] || 0,
      deals: stageData.dealCounts['closed-won'] || 0,
      color: '#10B981'
    },
    {
      name: 'Lost',
      value: stageData.stageValues['closed-lost'] || 0,
      deals: stageData.dealCounts['closed-lost'] || 0,
      color: '#EF4444'
    }
  ];

  // Generate trend data for chart
  const generateTrendData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const totalValue = Object.values(deals).reduce((sum, deal) => sum + deal.value, 0);
    
    return months.map((month, index) => ({
      month,
      revenue: Math.floor(totalValue * (0.7 + Math.random() * 0.6) / 6),
      deals: Math.floor(Object.keys(deals).length * (0.8 + Math.random() * 0.4) / 6),
      pipeline: Math.floor((stageData.stageValues.qualification + stageData.stageValues.proposal + stageData.stageValues.negotiation) * (0.6 + Math.random() * 0.8) / 6)
    }));
  };

  const trendData = generateTrendData();
  const kpiMetrics = calculateKPIs();

  // Calculate value by status
  const valueByStatus = {
    active: (stageData.stageValues.qualification || 0) + (stageData.stageValues.proposal || 0) + (stageData.stageValues.negotiation || 0),
    won: stageData.stageValues['closed-won'] || 0,
    lost: stageData.stageValues['closed-lost'] || 0
  };

  // Convert to array format for charts
  const stageDataArray = Object.entries(stageData.dealCounts).map(([stage, count]) => ({
    stage: stage === 'closed-won' ? 'Won' : 
           stage === 'closed-lost' ? 'Lost' :
           stage === 'qualification' ? 'Qualified' : 
           stage === 'proposal' ? 'Proposed' : 'Negotiating',
    count
  }));

  // Calculate conversion rates between stages
  const calculateConversionRate = (fromStage: string, toStage: string) => {
    const fromCount = stageData.dealCounts[fromStage as keyof typeof stageData.dealCounts];
    const toCount = stageData.dealCounts[toStage as keyof typeof stageData.dealCounts];
    
    return fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0;
  };

  const conversionRates = {
    qualToProposal: calculateConversionRate('qualification', 'proposal'),
    proposalToNegotiation: calculateConversionRate('proposal', 'negotiation'),
    negotiationToWon: calculateConversionRate('negotiation', 'closed-won')
  };

  return (
    <div className="space-y-6 mb-8">
      {/* KPI Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiMetrics.map((metric, index) => (
          <div key={index} className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
                <metric.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                metric.changeType === 'increase' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {metric.changeType === 'increase' ? '+' : ''}{metric.change}%
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value}</p>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{metric.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{metric.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Cards with Gradients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-blue-800">Active Pipeline</p>
              <p className="text-xl font-semibold mt-1">${Math.round(valueByStatus.active / 1000)}k</p>
            </div>
            <div className="p-2 rounded-full bg-blue-200/50">
              <Activity className="h-5 w-5 text-blue-700" />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-green-800">Won Deals (YTD)</p>
              <p className="text-xl font-semibold mt-1">${Math.round(valueByStatus.won / 1000)}k</p>
            </div>
            <div className="p-2 rounded-full bg-green-200/50">
              <TrendingUp className="h-5 w-5 text-green-700" />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-red-800">Lost Deals (YTD)</p>
              <p className="text-xl font-semibold mt-1">${Math.round(valueByStatus.lost / 1000)}k</p>
            </div>
            <div className="p-2 rounded-full bg-red-200/50">
              <ZapOff className="h-5 w-5 text-red-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Line Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Revenue Performance Trend</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedPeriod('week')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  selectedPeriod === 'week' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setSelectedPeriod('month')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  selectedPeriod === 'month' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setSelectedPeriod('quarter')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  selectedPeriod === 'quarter' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Quarter
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
                axisLine={{ stroke: '#e0e0e0' }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                axisLine={{ stroke: '#e0e0e0' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  name === 'revenue' ? `$${(value / 1000).toFixed(1)}k` : value,
                  name === 'revenue' ? 'Revenue' : name === 'deals' ? 'Deals Closed' : 'Pipeline Value'
                ]}
                labelStyle={{ color: '#374151' }}
                contentStyle={{ 
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#3B82F6" 
                strokeWidth={3}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, stroke: '#3B82F6', strokeWidth: 2, fill: '#ffffff' }}
              />
              <Line 
                type="monotone" 
                dataKey="pipeline" 
                stroke="#8B5CF6" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline Distribution Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Pipeline Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pipelineStageData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={5}
                dataKey="value"
              >
                {pipelineStageData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => [`$${(value / 1000).toFixed(1)}k`, 'Value']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stage Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Stage Performance</h3>
          <div className="space-y-4">
            {pipelineStageData.map((stage, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="font-medium text-gray-700">{stage.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">${(stage.value / 1000).toFixed(1)}k</p>
                  <p className="text-sm text-gray-500">{stage.deals} deals</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deal Distribution Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Deal Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stageDataArray} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis dataKey="stage" type="category" />
              <Tooltip 
                formatter={(value: any) => [`${value} deals`, 'Count']}
                contentStyle={{ borderRadius: '6px' }}
              />
              <Bar 
                dataKey="count" 
                fill="#4f46e5"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Rates & Quick Stats */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Conversion Rates</h3>
          <div className="grid grid-cols-1 gap-2 mb-4">
            <div className="border border-indigo-100 bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-xs text-indigo-600 mb-1">Qual → Proposal</p>
              <p className="text-lg font-medium">{conversionRates.qualToProposal}%</p>
            </div>
            <div className="border border-indigo-100 bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-xs text-indigo-600 mb-1">Prop → Negotiation</p>
              <p className="text-lg font-medium">{conversionRates.proposalToNegotiation}%</p>
            </div>
            <div className="border border-indigo-100 bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-xs text-indigo-600 mb-1">Neg → Won</p>
              <p className="text-lg font-medium">{conversionRates.negotiationToWon}%</p>
            </div>
          </div>
          
          {/* Quick Stats Summary */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Stats</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Top Deal</span>
                <div className="flex items-center">
                  <DollarSign size={16} className="text-green-600" />
                  <span className="text-sm font-medium">$120k</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Avg Time to Close</span>
                <div className="flex items-center">
                  <Calendar size={16} className="text-blue-600" />
                  <span className="text-sm font-medium">32 days</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Win Rate</span>
                <div className="flex items-center">
                  <ArrowUp size={16} className="text-green-600" />
                  <span className="text-sm font-medium">{((stageData.dealCounts['closed-won'] || 0) / Object.values(stageData.dealCounts).reduce((a, b) => a + b, 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealAnalytics;