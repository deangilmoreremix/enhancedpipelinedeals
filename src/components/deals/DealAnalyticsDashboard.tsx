import React, { useState } from 'react';
import { Deal } from '../../types';
import { 
  BarChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, AreaChart, Area
} from 'recharts';
import { 
  BarChart2, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Mail, 
  Phone, 
  MessageSquare,
  ArrowUp,
  ArrowDown,
  Target,
  Activity,
  DollarSign,
  CheckCircle,
  X as XIcon,
  AlertTriangle,
  PieChart as PieChartIcon,
  Users,
  Building2,
  Layers,
  User as UserIcon
} from 'lucide-react';

interface DealAnalyticsDashboardProps {
  deal: Deal;
}

export const DealAnalyticsDashboard: React.FC<DealAnalyticsDashboardProps> = ({ deal }) => {
  const [timeframe, setTimeframe] = useState<'30d' | '90d' | 'ytd' | 'all'>('30d');
  
  // Sample data for charts and analytics - in a real app, this would come from API calls
  
  // Generate activity timeline data
  const activityData = [
    { date: '2023-06-15', emails: 2, calls: 0, meetings: 1, stage: 'qualification' },
    { date: '2023-07-01', emails: 3, calls: 1, meetings: 0, stage: 'qualification' },
    { date: '2023-07-15', emails: 1, calls: 2, meetings: 0, stage: 'proposal' },
    { date: '2023-07-30', emails: 4, calls: 0, meetings: 1, stage: 'proposal' },
    { date: '2023-08-15', emails: 2, calls: 1, meetings: 0, stage: 'proposal' },
    { date: '2023-09-01', emails: 3, calls: 1, meetings: 1, stage: 'negotiation' },
    { date: '2023-09-15', emails: 1, calls: 2, meetings: 0, stage: 'negotiation' },
  ];
  
  // Stage duration data
  const stageDurationData = [
    { name: 'Qualification', days: 16 },
    { name: 'Proposal', days: 32 },
    { name: 'Negotiation', days: 22 },
    { name: 'Closing', days: deal.stage === 'closed-won' || deal.stage === 'closed-lost' ? 5 : 0 }
  ];
  
  // Similar deals data
  const similarDealsData = [
    { id: 1, title: 'Software License - Company A', value: 65000, stage: 'closed-won', daysToClose: 45 },
    { id: 2, title: 'Cloud Services - Company B', value: 78000, stage: 'closed-lost', daysToClose: 60 },
    { id: 3, title: 'Enterprise Solution - Company C', value: 120000, stage: 'closed-won', daysToClose: 75 },
    { id: 4, title: 'SaaS Implementation - Company D', value: 45000, stage: 'closed-won', daysToClose: 30 },
  ];
  
  // Engagement types breakdown
  const engagementData = [
    { name: 'Emails', value: 16, color: '#3b82f6' },
    { name: 'Calls', value: 7, color: '#10b981' },
    { name: 'Meetings', value: 3, color: '#8b5cf6' }
  ];
  
  // Probability history
  const probabilityData = [
    { date: '2023-06-15', value: 20 },
    { date: '2023-07-01', value: 25 },
    { date: '2023-07-15', value: 35 },
    { date: '2023-07-30', value: 40 },
    { date: '2023-08-15', value: 55 },
    { date: '2023-09-01', value: 70 },
    { date: '2023-09-15', value: deal.probability }
  ];
  
  // KPI calculations
  const dealAgeDays = Math.ceil((new Date().getTime() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const avgSimilarDealCloseTime = Math.round(similarDealsData.reduce((sum, deal) => sum + deal.daysToClose, 0) / similarDealsData.length);
  const daysRemaining = deal.dueDate ? Math.ceil((deal.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 30;
  
  // Success metrics based on similar deals
  const wonSimilarDeals = similarDealsData.filter(d => d.stage === 'closed-won');
  const avgSimilarDealValue = Math.round(wonSimilarDeals.reduce((sum, deal) => sum + deal.value, 0) / wonSimilarDeals.length);
  const similarDealsWinRate = Math.round((wonSimilarDeals.length / similarDealsData.length) * 100);
  
  // Calculate win probability factors
  const winFactors = [
    { factor: 'Deal Size', impact: deal.value > avgSimilarDealValue ? 'positive' : 'negative', weight: 20 },
    { factor: 'Engagement Level', impact: engagementData.reduce((sum, item) => sum + item.value, 0) > 20 ? 'positive' : 'neutral', weight: 25 },
    { factor: 'Deal Age', impact: dealAgeDays < avgSimilarDealCloseTime ? 'positive' : 'negative', weight: 15 },
    { factor: 'Stage Progress', impact: deal.stage === 'negotiation' ? 'positive' : 'neutral', weight: 30 },
    { factor: 'Priority', impact: deal.priority === 'high' ? 'positive' : 'neutral', weight: 10 }
  ];
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <BarChart2 className="w-5 h-5 mr-2 text-blue-600" />
          Deal Analytics Dashboard
        </h3>
        
        {/* Time Range Selector */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {[
            { id: '30d', label: '30 Days' },
            { id: '90d', label: '90 Days' },
            { id: 'ytd', label: 'YTD' },
            { id: 'all', label: 'All Time' }
          ].map(option => (
            <button
              key={option.id}
              onClick={() => setTimeframe(option.id as any)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                timeframe === option.id 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700`}>
              <ArrowUp className="inline h-3 w-3 mr-1" />
              +15%
            </span>
          </div>
          <h4 className="text-sm font-medium text-gray-500">Deal Value</h4>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(deal.value)}</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Target className="h-5 w-5 text-purple-600" />
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              deal.probability > probabilityData[0].value 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {deal.probability > probabilityData[0].value 
                ? <ArrowUp className="inline h-3 w-3 mr-1" />
                : <ArrowDown className="inline h-3 w-3 mr-1" />
              }
              {Math.abs(deal.probability - probabilityData[0].value)}%
            </span>
          </div>
          <h4 className="text-sm font-medium text-gray-500">Win Probability</h4>
          <p className="text-2xl font-bold text-gray-900 mt-1">{deal.probability}%</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-green-100">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700`}>
              {deal.dueDate ? 'Set' : 'Not Set'}
            </span>
          </div>
          <h4 className="text-sm font-medium text-gray-500">Expected Close</h4>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {deal.dueDate 
              ? deal.dueDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})
              : 'N/A'}
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              dealAgeDays > avgSimilarDealCloseTime 
                ? 'bg-yellow-100 text-yellow-700' 
                : 'bg-green-100 text-green-700'
            }`}>
              {dealAgeDays > avgSimilarDealCloseTime 
                ? `+${dealAgeDays - avgSimilarDealCloseTime}d` 
                : 'On track'
              }
            </span>
          </div>
          <h4 className="text-sm font-medium text-gray-500">Deal Age</h4>
          <p className="text-2xl font-bold text-gray-900 mt-1">{dealAgeDays} days</p>
        </div>
      </div>
      
      {/* Win Probability Factors */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2 text-purple-600" />
          Win Probability Factors
        </h4>
        
        <div className="space-y-4">
          {winFactors.map((factor, index) => (
            <div key={index}>
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-700">{factor.factor}</span>
                  <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {factor.weight}%
                  </span>
                </div>
                <span className={`text-xs font-medium flex items-center ${
                  factor.impact === 'positive' 
                    ? 'text-green-600' 
                    : factor.impact === 'negative' 
                    ? 'text-red-600'
                    : 'text-gray-600'
                }`}>
                  {factor.impact === 'positive' 
                    ? <CheckCircle className="w-3 h-3 mr-1" />
                    : factor.impact === 'negative'
                    ? <XIcon className="w-3 h-3 mr-1" />
                    : <AlertTriangle className="w-3 h-3 mr-1" />
                  }
                  {factor.impact.charAt(0).toUpperCase() + factor.impact.slice(1)} Impact
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full ${
                    factor.impact === 'positive' 
                      ? 'bg-green-500' 
                      : factor.impact === 'negative'
                      ? 'bg-red-500'
                      : 'bg-gray-400'
                  }`} 
                  style={{ width: `${factor.weight}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Overall Probability Indicator */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Win Probability</span>
            <span className={`text-sm font-bold ${
              deal.probability >= 70 
                ? 'text-green-600' 
                : deal.probability >= 40
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}>{deal.probability}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${
                deal.probability >= 70 
                  ? 'bg-green-500' 
                  : deal.probability >= 40
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`} 
              style={{ width: `${deal.probability}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      {/* Multi-Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Probability History Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
            Win Probability Trend
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={probabilityData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                />
                <YAxis 
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <Tooltip 
                  formatter={(value: number) => [`${value}%`, 'Probability']}
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Engagement Mix */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
            <MessageSquare className="w-4 h-4 mr-2 text-blue-600" />
            Engagement Mix
          </h4>
          <div className="grid grid-cols-5 h-64">
            <div className="col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={engagementData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {engagementData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, 'Interactions']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="col-span-3 flex flex-col justify-center">
              {engagementData.map((item, index) => (
                <div key={index} className="flex items-center mb-3">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm text-gray-600 mr-2">{item.name}:</span>
                  <span className="text-sm font-semibold text-gray-900">{item.value} interactions</span>
                </div>
              ))}
              
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Interactions:</span>
                  <span className="text-sm font-bold text-gray-900">
                    {engagementData.reduce((sum, item) => sum + item.value, 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-600">Last Interaction:</span>
                  <span className="text-sm font-medium text-gray-900">
                    3 days ago
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Stage Duration */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <Layers className="w-5 h-5 mr-2 text-indigo-600" />
          Stage Duration Analysis
        </h4>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stageDurationData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" />
              <YAxis 
                label={{ value: 'Days in Stage', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip />
              <Bar dataKey="days" fill="#8884d8" radius={[4, 4, 0, 0]}>
                {stageDurationData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={
                      entry.name === 'Qualification' ? '#3b82f6' : 
                      entry.name === 'Proposal' ? '#8b5cf6' : 
                      entry.name === 'Negotiation' ? '#ec4899' : 
                      '#10b981'
                    } 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="grid grid-cols-4 gap-4 mt-4">
          {stageDurationData.map((stage, index) => (
            <div key={index} className={`p-3 rounded-lg ${
              stage.name === 'Qualification' ? 'bg-blue-50' : 
              stage.name === 'Proposal' ? 'bg-purple-50' : 
              stage.name === 'Negotiation' ? 'bg-pink-50' : 
              'bg-green-50'
            }`}>
              <p className="text-sm font-medium mb-1">{stage.name}</p>
              <div className="flex items-baseline">
                <p className="text-xl font-bold mr-1">{stage.days}</p>
                <p className="text-xs text-gray-500">days</p>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {stage.days > 0 && (
                  stage.days > 30 
                    ? 'Above average'
                    : stage.days > 15
                    ? 'Average'
                    : 'Below average'
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Similar Deals & Benchmarking */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <PieChartIcon className="w-5 h-5 mr-2 text-green-600" />
          Similar Deals Benchmark
        </h4>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outcome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days to Close</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Compare</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {similarDealsData.map((similarDeal) => (
                <tr key={similarDeal.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{similarDeal.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(similarDeal.value)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      similarDeal.stage === 'closed-won'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {similarDeal.stage === 'closed-won' ? 'Won' : 'Lost'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{similarDeal.daysToClose} days</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {deal.value > similarDeal.value ? (
                      <span className="text-green-600 font-medium flex items-center">
                        <ArrowUp className="w-3 h-3 mr-1" /> Higher value
                      </span>
                    ) : deal.value < similarDeal.value ? (
                      <span className="text-red-600 font-medium flex items-center">
                        <ArrowDown className="w-3 h-3 mr-1" /> Lower value
                      </span>
                    ) : (
                      <span className="text-gray-600 font-medium">Similar value</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h5 className="text-sm font-medium text-gray-700">Average Days to Close</h5>
            <p className="text-2xl font-bold text-gray-900 mt-2">{avgSimilarDealCloseTime}</p>
            <p className="text-xs text-gray-500 mt-1">
              {dealAgeDays < avgSimilarDealCloseTime 
                ? `${avgSimilarDealCloseTime - dealAgeDays} days below average` 
                : `${dealAgeDays - avgSimilarDealCloseTime} days above average`}
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h5 className="text-sm font-medium text-gray-700">Similar Deals Win Rate</h5>
            <p className="text-2xl font-bold text-gray-900 mt-2">{similarDealsWinRate}%</p>
            <p className="text-xs text-gray-500 mt-1">
              {similarDealsWinRate > 50 
                ? 'Above industry average'
                : 'Below industry average'}
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h5 className="text-sm font-medium text-gray-700">Average Deal Value</h5>
            <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(avgSimilarDealValue)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {deal.value > avgSimilarDealValue
                ? `${Math.round((deal.value / avgSimilarDealValue - 1) * 100)}% higher than average`
                : `${Math.round((avgSimilarDealValue / deal.value - 1) * 100)}% lower than average`}
            </p>
          </div>
        </div>
      </div>
      
      {/* Team & Stakeholder Analysis */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2 text-blue-600" />
          Team & Stakeholder Analysis
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h5 className="text-sm font-medium text-blue-900 mb-3">Key Stakeholders</h5>
            <div className="space-y-3">
              <div className="flex items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 mr-3">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-blue-900">{deal.contact || 'Primary Contact'}</p>
                  <p className="text-xs text-blue-700">Decision Maker</p>
                </div>
                <div className="text-blue-600">
                  <Mail className="w-4 h-4" />
                </div>
              </div>
              
              <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 mr-3">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Technical Lead</p>
                  <p className="text-xs text-gray-600">Influencer</p>
                </div>
                <div className="text-blue-600">
                  <Mail className="w-4 h-4" />
                </div>
              </div>
              
              <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 mr-3">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Financial Approver</p>
                  <p className="text-xs text-gray-600">Approver</p>
                </div>
                <div className="text-blue-600">
                  <Mail className="w-4 h-4" />
                </div>
              </div>
            </div>
            
            <button className="w-full mt-3 px-3 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 transition-colors flex items-center justify-center">
              <Users className="w-4 h-4 mr-2" />
              Map All Stakeholders
            </button>
          </div>
          
          <div>
            <h5 className="text-sm font-medium text-green-900 mb-3">Internal Team</h5>
            <div className="space-y-3">
              <div className="flex items-center p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center text-green-700 mr-3">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-green-900">Account Owner</p>
                  <p className="text-xs text-green-700">You</p>
                </div>
                <div className="text-green-600">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
              
              <div className="flex items-center p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center text-green-700 mr-3">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-green-900">Solutions Architect</p>
                  <p className="text-xs text-green-700">Technical Support</p>
                </div>
                <div className="text-green-600">
                  <Mail className="w-4 h-4" />
                </div>
              </div>
              
              <div className="flex items-center p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <div className="w-10 h-10 bg-yellow-200 rounded-full flex items-center justify-center text-yellow-700 mr-3">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-yellow-900">Legal Counsel</p>
                  <p className="text-xs text-yellow-700">Not Assigned</p>
                </div>
                <button className="text-blue-600 text-xs px-2 py-1 bg-blue-50 rounded">
                  Assign
                </button>
              </div>
            </div>
            
            <button className="w-full mt-3 px-3 py-2 bg-green-100 text-green-700 text-sm font-medium rounded-lg hover:bg-green-200 transition-colors flex items-center justify-center">
              <Users className="w-4 h-4 mr-2" />
              Update Deal Team
            </button>
          </div>
        </div>
      </div>
      
      {/* Risk Assessment */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
          Risk Assessment & Recommendations
        </h4>
        
        <div className="space-y-4">
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <h5 className="text-sm font-medium text-red-800 mb-2 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Risk Factors
            </h5>
            <div className="space-y-2">
              {deal.stage === 'qualification' && (
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-700">Deal is still in early qualification stage, need to identify all requirements</p>
                </div>
              )}
              
              {dealAgeDays > avgSimilarDealCloseTime && (
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-700">Deal age ({dealAgeDays} days) exceeds average time to close ({avgSimilarDealCloseTime} days)</p>
                </div>
              )}
              
              {deal.dueDate && daysRemaining < 14 && (
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-700">Close date approaching with only {daysRemaining} days remaining</p>
                </div>
              )}
              
              {!deal.contact && (
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-700">No primary contact assigned to this deal</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h5 className="text-sm font-medium text-green-800 mb-2 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Recommendations
            </h5>
            <div className="space-y-2">
              {deal.stage === 'qualification' && (
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                  <p className="text-sm text-green-700">Schedule a detailed requirements gathering call with technical stakeholders</p>
                </div>
              )}
              
              {deal.stage === 'proposal' && (
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                  <p className="text-sm text-green-700">Follow up on proposal with a personalized walkthrough call</p>
                </div>
              )}
              
              {deal.stage === 'negotiation' && (
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                  <p className="text-sm text-green-700">Prepare alternative pricing models to address potential objections</p>
                </div>
              )}
              
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                <p className="text-sm text-green-700">Identify and engage all decision makers in the process</p>
              </div>
              
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                <p className="text-sm text-green-700">Document and address client's specific concerns about implementation timeline</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};