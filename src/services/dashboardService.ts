/**
 * Dashboard Service
 * Custom dashboard management with real-time widgets
 */

import { getSupabaseService } from './supabaseService';
import { getPipelineAnalyticsService } from './pipelineAnalyticsService';
import { getForecastingService } from './forecastingService';

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  config: DashboardConfig;
  isPublic: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardConfig {
  theme: 'default' | 'dark' | 'light';
  autoRefresh: boolean;
  refreshInterval: number; // seconds
  layout: 'grid' | 'masonry';
  columns: number;
}

export interface Widget {
  id: string;
  dashboardId: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  position: WidgetPosition;
  dataSource?: string;
  refreshInterval: number;
  createdAt: string;
  updatedAt: string;
}

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type WidgetType =
  | 'kpi_card'
  | 'line_chart'
  | 'bar_chart'
  | 'pie_chart'
  | 'area_chart'
  | 'scatter_plot'
  | 'gauge'
  | 'table'
  | 'forecast_chart'
  | 'velocity_gauge'
  | 'conversion_funnel'
  | 'heatmap';

export interface WidgetConfig {
  // Common config
  showTitle?: boolean;
  showLegend?: boolean;
  colors?: string[];
  dateRange?: {
    start?: string;
    end?: string;
    preset?: '7d' | '30d' | '90d' | '1y' | 'custom';
  };
  filters?: Record<string, any>;

  // Chart-specific config
  chartType?: 'line' | 'bar' | 'area' | 'pie';
  xAxis?: string;
  yAxis?: string[];
  groupBy?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';

  // KPI-specific config
  kpiType?: string;
  target?: number;
  showTarget?: boolean;
  showTrend?: boolean;

  // Table-specific config
  columns?: string[];
  sortable?: boolean;
  pagination?: boolean;
  pageSize?: number;
}

export interface WidgetData {
  data: any[];
  metadata: {
    lastUpdated: string;
    dataPoints: number;
    cacheHit: boolean;
    executionTime: number;
  };
}

class DashboardService {
  private supabaseService = getSupabaseService();
  private analyticsService = getPipelineAnalyticsService();
  private forecastingService = getForecastingService();
  private dataCache = new Map<string, { data: any; expiresAt: number }>();

  /**
   * Get all dashboards for current user
   */
  async getDashboards(): Promise<Dashboard[]> {
    try {
      const supabase = (this.supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('analytics_dashboards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(d => this.transformDashboard(d));
    } catch (error) {
      console.error('Failed to get dashboards:', error);
      return [];
    }
  }

  /**
   * Get default dashboard
   */
  async getDefaultDashboard(): Promise<Dashboard | null> {
    try {
      const dashboards = await this.getDashboards();
      return dashboards.find(d => d.isDefault) || dashboards[0] || null;
    } catch (error) {
      console.error('Failed to get default dashboard:', error);
      return null;
    }
  }

  /**
   * Create new dashboard
   */
  async createDashboard(
    name: string,
    description?: string,
    config?: Partial<DashboardConfig>
  ): Promise<Dashboard> {
    try {
      const supabase = (this.supabaseService as any).supabase;

      const dashboardConfig: DashboardConfig = {
        theme: 'default',
        autoRefresh: true,
        refreshInterval: 300,
        layout: 'grid',
        columns: 12,
        ...config
      };

      const { data, error } = await supabase
        .from('analytics_dashboards')
        .insert({
          name,
          description,
          config: dashboardConfig,
          is_public: false,
          is_default: false
        })
        .select()
        .single();

      if (error) throw error;

      return this.transformDashboard(data);
    } catch (error) {
      console.error('Failed to create dashboard:', error);
      throw error;
    }
  }

  /**
   * Update dashboard
   */
  async updateDashboard(
    id: string,
    updates: Partial<Pick<Dashboard, 'name' | 'description' | 'config' | 'isPublic' | 'isDefault'>>
  ): Promise<Dashboard> {
    try {
      const supabase = (this.supabaseService as any).supabase;

      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.config) updateData.config = updates.config;
      if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
      if (updates.isDefault !== undefined) updateData.is_default = updates.isDefault;

      const { data, error } = await supabase
        .from('analytics_dashboards')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return this.transformDashboard(data);
    } catch (error) {
      console.error('Failed to update dashboard:', error);
      throw error;
    }
  }

  /**
   * Delete dashboard
   */
  async deleteDashboard(id: string): Promise<boolean> {
    try {
      const supabase = (this.supabaseService as any).supabase;

      const { error } = await supabase
        .from('analytics_dashboards')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Clear cache for this dashboard
      this.clearDashboardCache(id);

      return true;
    } catch (error) {
      console.error('Failed to delete dashboard:', error);
      return false;
    }
  }

  /**
   * Get widgets for a dashboard
   */
  async getDashboardWidgets(dashboardId: string): Promise<Widget[]> {
    try {
      const supabase = (this.supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('dashboard_id', dashboardId)
        .order('position->y', { ascending: true })
        .order('position->x', { ascending: true });

      if (error) throw error;

      return (data || []).map(w => this.transformWidget(w));
    } catch (error) {
      console.error('Failed to get dashboard widgets:', error);
      return [];
    }
  }

  /**
   * Add widget to dashboard
   */
  async addWidget(
    dashboardId: string,
    widget: Omit<Widget, 'id' | 'dashboardId' | 'createdAt' | 'updatedAt'>
  ): Promise<Widget> {
    try {
      const supabase = (this.supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('dashboard_widgets')
        .insert({
          dashboard_id: dashboardId,
          widget_type: widget.type,
          title: widget.title,
          config: widget.config,
          position: widget.position,
          data_source: widget.dataSource,
          refresh_interval: widget.refreshInterval
        })
        .select()
        .single();

      if (error) throw error;

      return this.transformWidget(data);
    } catch (error) {
      console.error('Failed to add widget:', error);
      throw error;
    }
  }

  /**
   * Update widget
   */
  async updateWidget(
    id: string,
    updates: Partial<Pick<Widget, 'title' | 'config' | 'position' | 'dataSource' | 'refreshInterval'>>
  ): Promise<Widget> {
    try {
      const supabase = (this.supabaseService as any).supabase;

      const updateData: any = {};
      if (updates.title) updateData.title = updates.title;
      if (updates.config) updateData.config = updates.config;
      if (updates.position) updateData.position = updates.position;
      if (updates.dataSource) updateData.data_source = updates.dataSource;
      if (updates.refreshInterval !== undefined) updateData.refresh_interval = updates.refreshInterval;

      const { data, error } = await supabase
        .from('dashboard_widgets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return this.transformWidget(data);
    } catch (error) {
      console.error('Failed to update widget:', error);
      throw error;
    }
  }

  /**
   * Delete widget
   */
  async deleteWidget(id: string): Promise<boolean> {
    try {
      const supabase = (this.supabaseService as any).supabase;

      const { error } = await supabase
        .from('dashboard_widgets')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Failed to delete widget:', error);
      return false;
    }
  }

  /**
   * Get widget data
   */
  async getWidgetData(widgetId: string, forceRefresh: boolean = false): Promise<WidgetData> {
    const cacheKey = `widget_${widgetId}`;

    // Check cache first
    if (!forceRefresh) {
      const cached = this.dataCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return {
          data: cached.data,
          metadata: {
            lastUpdated: new Date(cached.expiresAt - 300000).toISOString(), // 5 minutes ago
            dataPoints: cached.data.length || 0,
            cacheHit: true,
            executionTime: 0
          }
        };
      }
    }

    try {
      const startTime = Date.now();

      // Get widget configuration
      const supabase = (this.supabaseService as any).supabase;
      const { data: widget, error } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('id', widgetId)
        .single();

      if (error || !widget) {
        throw new Error('Widget not found');
      }

      // Generate data based on widget type
      const data = await this.generateWidgetData(widget);

      const executionTime = Date.now() - startTime;

      // Cache the result
      this.dataCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + (widget.refresh_interval * 1000)
      });

      return {
        data,
        metadata: {
          lastUpdated: new Date().toISOString(),
          dataPoints: data.length || 1,
          cacheHit: false,
          executionTime
        }
      };
    } catch (error) {
      console.error('Failed to get widget data:', error);
      throw error;
    }
  }

  /**
   * Export dashboard as JSON
   */
  async exportDashboard(dashboardId: string): Promise<string> {
    try {
      const dashboard = await this.getDashboardById(dashboardId);
      const widgets = await this.getDashboardWidgets(dashboardId);

      const exportData = {
        dashboard,
        widgets,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export dashboard:', error);
      throw error;
    }
  }

  /**
   * Import dashboard from JSON
   */
  async importDashboard(jsonData: string): Promise<Dashboard> {
    try {
      const importData = JSON.parse(jsonData);

      // Create new dashboard
      const dashboard = await this.createDashboard(
        `${importData.dashboard.name} (Imported)`,
        importData.dashboard.description,
        importData.dashboard.config
      );

      // Add widgets
      for (const widget of importData.widgets) {
        await this.addWidget(dashboard.id, {
          type: widget.type,
          title: widget.title,
          config: widget.config,
          position: widget.position,
          dataSource: widget.dataSource,
          refreshInterval: widget.refreshInterval
        });
      }

      return dashboard;
    } catch (error) {
      console.error('Failed to import dashboard:', error);
      throw error;
    }
  }

  // Private helper methods

  private transformDashboard(data: any): Dashboard {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      config: data.config,
      isPublic: data.is_public,
      isDefault: data.is_default,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  private transformWidget(data: any): Widget {
    return {
      id: data.id,
      dashboardId: data.dashboard_id,
      type: data.widget_type,
      title: data.title,
      config: data.config,
      position: data.position,
      dataSource: data.data_source,
      refreshInterval: data.refresh_interval,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  private async getDashboardById(id: string): Promise<Dashboard> {
    const supabase = (this.supabaseService as any).supabase;

    const { data, error } = await supabase
      .from('analytics_dashboards')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return this.transformDashboard(data);
  }

  private async generateWidgetData(widget: any): Promise<any> {
    const { widget_type, config } = widget;

    switch (widget_type) {
      case 'kpi_card':
        return await this.generateKPIData(config);

      case 'line_chart':
      case 'bar_chart':
      case 'area_chart':
        return await this.generateChartData(config);

      case 'pie_chart':
        return await this.generatePieChartData(config);

      case 'forecast_chart':
        return await this.generateForecastData(config);

      case 'velocity_gauge':
        return await this.generateVelocityData(config);

      case 'table':
        return await this.generateTableData(config);

      default:
        return [];
    }
  }

  private async generateKPIData(config: WidgetConfig): Promise<any> {
    const metrics = await this.analyticsService.getPipelineMetrics();
    const kpiType = config.kpiType || 'totalRevenue';

    switch (kpiType) {
      case 'totalRevenue':
        return { value: metrics.totalValue, target: config.target };
      case 'conversionRate':
        return { value: metrics.conversionRate, target: config.target };
      case 'avgDealSize':
        return { value: metrics.averageDealSize, target: config.target };
      case 'pipelineValue':
        return { value: metrics.totalValue, target: config.target };
      default:
        return { value: 0, target: config.target };
    }
  }

  private async generateChartData(config: WidgetConfig): Promise<any[]> {
    const trends = await this.analyticsService.getTrendAnalysis('monthly', 12);

    return trends.map(trend => ({
      period: new Date(trend.period).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      revenue: trend.revenue,
      deals: trend.dealsCreated,
      pipeline: trend.forecast || 0
    }));
  }

  private async generatePieChartData(config: WidgetConfig): Promise<any[]> {
    const stageAnalytics = await this.analyticsService.getStageAnalytics();

    return stageAnalytics.map(stage => ({
      name: stage.stage,
      value: stage.totalValue,
      deals: stage.dealCount
    }));
  }

  private async generateForecastData(config: WidgetConfig): Promise<any[]> {
    try {
      const forecast = await this.forecastingService.generateRevenueForecast('6months');
      return forecast.forecast.map(f => ({
        period: f.period,
        predicted: f.predictedValue,
        upperBound: f.upperBound,
        lowerBound: f.lowerBound,
        confidence: f.confidence
      }));
    } catch (error) {
      console.error('Failed to generate forecast data:', error);
      return [];
    }
  }

  private async generateVelocityData(config: WidgetConfig): Promise<any> {
    const metrics = await this.analyticsService.getPipelineMetrics();
    return {
      velocity: metrics.velocity,
      target: 45, // days
      status: metrics.velocity <= 45 ? 'good' : metrics.velocity <= 60 ? 'warning' : 'poor'
    };
  }

  private async generateTableData(config: WidgetConfig): Promise<any[]> {
    const deals = await this.getDealsData(config.filters);
    return deals.slice(0, config.pageSize || 50);
  }

  private async getDealsData(filters?: Record<string, any>): Promise<any[]> {
    const supabase = (this.supabaseService as any).supabase;

    let query = supabase
      .from('deals')
      .select('id, stage, value, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (filters) {
      if (filters.stage) query = query.eq('stage', filters.stage);
      if (filters.minValue) query = query.gte('value', filters.minValue);
      if (filters.maxValue) query = query.lte('value', filters.maxValue);
    }

    const { data } = await query.limit(100);
    return data || [];
  }

  private clearDashboardCache(dashboardId: string): void {
    // Clear all widget caches for this dashboard
    for (const [key, value] of this.dataCache.entries()) {
      if (key.startsWith(`widget_`) && value) {
        this.dataCache.delete(key);
      }
    }
  }
}

// Singleton instance
let dashboardService: DashboardService | null = null;

export const getDashboardService = (): DashboardService => {
  if (!dashboardService) {
    dashboardService = new DashboardService();
  }
  return dashboardService;
};

export { DashboardService };
export type { Dashboard, DashboardConfig, Widget, WidgetConfig, WidgetData, WidgetPosition, WidgetType };