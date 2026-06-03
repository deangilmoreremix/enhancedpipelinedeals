import React, { useState, useEffect, useMemo } from 'react';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { getDashboardService, Dashboard, Widget, WidgetType } from '../services/dashboardService';
import { getKPIService, KPIDashboard } from '../services/kpiService';
import { getForecastingService } from '../services/forecastingService';
import { getPipelineAnalyticsService } from '../services/pipelineAnalyticsService';
import { getAdvancedAnalyticsService } from '../services/advancedAnalyticsService';

import {
  BarChart3,
  TrendingUp,
  Activity,
  Target,
  Settings,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Refresh,
  Filter,
  Calendar,
  Zap,
  Brain,
  Eye,
  EyeOff
} from 'lucide-react';

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { ModernButton } from './ui/ModernButton';
import { GlassCard } from './ui/GlassCard';
import ResearchStatusOverlay from './ui/ResearchStatusOverlay';

interface AnalyticsDashboardProps {
  isVisible?: boolean;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ isVisible = true }) => {
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [kpiDashboard, setKpiDashboard] = useState<KPIDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResearching, setIsResearching] = useState(false);
  const [researchStatus, setResearchStatus] = useState<any>(null);
  const [showKPIs, setShowKPIs] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const dashboardService = getDashboardService();
  const kpiService = getKPIService();
  const forecastingService = getForecastingService();
  const analyticsService = getPipelineAnalyticsService();
  const advancedAnalytics = getAdvancedAnalyticsService();

  // Feature flags
  const phase4Enabled = useFeatureFlag('twenty_phase4_analytics');
  const kpiEnabled = useFeatureFlag('twenty_kpi_monitoring');
  const forecastingEnabled = useFeatureFlag('twenty_pipeline_analytics');
  const predictiveEnabled = useFeatureFlag('twenty_predictive_analytics');

  useEffect(() => {
    if (phase4Enabled && isVisible) {
      loadDashboardData();
    }
  }, [phase4Enabled, isVisible]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Load dashboards
      const userDashboards = await dashboardService.getDashboards();
      setDashboards(userDashboards);

      // Get default dashboard
      const defaultDashboard = await dashboardService.getDefaultDashboard();
      setActiveDashboard(defaultDashboard);

      if (defaultDashboard) {
        // Load widgets for the default dashboard
        const dashboardWidgets = await dashboardService.getDashboardWidgets(defaultDashboard.id);
        setWidgets(dashboardWidgets);
      }

      // Load KPI data if enabled
      if (kpiEnabled) {
        const kpis = await kpiService.getKPIDashboard();
        setKpiDashboard(kpis);
      }

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runAnalyticsResearch = async () => {
    setIsResearching(true);
    setResearchStatus({
      isVisible: true,
      statuses: [{
        id: 'analytics-research',
        stage: 'researching',
        message: '🔍 Running comprehensive analytics analysis...',
        progress: 0,
        timestamp: new Date()
      }]
    });

    try {
      // Run predictive analytics
      if (predictiveEnabled) {
        const predictions = await advancedAnalytics.runPredictiveAnalytics('current_workspace');
        console.log('Predictive analytics results:', predictions);
      }

      // Generate forecasts
      if (forecastingEnabled) {
        const forecast = await forecastingService.generateRevenueForecast('6months');
        console.log('Revenue forecast:', forecast);
      }

      // Calculate KPIs
      if (kpiEnabled) {
        const kpiValues = await kpiService.calculateAllKPIs();
        console.log('KPI calculations:', kpiValues);
      }

      setResearchStatus({
        isVisible: true,
        statuses: [{
          id: 'analytics-research',
          stage: 'complete',
          message: '✅ Analytics research complete with AI-powered insights!',
          progress: 100,
          timestamp: new Date()
        }]
      });

    } catch (error) {
      console.error('Analytics research failed:', error);
      setResearchStatus({
        isVisible: true,
        statuses: [{
          id: 'analytics-research',
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

  const exportDashboard = async () => {
    if (!activeDashboard) return;

    try {
      const exportData = await dashboardService.exportDashboard(activeDashboard.id);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeDashboard.name.replace(/\s+/g, '_')}_dashboard.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export dashboard:', error);
    }
  };

  if (!phase4Enabled) {
    return (
      <GlassCard className="p-6">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Advanced Analytics Coming Soon
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Phase 4 Analytics & Forecasting features are currently in development.
          </p>
        </div>
      </GlassCard>
    );
  }

  if (isLoading) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </GlassCard>
    );
  }

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Analytics & Forecasting
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Advanced pipeline analytics, predictive forecasting, and KPI monitoring
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Period Selector */}
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as any)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
            </div>

            {/* Controls */}
            <ModernButton
              variant="secondary"
              size="sm"
              leftIcon={<Refresh className="w-4 h-4" />}
              onClick={runAnalyticsResearch}
              loading={isResearching}
            >
              AI Analysis
            </ModernButton>

            <ModernButton
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={exportDashboard}
            >
              Export
            </ModernButton>

            <ModernButton
              variant="secondary"
              size="sm"
              leftIcon={<Settings className="w-4 h-4" />}
            >
              Configure
            </ModernButton>
          </div>
        </div>

        {/* KPI Dashboard */}
        {kpiEnabled && kpiDashboard && showKPIs && (
          <KPIDashboardView
            kpiDashboard={kpiDashboard}
            onToggle={() => setShowKPIs(false)}
          />
        )}

        {/* Widgets Grid */}
        {activeDashboard && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {widgets.map((widget) => (
              <WidgetRenderer
                key={widget.id}
                widget={widget}
                selectedPeriod={selectedPeriod}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {(!activeDashboard || widgets.length === 0) && (
          <GlassCard className="p-8">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Dashboard Configured
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Create your first analytics dashboard to get started with advanced insights.
              </p>
              <ModernButton
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create Dashboard
              </ModernButton>
            </div>
          </GlassCard>
        )}
      </div>
    </>
  );
};

// KPI Dashboard Component
interface KPIDashboardViewProps {
  kpiDashboard: KPIDashboard;
  onToggle: () => void;
}

const KPIDashboardView: React.FC<KPIDashboardViewProps> = ({ kpiDashboard, onToggle }) => {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Target className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Key Performance Indicators
          </h3>
        </div>
        <ModernButton
          variant="ghost"
          size="sm"
          leftIcon={<EyeOff className="w-4 h-4" />}
          onClick={onToggle}
        >
          Hide
        </ModernButton>
      </div>

      {/* KPI Health Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{kpiDashboard.totalKPIs}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">Total KPIs</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{kpiDashboard.onTrack}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">On Track</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{kpiDashboard.atRisk}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">At Risk</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{kpiDashboard.offTrack}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">Off Track</div>
        </div>
      </div>

      {/* Overall Health Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Overall KPI Health
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {kpiDashboard.overallHealth.toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${kpiDashboard.overallHealth}%` }}
          />
        </div>
      </div>

      {/* Individual KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {kpiDashboard.summaries.map((summary) => (
          <div key={summary.kpi.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 dark:text-white">{summary.kpi.name}</h4>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                summary.status === 'on_track'
                  ? 'bg-green-100 text-green-800'
                  : summary.status === 'at_risk'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {summary.status.replace('_', ' ').toUpperCase()}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {typeof summary.currentValue === 'number' ? summary.currentValue.toLocaleString() : summary.currentValue}
                </div>
                {summary.targetValue && (
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Target: {summary.targetValue.toLocaleString()}
                  </div>
                )}
              </div>

              {summary.previousValue && (
                <div className="text-right">
                  <div className={`text-sm font-medium ${
                    summary.trend === 'up' ? 'text-green-600' :
                    summary.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {summary.changePercent > 0 ? '+' : ''}{summary.changePercent.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">vs last period</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

// Widget Renderer Component
interface WidgetRendererProps {
  widget: Widget;
  selectedPeriod: string;
}

const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widget, selectedPeriod }) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const dashboardService = getDashboardService();

  useEffect(() => {
    loadWidgetData();
  }, [widget.id, selectedPeriod]);

  const loadWidgetData = async () => {
    try {
      setIsLoading(true);
      const widgetData = await dashboardService.getWidgetData(widget.id);
      setData(widgetData.data);
    } catch (error) {
      console.error('Failed to load widget data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900 dark:text-white">{widget.title}</h4>
        <div className="flex items-center space-x-2">
          <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <Refresh className="w-4 h-4" />
          </button>
          <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <Edit className="w-4 h-4" />
          </button>
        </div>
      </div>

      <WidgetContent widget={widget} data={data} />
    </GlassCard>
  );
};

// Widget Content Renderer
interface WidgetContentProps {
  widget: Widget;
  data: any;
}

const WidgetContent: React.FC<WidgetContentProps> = ({ widget, data }) => {
  switch (widget.type) {
    case 'kpi_card':
      return <KPICardWidget data={data} config={widget.config} />;

    case 'line_chart':
      return <LineChartWidget data={data} config={widget.config} />;

    case 'bar_chart':
      return <BarChartWidget data={data} config={widget.config} />;

    case 'pie_chart':
      return <PieChartWidget data={data} config={widget.config} />;

    case 'forecast_chart':
      return <ForecastChartWidget data={data} config={widget.config} />;

    case 'gauge':
      return <GaugeWidget data={data} config={widget.config} />;

    default:
      return (
        <div className="flex items-center justify-center h-32 text-gray-500">
          Widget type not supported
        </div>
      );
  }
};

// Individual Widget Components
const KPICardWidget: React.FC<{ data: any; config: any }> = ({ data, config }) => (
  <div className="text-center">
    <div className="text-3xl font-bold text-blue-600 mb-2">{data?.value || 0}</div>
    {config.target && (
      <div className="text-sm text-gray-600 dark:text-gray-300">
        Target: {config.target}
      </div>
    )}
  </div>
);

const LineChartWidget: React.FC<{ data: any; config: any }> = ({ data, config }) => (
  <ResponsiveContainer width="100%" height={200}>
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="period" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} />
    </LineChart>
  </ResponsiveContainer>
);

const BarChartWidget: React.FC<{ data: any; config: any }> = ({ data, config }) => (
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="period" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="value" fill="#3B82F6" />
    </BarChart>
  </ResponsiveContainer>
);

const PieChartWidget: React.FC<{ data: any; config: any }> = ({ data, config }) => (
  <ResponsiveContainer width="100%" height={200}>
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        outerRadius={80}
        dataKey="value"
        label
      >
        {data?.map((entry: any, index: number) => (
          <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
        ))}
      </Pie>
      <Tooltip />
    </PieChart>
  </ResponsiveContainer>
);

const ForecastChartWidget: React.FC<{ data: any; config: any }> = ({ data, config }) => (
  <ResponsiveContainer width="100%" height={200}>
    <AreaChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="period" />
      <YAxis />
      <Tooltip />
      <Area type="monotone" dataKey="predicted" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
      <Area type="monotone" dataKey="upperBound" stackId="2" stroke="#6B7280" fill="transparent" strokeDasharray="5 5" />
      <Area type="monotone" dataKey="lowerBound" stackId="2" stroke="#6B7280" fill="transparent" strokeDasharray="5 5" />
    </AreaChart>
  </ResponsiveContainer>
);

const GaugeWidget: React.FC<{ data: any; config: any }> = ({ data, config }) => {
  const value = data?.value || 0;
  const max = config.max || 100;
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="text-center">
      <div className="relative w-24 h-24 mx-auto mb-4">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="2"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2"
            strokeDasharray={`${percentage}, 100`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-300">{value}/{max}</div>
    </div>
  );
};

export default AnalyticsDashboard;