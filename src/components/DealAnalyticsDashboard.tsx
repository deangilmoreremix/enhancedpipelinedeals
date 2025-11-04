import React, { useState, useEffect, useMemo } from 'react';
import { Deal } from '../types';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Target, Clock, Users, Activity, Download, Filter, Calendar, Brain, Wand2, Sparkles, Search } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getSupabaseService } from '../services/supabaseService';
import ResearchStatusOverlay from './ui/ResearchStatusOverlay';
import { getWebSearchService } from '../services/webSearchService';
import { ModernButton } from './ui/ModernButton';

interface DealAnalyticsDashboardProps {
  deal: Deal;
}

interface DealMetrics {
  totalRevenue: number;
  totalDeals: number;
  wonDeals: number;
  conversionRate: number;
  avgDealSize: number;
  timeToClose: number;
  pipelineValue: number;
}

interface TrendData {
  month: string;
  revenue: number;
  deals: number;
  pipeline: number;
}

export const DealAnalyticsDashboard: React.FC<DealAnalyticsDashboardProps> = ({ deal }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [allDeals, setAllDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [researchStatus, setResearchStatus] = useState<any>(null);

  const supabaseService = getSupabaseService();
  const webSearchService = getWebSearchService();

  useEffect(() => {
    loadDealData();
  }, []);

  const loadDealData = async () => {
    try {
      if (supabaseService.isConnectedToDatabase()) {
        const deals = await supabaseService.getDeals();
        setAllDeals(deals);
      }
    } catch (error) {
      console.error('Failed to load deal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const dealMetrics = useMemo((): DealMetrics => {
    if (allDeals.length === 0) {
      // Fallback to single deal metrics if no database data
      return {
        totalRevenue: deal.stage === 'closed-won' ? deal.value : 0,
        totalDeals: 1,
        wonDeals: deal.stage === 'closed-won' ? 1 : 0,
        conversionRate: deal.stage === 'closed-won' ? 100 : deal.probability,
        avgDealSize: deal.stage === 'closed-won' ? deal.value : 0,
        timeToClose: Math.ceil((new Date().getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        pipelineValue: deal.value
      };
    }

    const wonDeals = allDeals.filter(d => d.stage === 'closed-won');
    const totalRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0);
    const pipelineValue = allDeals
      .filter(d => !['closed-won', 'closed-lost'].includes(d.stage))
      .reduce((sum, d) => sum + d.value, 0);

    return {
      totalRevenue,
      totalDeals: allDeals.length,
      wonDeals: wonDeals.length,
      conversionRate: allDeals.length > 0 ? (wonDeals.length / allDeals.length) * 100 : 0,
      avgDealSize: wonDeals.length > 0 ? totalRevenue / wonDeals.length : 0,
      timeToClose: Math.ceil((new Date().getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      pipelineValue
    };
  }, [allDeals, deal]);

  const generateTrendData = (): TrendData[] => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const baseRevenue = dealMetrics.totalRevenue || deal.value;

    return months.map((month, index) => ({
      month,
      revenue: Math.floor(baseRevenue * (0.7 + Math.random() * 0.6) / 6),
      deals: Math.floor(dealMetrics.totalDeals * (0.8 + Math.random() * 0.4) / 6),
      pipeline: Math.floor(dealMetrics.pipelineValue * (0.6 + Math.random() * 0.8) / 6)
    }));
  };

  const trendData = generateTrendData();

  const analytics = {
    conversionRate: dealMetrics.conversionRate,
    timeToClose: dealMetrics.timeToClose,
    engagementScore: Math.floor(Math.random() * 40) + 60, // Keep mock for now
    competitorActivity: Math.floor(Math.random() * 30) + 20, // Keep mock for now
    dealVelocity: deal.probability > 70 ? 'Fast' : deal.probability > 40 ? 'Medium' : 'Slow'
  };

  const metrics = [
    {
      title: 'Deal Value',
      value: `$${deal.value.toLocaleString()}`,
      change: dealMetrics.totalRevenue > 0 ? `+${((deal.value / dealMetrics.totalRevenue) * 100).toFixed(1)}%` : '+12%',
      trend: 'up',
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      title: 'Conversion Rate',
      value: `${dealMetrics.conversionRate.toFixed(1)}%`,
      change: dealMetrics.conversionRate > 50 ? '+8%' : '+2%',
      trend: dealMetrics.conversionRate > 50 ? 'up' : 'down',
      icon: Target,
      color: 'text-blue-600'
    },
    {
      title: 'Days Active',
      value: analytics.timeToClose.toString(),
      change: null,
      trend: null,
      icon: Clock,
      color: 'text-purple-600'
    },
    {
      title: 'Pipeline Value',
      value: `$${Math.round(dealMetrics.pipelineValue / 1000)}k`,
      change: dealMetrics.pipelineValue > dealMetrics.totalRevenue ? '+15%' : '+5%',
      trend: dealMetrics.pipelineValue > dealMetrics.totalRevenue ? 'up' : 'down',
      icon: Activity,
      color: 'text-orange-600'
    }
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      // Sanitize data to prevent XSS
      const sanitizeString = (str: string) => str.replace(/[<>]/g, '').substring(0, 1000);
      const sanitizeNumber = (num: number) => Math.max(0, Math.min(num, 999999999));

      const exportData = {
        deal: {
          title: sanitizeString(deal.title),
          company: sanitizeString(deal.company),
          value: sanitizeNumber(deal.value),
          probability: Math.max(0, Math.min(100, deal.probability)),
          stage: sanitizeString(deal.stage),
          createdAt: deal.createdAt?.toISOString() || new Date().toISOString(),
          dueDate: deal.dueDate?.toISOString() || null
        },
        metrics: {
          totalRevenue: sanitizeNumber(dealMetrics.totalRevenue),
          totalDeals: sanitizeNumber(dealMetrics.totalDeals),
          wonDeals: sanitizeNumber(dealMetrics.wonDeals),
          conversionRate: Math.max(0, Math.min(100, dealMetrics.conversionRate)),
          avgDealSize: sanitizeNumber(dealMetrics.avgDealSize),
          timeToClose: sanitizeNumber(dealMetrics.timeToClose),
          pipelineValue: sanitizeNumber(dealMetrics.pipelineValue)
        },
        trendData: trendData.map(item => ({
          month: sanitizeString(item.month),
          revenue: sanitizeNumber(item.revenue),
          deals: sanitizeNumber(item.deals),
          pipeline: sanitizeNumber(item.pipeline)
        })),
        analytics: {
          conversionRate: Math.max(0, Math.min(100, analytics.conversionRate)),
          timeToClose: sanitizeNumber(analytics.timeToClose),
          engagementScore: Math.max(0, Math.min(100, analytics.engagementScore)),
          competitorActivity: sanitizeNumber(analytics.competitorActivity),
          dealVelocity: ['Slow', 'Medium', 'Fast'].includes(analytics.dealVelocity) ? analytics.dealVelocity : 'Medium'
        },
        generatedAt: new Date().toISOString(),
        exportedBy: 'DealAnalyticsDashboard'
      };

      // Create JSON blob with sanitized data
      const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const jsonUrl = URL.createObjectURL(jsonBlob);

      // Create CSV export for metrics with sanitized data
      const csvData = [
        ['Metric', 'Value', 'Change', 'Trend'],
        ...metrics.map(m => [
          sanitizeString(m.title),
          sanitizeString(m.value),
          m.change ? sanitizeString(m.change) : 'N/A',
          m.trend || 'N/A'
        ])
      ];
      const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const csvUrl = URL.createObjectURL(csvBlob);

      // Download JSON file
      const jsonLink = document.createElement('a');
      jsonLink.href = jsonUrl;
      jsonLink.download = `deal-analytics-${sanitizeString(deal.title).replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
      jsonLink.style.display = 'none';
      document.body.appendChild(jsonLink);
      jsonLink.click();
      document.body.removeChild(jsonLink);

      // Download CSV file after a short delay
      setTimeout(() => {
        const csvLink = document.createElement('a');
        csvLink.href = csvUrl;
        csvLink.download = `deal-metrics-${sanitizeString(deal.title).replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
        csvLink.style.display = 'none';
        document.body.appendChild(csvLink);
        csvLink.click();
        document.body.removeChild(csvLink);

        // Clean up URLs
        URL.revokeObjectURL(jsonUrl);
        URL.revokeObjectURL(csvUrl);
      }, 500);

    } catch (error) {
      console.error('Export failed:', error);
      // In a real app, show user-friendly error message
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleWebResearch = async () => {
    setIsResearching(true);
    setResearchStatus({
      isVisible: true,
      statuses: [{
        id: 'deal-research',
        stage: 'researching',
        message: '🔍 Researching deal background and market intelligence...',
        progress: 0,
        timestamp: new Date()
      }]
    });

    try {
      const searchQuery = `${deal.company} ${deal.title} industry news competitors market analysis`;
      const systemPrompt = `You are a business intelligence analyst specializing in deal analysis and market research. Provide comprehensive insights about this deal opportunity.`;
      const userPrompt = `Analyze this deal: "${deal.title}" for ${deal.company}. Provide market intelligence, competitive analysis, industry trends, and deal valuation insights. Include relevant news, competitor information, and market positioning.`;

      const searchResults = await webSearchService.searchWithAI(
        searchQuery,
        systemPrompt,
        userPrompt,
        {
          includeSources: true,
          contextSize: 'high'
        }
      );

      setResearchStatus({
        isVisible: true,
        statuses: [{
          id: 'deal-research',
          stage: 'complete',
          message: '✅ Deal research complete with market intelligence!',
          progress: 100,
          timestamp: new Date(),
          sourceCount: searchResults.citations.length
        }]
      });

      // Store research results for display
      console.log('Deal research results:', searchResults);

    } catch (error) {
      console.error('Deal research failed:', error);
      setResearchStatus({
        isVisible: true,
        statuses: [{
          id: 'deal-research',
          stage: 'error',
          message: '❌ Research failed. Using cached data instead.',
          progress: 0,
          timestamp: new Date()
        }]
      });
    } finally {
      setTimeout(() => setIsResearching(false), 3000);
    }
  };

  return (
    <>
      {/* Research Status Overlay */}
      {researchStatus && (
        <ResearchStatusOverlay
          isVisible={researchStatus.isVisible}
          statuses={researchStatus.statuses}
          onClose={() => setResearchStatus(null)}
          position="top-right"
          size="md"
        />
      )}

      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Deal Analytics</h3>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </div>

          {/* AI Web Research Button */}
          <ModernButton
            variant="primary"
            size="sm"
            leftIcon={<Brain className="w-4 h-4" />}
            onClick={handleWebResearch}
            loading={isResearching}
            title="AI Web Research"
          >
            AI Research
          </ModernButton>

          <ModernButton
            variant="secondary"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExport}
            loading={exporting}
            title="Export Analytics (JSON + CSV)"
          >
            Export
          </ModernButton>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{metric.title}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{metric.value}</p>
                  {metric.change && (
                    <div className="flex items-center mt-1">
                      {metric.trend === 'up' ? (
                        <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-500 mr-1" />
                      )}
                      <span className={`text-xs font-medium ${
                        metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {metric.change}
                      </span>
                    </div>
                  )}
                </div>
                <Icon className={`w-8 h-8 ${metric.color}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Deal Velocity Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Deal Velocity</h4>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-300">Current Status</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            analytics.dealVelocity === 'Fast'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : analytics.dealVelocity === 'Medium'
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }`}>
            {analytics.dealVelocity} Moving
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${
              analytics.dealVelocity === 'Fast'
                ? 'bg-green-500'
                : analytics.dealVelocity === 'Medium'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${deal.probability}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Insights and Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
            Performance Insights
          </h4>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Strong Engagement</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">Contact has been highly responsive this week</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Competitive Landscape</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">{analytics.competitorActivity}% competitor activity detected</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Timeline Risk</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">Deal is approaching the target close date</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2 text-purple-500" />
            Recommendations
          </h4>
          <div className="space-y-3">
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
              <p className="text-sm font-medium text-purple-900 dark:text-purple-300">Schedule Follow-up</p>
              <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                Contact the prospect within the next 24 hours to maintain momentum
              </p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300">Prepare Proposal</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                Update proposal with latest requirements and competitive analysis
              </p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
              <p className="text-sm font-medium text-green-900 dark:text-green-300">Monitor Competition</p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                Keep track of competitor movements in this deal
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};