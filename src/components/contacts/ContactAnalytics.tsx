import React from 'react';
import { Contact } from '../../types/contact';
import { 
  BarChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie 
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
  Eye,
  Star,
  DollarSign,
  Clock as ClockIcon,
  BarChart as BarChartIcon
} from 'lucide-react';

interface ContactAnalyticsProps {
  contact: Contact;
}

export const ContactAnalytics: React.FC<ContactAnalyticsProps> = ({ contact }) => {
  // Sample data for charts and analytics - in a real app, this would come from API calls
  
  // Engagement trend data
  const engagementData = [
    { month: 'Jan', emails: 4, calls: 1, meetings: 1, score: 40 },
    { month: 'Feb', emails: 3, calls: 2, meetings: 0, score: 35 },
    { month: 'Mar', emails: 7, calls: 2, meetings: 1, score: 65 },
    { month: 'Apr', emails: 5, calls: 3, meetings: 2, score: 75 },
    { month: 'May', emails: 10, calls: 1, meetings: 1, score: 80 },
    { month: 'Jun', emails: 8, calls: 2, meetings: 2, score: 85 }
  ];
  
  // Communication breakdown
  const communicationData = [
    { name: 'Emails', value: 37, color: '#3b82f6' },
    { name: 'Calls', value: 11, color: '#10b981' },
    { name: 'Meetings', value: 7, color: '#8b5cf6' },
    { name: 'SMS', value: 5, color: '#f59e0b' }
  ];
  
  // Email engagement
  const emailEngagementData = [
    { name: 'Open Rate', value: 76, color: '#3b82f6' },
    { name: 'Click Rate', value: 42, color: '#10b981' },
    { name: 'Response Rate', value: 31, color: '#8b5cf6' }
  ];
  
  // Page visits data
  const pageVisitsData = [
    { page: 'Homepage', visits: 12 },
    { page: 'Pricing', visits: 8 },
    { page: 'Features', visits: 6 },
    { page: 'Blog', visits: 4 },
    { page: 'Contact Us', visits: 2 }
  ];
  
  // Time to response data
  const timeToResponseData = [
    { day: 'Mon', hours: 2.5 },
    { day: 'Tue', hours: 3.1 },
    { day: 'Wed', hours: 1.2 },
    { day: 'Thu', hours: 0.8 },
    { day: 'Fri', hours: 1.5 },
    { day: 'Sat', hours: 4.2 },
    { day: 'Sun', hours: 5.0 }
  ];
  
  // Deal metrics
  const dealMetrics = {
    total: 3,
    won: 1,
    active: 2,
    lost: 0,
    totalValue: 85000,
    avgDealSize: 28333,
    winRate: 100,
    conversionTime: 32 // days
  };
  
  // Calculate engagement metrics
  const engagementMetrics = {
    totalInteractions: 60,
    lastQuarterGrowth: 25, // percentage
    avgResponseTime: 2.4, // hours
    engagementScore: contact.aiScore || 70
  };
  
  // Calculate key performance indicators
  const kpis = [
    {
      name: 'Total Interactions',
      value: engagementMetrics.totalInteractions,
      change: '+15%',
      trend: 'up',
      icon: Activity
    },
    {
      name: 'Response Time',
      value: `${engagementMetrics.avgResponseTime}h`,
      change: '-18%',
      trend: 'down',
      icon: Clock
    },
    {
      name: 'Deal Value',
      value: `$${dealMetrics.totalValue.toLocaleString()}`,
      change: '+30%',
      trend: 'up',
      icon: DollarSign
    },
    {
      name: 'Engagement',
      value: `${engagementMetrics.engagementScore}%`,
      change: '+12%',
      trend: 'up',
      icon: Target
    }
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
        <BarChart2 className="w-5 h-5 mr-2 text-blue-600" />
        Contact Analytics Dashboard
      </h3>
      
      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <kpi.icon className="h-5 w-5 text-blue-600" />
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                kpi.trend === 'up' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {kpi.trend === 'up' ? <ArrowUp className="inline h-3 w-3 mr-1" /> : <ArrowDown className="inline h-3 w-3 mr-1" />}
                {kpi.change}
              </span>
            </div>
            <h4 className="text-sm font-medium text-gray-500">{kpi.name}</h4>
            <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>
      
      {/* Engagement Trend Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-semibold text-gray-900 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
            Engagement Trend
          </h4>
          <select className="text-sm border border-gray-300 rounded-md px-2 py-1">
            <option>Last 6 Months</option>
            <option>Last 12 Months</option>
            <option>YTD</option>
            <option>All Time</option>
          </select>
        </div>
        
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#8b5cf6' }}
                activeDot={{ r: 6, fill: '#8b5cf6', stroke: 'white', strokeWidth: 2 }}
              />
              <Line 
                type="monotone" 
                dataKey="emails" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ r: 3, fill: '#3b82f6' }}
              />
              <Line 
                type="monotone" 
                dataKey="calls" 
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: '#10b981' }}
              />
              <Line 
                type="monotone" 
                dataKey="meetings" 
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f59e0b' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Multi-Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Communication Mix */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
            <MessageSquare className="w-4 h-4 mr-2 text-blue-600" />
            Communication Mix
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={communicationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {communicationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {communicationData.reduce((sum, item) => sum + item.value, 0)}
              </p>
              <p className="text-sm text-gray-500">Total Interactions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(communicationData.reduce((sum, item) => sum + item.value, 0) / 6)} <span className="text-sm text-gray-500">/ mo</span>
              </p>
              <p className="text-sm text-gray-500">Average Monthly</p>
            </div>
          </div>
        </div>
        
        {/* Email Engagement */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
            <Mail className="w-4 h-4 mr-2 text-blue-600" />
            Email Engagement
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={emailEngagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" />
                <YAxis unit="%" />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {emailEngagementData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Second Multi-Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Website Activity */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
            <Eye className="w-4 h-4 mr-2 text-blue-600" />
            Website Page Visits
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pageVisitsData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="page" />
                <Tooltip />
                <Bar dataKey="visits" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {pageVisitsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(${220 + index * 10}, 90%, 60%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Response Time */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
            <ClockIcon className="w-4 h-4 mr-2 text-blue-600" />
            Response Time
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeToResponseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="day" />
                <YAxis unit="h" />
                <Tooltip 
                  formatter={(value: number) => [`${value} hours`, 'Response Time']}
                  labelStyle={{ color: '#6b7280' }}
                  contentStyle={{ 
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                  }}
                />
                <Bar 
                  dataKey="hours" 
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                  barSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Deal Metrics */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h4 className="text-base font-semibold text-gray-900 mb-6 flex items-center">
          <BarChartIcon className="w-4 h-4 mr-2 text-blue-600" />
          Deal Metrics
        </h4>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center p-4 bg-blue-100 rounded-full mb-3">
              <Star className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{dealMetrics.total}</p>
            <p className="text-sm text-gray-600">Total Deals</p>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center p-4 bg-green-100 rounded-full mb-3">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">${dealMetrics.totalValue.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Total Value</p>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center p-4 bg-purple-100 rounded-full mb-3">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{dealMetrics.winRate}%</p>
            <p className="text-sm text-gray-600">Win Rate</p>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center p-4 bg-yellow-100 rounded-full mb-3">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{dealMetrics.conversionTime}d</p>
            <p className="text-sm text-gray-600">Avg. Conversion</p>
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h5 className="text-sm font-medium text-gray-700">Active Deals</h5>
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
              {dealMetrics.active} Active
            </span>
          </div>
          
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex justify-between mb-2">
                <h6 className="text-sm font-medium text-gray-900">Enterprise Software License</h6>
                <span className="text-sm font-semibold text-gray-900">$75,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Qualification Stage</span>
                <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full">
                  30% Probability
                </span>
              </div>
            </div>
            
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex justify-between mb-2">
                <h6 className="text-sm font-medium text-gray-900">Cloud Infrastructure Setup</h6>
                <span className="text-sm font-semibold text-gray-900">$10,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Proposal Stage</span>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                  65% Probability
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};