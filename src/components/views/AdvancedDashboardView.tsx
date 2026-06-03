import React, { useState, useMemo } from 'react';
import { Deal, Dashboard, DashboardWidget, CustomMetric } from '../types';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Users,
  DollarSign,
  Target,
  Calendar,
  Plus,
  Settings,
  X,
  GripVertical
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface AdvancedDashboardViewProps {
  deals: Record<string, Deal>;
  dashboard: Dashboard;
  customMetrics?: CustomMetric[];
  onWidgetAdd?: (widget: Omit<DashboardWidget, 'id'>) => void;
  onWidgetUpdate?: (widgetId: string, updates: Partial<DashboardWidget>) => void;
  onWidgetDelete?: (widgetId: string) => void;
  onLayoutChange?: (widgets: DashboardWidget[]) => void;
  isEditable?: boolean;
}

export const AdvancedDashboardView: React.FC<AdvancedDashboardViewProps> = ({
  deals,
  dashboard,
  customMetrics = [],
  onWidgetAdd,
  onWidgetUpdate,
  onWidgetDelete,
  onLayoutChange,
  isEditable = false
}) => {
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  // Process dashboard data
  const dashboardData = useMemo(() => {
    const allDeals = Object.values(deals);

    return {
      totalDeals: allDeals.length,
      totalValue: allDeals.reduce((sum, deal) => sum + deal.value, 0),
      avgDealSize: allDeals.length > 0 ? allDeals.reduce((sum, deal) => sum + deal.value, 0) / allDeals.length : 0,
      wonDeals: allDeals.filter(d => d.stage === 'closed-won').length,
      lostDeals: allDeals.filter(d => d.stage === 'closed-lost').length,
      activeDeals: allDeals.filter(d => !['closed-won', 'closed-lost'].includes(d.stage)).length,
      conversionRate: allDeals.length > 0 ? (allDeals.filter(d => d.stage === 'closed-won').length / allDeals.length) * 100 : 0,
      avgProbability: allDeals.length > 0 ? allDeals.reduce((sum, d) => sum + d.probability, 0) / allDeals.length : 0,

      // Stage distribution
      stageData: [
        { name: 'Qualification', value: allDeals.filter(d => d.stage === 'qualification').length, color: '#3b82f6' },
        { name: 'Proposal', value: allDeals.filter(d => d.stage === 'proposal').length, color: '#6366f1' },
        { name: 'Negotiation', value: allDeals.filter(d => d.stage === 'negotiation').length, color: '#f59e0b' },
        { name: 'Won', value: allDeals.filter(d => d.stage === 'closed-won').length, color: '#10b981' },
        { name: 'Lost', value: allDeals.filter(d => d.stage === 'closed-lost').length, color: '#ef4444' }
      ].filter(item => item.value > 0),

      // Monthly trend (last 6 months)
      monthlyTrend: Array.from({ length: 6 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (5 - i));
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
      }),

      // Top deals
      topDeals: allDeals
        .filter(d => !['closed-won', 'closed-lost'].includes(d.stage))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
    };
  }, [deals]);

  // Render widget content based on type
  const renderWidgetContent = (widget: DashboardWidget) => {
    const { config } = widget;

    switch (widget.type) {
      case 'metric':
        const metricKey = config.metricKey;
        const value = dashboardData[metricKey as keyof typeof dashboardData];
        const format = config.format || 'number';

        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {formatValue(value, format)}
            </div>
            <div className="text-sm text-gray-600 text-center">
              {config.label || metricKey}
            </div>
            {config.showChange && config.previousValue && (
              <div className={`text-xs mt-1 ${
                value > config.previousValue ? 'text-green-600' : 'text-red-600'
              }`}>
                {value > config.previousValue ? '+' : ''}
                {((value - config.previousValue) / config.previousValue * 100).toFixed(1)}%
              </div>
            )}
          </div>
        );

      case 'chart':
        const chartType = config.chartType || 'bar';
        const chartData = config.dataKey ? dashboardData[config.dataKey as keyof typeof dashboardData] : [];

        if (chartType === 'bar' && Array.isArray(chartData)) {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="value" fill={config.color || '#3b82f6'} />
              </BarChart>
            </ResponsiveContainer>
          );
        }

        if (chartType === 'pie' && Array.isArray(chartData)) {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#3b82f6'} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </RePieChart>
            </ResponsiveContainer>
          );
        }

        if (chartType === 'line' && Array.isArray(chartData)) {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <RechartsTooltip />
                <Line type="monotone" dataKey="deals" stroke={config.color || '#3b82f6'} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          );
        }

        return <div className="flex items-center justify-center h-full text-gray-500">Chart not configured</div>;

      case 'table':
        const tableData = config.dataKey ? dashboardData[config.dataKey as keyof typeof dashboardData] : [];
        const columns = config.columns || ['name', 'value'];

        if (!Array.isArray(tableData)) {
          return <div className="flex items-center justify-center h-full text-gray-500">No data available</div>;
        }

        return (
          <div className="overflow-auto h-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {columns.map(col => (
                    <th key={col} className="text-left p-2 font-medium text-gray-700">
                      {col.charAt(0).toUpperCase() + col.slice(1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.slice(0, 10).map((row, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    {columns.map(col => (
                      <td key={col} className="p-2">
                        {formatValue(row[col], config.format || 'number')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      default:
        return <div className="flex items-center justify-center h-full text-gray-500">Widget type not supported</div>;
    }
  };

  // Handle drag and drop for layout
  const handleDragStart = (widgetId: string) => {
    setDraggedWidget(widgetId);
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetWidgetId: string) => {
    if (!draggedWidget || draggedWidget === targetWidgetId) return;

    // Implement widget reordering logic here
    // For now, just swap positions
    const draggedWidgetData = dashboard.widgets.find(w => w.id === draggedWidget);
    const targetWidgetData = dashboard.widgets.find(w => w.id === targetWidgetId);

    if (draggedWidgetData && targetWidgetData) {
      onLayoutChange?.([
        ...dashboard.widgets.map(w => {
          if (w.id === draggedWidget) return { ...w, position: targetWidgetData.position };
          if (w.id === targetWidgetId) return { ...w, position: draggedWidgetData.position };
          return w;
        })
      ]);
    }

    setDraggedWidget(null);
  };

  // Get widget icon
  const getWidgetIcon = (type: string) => {
    switch (type) {
      case 'metric': return <Target className="w-5 h-5" />;
      case 'chart': return <BarChart3 className="w-5 h-5" />;
      case 'table': return <Users className="w-5 h-5" />;
      case 'kanban': return <PieChart className="w-5 h-5" />;
      case 'calendar': return <Calendar className="w-5 h-5" />;
      default: return <Settings className="w-5 h-5" />;
    }
  };

  return (
    <div className="h-full p-6 bg-gray-50">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{dashboard.name}</h1>
          {dashboard.description && (
            <p className="text-gray-600 mt-1">{dashboard.description}</p>
          )}
        </div>

        {isEditable && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onWidgetAdd?.({
                type: 'metric',
                title: 'New Metric',
                position: { x: 0, y: 0, width: 4, height: 3 },
                config: {},
                dataSource: { type: 'deals' },
                isVisible: true
              })}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Widget
            </button>
          </div>
        )}
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-12 gap-6 auto-rows-min">
        {dashboard.widgets
          .filter(widget => widget.isVisible)
          .sort((a, b) => (a.position.y * 12 + a.position.x) - (b.position.y * 12 + b.position.x))
          .map((widget) => (
            <div
              key={widget.id}
              className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${
                draggedWidget === widget.id ? 'opacity-50' : ''
              }`}
              style={{
                gridColumn: `span ${widget.position.width}`,
                gridRow: `span ${widget.position.height}`
              }}
              draggable={isEditable}
              onDragStart={() => handleDragStart(widget.id)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, widget.id)}
            >
              {/* Widget Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  {isEditable && <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />}
                  {getWidgetIcon(widget.type)}
                  <h3 className="font-medium text-gray-900">{widget.title}</h3>
                </div>

                {isEditable && (
                  <div className="flex items-center gap-1">
                    <button className="p-1 hover:bg-gray-100 rounded">
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onWidgetDelete?.(widget.id)}
                      className="p-1 hover:bg-gray-100 rounded text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Widget Content */}
              <div className="p-4 h-full">
                {renderWidgetContent(widget)}
              </div>
            </div>
          ))}
      </div>

      {/* Empty state */}
      {dashboard.widgets.filter(w => w.isVisible).length === 0 && (
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No widgets yet</h3>
          <p className="text-gray-600 mb-4">Add widgets to visualize your deal data</p>
          {isEditable && (
            <button
              onClick={() => onWidgetAdd?.({
                type: 'metric',
                title: 'Total Deals',
                position: { x: 0, y: 0, width: 4, height: 3 },
                config: { metricKey: 'totalDeals', format: 'number' },
                dataSource: { type: 'deals' },
                isVisible: true
              })}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add First Widget
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Helper function to format values
function formatValue(value: any, format: string = 'number'): string {
  if (value === null || value === undefined) return '0';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);

    case 'percentage':
      return `${value.toFixed(1)}%`;

    case 'number':
    default:
      if (typeof value === 'number') {
        return new Intl.NumberFormat('en-US').format(value);
      }
      return String(value);
  }
}