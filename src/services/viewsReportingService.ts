import { supabase } from './supabaseService';
import {
  SavedView,
  ViewFilter,
  ViewSort,
  ViewColumn,
  CustomMetric,
  MetricValue,
  Dashboard,
  DashboardWidget,
  ExportTemplate,
  ReportConfig
} from '../types';

/**
 * Views and Reporting Service
 * Handles saved views, custom metrics, dashboards, and reporting functionality
 */
export class ViewsReportingService {
  // Saved Views Management
  static async getSavedViews(userId?: string): Promise<SavedView[]> {
    try {
      let query = supabase
        .from('saved_views')
        .select('*')
        .order('updated_at', { ascending: false });

      if (userId) {
        query = query.or(`created_by.eq.${userId},is_public.eq.true`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching saved views:', error);
      return [];
    }
  }

  static async createSavedView(view: Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedView | null> {
    try {
      const { data, error } = await supabase
        .from('saved_views')
        .insert({
          ...view,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating saved view:', error);
      return null;
    }
  }

  static async updateSavedView(id: string, updates: Partial<SavedView>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('saved_views')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating saved view:', error);
      return false;
    }
  }

  static async deleteSavedView(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('saved_views')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting saved view:', error);
      return false;
    }
  }

  static async setDefaultView(id: string, userId: string): Promise<boolean> {
    try {
      // Unset existing default for user
      await supabase
        .from('saved_views')
        .update({ is_default: false })
        .eq('created_by', userId)
        .eq('is_default', true);

      // Set new default
      const { error } = await supabase
        .from('saved_views')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error setting default view:', error);
      return false;
    }
  }

  static async incrementViewUsage(id: string): Promise<void> {
    try {
      await supabase.rpc('increment_view_usage', { view_id: id });
    } catch (error) {
      console.error('Error incrementing view usage:', error);
    }
  }

  // Custom Metrics Management
  static async getCustomMetrics(userId?: string): Promise<CustomMetric[]> {
    try {
      let query = supabase
        .from('custom_metrics')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('created_by', userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching custom metrics:', error);
      return [];
    }
  }

  static async createCustomMetric(metric: Omit<CustomMetric, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomMetric | null> {
    try {
      const { data, error } = await supabase
        .from('custom_metrics')
        .insert({
          ...metric,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating custom metric:', error);
      return null;
    }
  }

  static async calculateMetricValue(metricId: string, filters?: ViewFilter[]): Promise<number | null> {
    try {
      const { data, error } = await supabase.rpc('calculate_custom_metric', {
        metric_id: metricId,
        filters: filters || []
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error calculating metric value:', error);
      return null;
    }
  }

  static async getMetricHistory(metricId: string, period: string, limit = 30): Promise<MetricValue[]> {
    try {
      const { data, error } = await supabase
        .from('metric_values')
        .select('*')
        .eq('metric_id', metricId)
        .eq('period', period)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching metric history:', error);
      return [];
    }
  }

  // Dashboard Management
  static async getDashboards(userId?: string): Promise<Dashboard[]> {
    try {
      let query = supabase
        .from('dashboards')
        .select('*')
        .order('updated_at', { ascending: false });

      if (userId) {
        query = query.or(`created_by.eq.${userId},is_public.eq.true`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching dashboards:', error);
      return [];
    }
  }

  static async createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard | null> {
    try {
      const { data, error } = await supabase
        .from('dashboards')
        .insert({
          ...dashboard,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating dashboard:', error);
      return null;
    }
  }

  static async updateDashboard(id: string, updates: Partial<Dashboard>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('dashboards')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating dashboard:', error);
      return false;
    }
  }

  static async updateWidgetPosition(dashboardId: string, widgetId: string, position: DashboardWidget['position']): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('update_widget_position', {
        dashboard_id: dashboardId,
        widget_id: widgetId,
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating widget position:', error);
      return false;
    }
  }

  // Export Templates Management
  static async getExportTemplates(userId?: string): Promise<ExportTemplate[]> {
    try {
      let query = supabase
        .from('export_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (userId) {
        query = query.or(`created_by.eq.${userId},is_public.eq.true`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching export templates:', error);
      return [];
    }
  }

  static async createExportTemplate(template: Omit<ExportTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExportTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('export_templates')
        .insert({
          ...template,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating export template:', error);
      return null;
    }
  }

  // Advanced Filtering and Querying
  static async executeAdvancedQuery(
    entityType: 'deals' | 'contacts',
    filters: ViewFilter[],
    sorting: ViewSort[],
    limit?: number,
    offset?: number
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('execute_advanced_query', {
        entity_type: entityType,
        filters,
        sorting,
        limit_param: limit,
        offset_param: offset
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error executing advanced query:', error);
      return [];
    }
  }

  // Reporting
  static async generateReport(config: ReportConfig): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('generate_report', {
        report_config: config
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error generating report:', error);
      return null;
    }
  }

  static async getReportHistory(reportId: string, limit = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('report_history')
        .select('*')
        .eq('report_id', reportId)
        .order('generated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching report history:', error);
      return [];
    }
  }

  // Bulk Operations for Views
  static async duplicateView(viewId: string, newName: string): Promise<SavedView | null> {
    try {
      const originalView = await this.getSavedViewById(viewId);
      if (!originalView) return null;

      const duplicatedView = {
        ...originalView,
        name: newName,
        isDefault: false,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      delete (duplicatedView as any).id;
      delete (duplicatedView as any).created_at;
      delete (duplicatedView as any).updated_at;

      return await this.createSavedView(duplicatedView);
    } catch (error) {
      console.error('Error duplicating view:', error);
      return null;
    }
  }

  static async shareView(viewId: string, isPublic: boolean): Promise<boolean> {
    return await this.updateSavedView(viewId, { isPublic });
  }

  private static async getSavedViewById(id: string): Promise<SavedView | null> {
    try {
      const { data, error } = await supabase
        .from('saved_views')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching saved view:', error);
      return null;
    }
  }
}

// Export convenience functions
export const getSavedViews = ViewsReportingService.getSavedViews;
export const createSavedView = ViewsReportingService.createSavedView;
export const updateSavedView = ViewsReportingService.updateSavedView;
export const deleteSavedView = ViewsReportingService.deleteSavedView;
export const setDefaultView = ViewsReportingService.setDefaultView;
export const incrementViewUsage = ViewsReportingService.incrementViewUsage;

export const getCustomMetrics = ViewsReportingService.getCustomMetrics;
export const createCustomMetric = ViewsReportingService.createCustomMetric;
export const calculateMetricValue = ViewsReportingService.calculateMetricValue;
export const getMetricHistory = ViewsReportingService.getMetricHistory;

export const getDashboards = ViewsReportingService.getDashboards;
export const createDashboard = ViewsReportingService.createDashboard;
export const updateDashboard = ViewsReportingService.updateDashboard;
export const updateWidgetPosition = ViewsReportingService.updateWidgetPosition;

export const getExportTemplates = ViewsReportingService.getExportTemplates;
export const createExportTemplate = ViewsReportingService.createExportTemplate;

export const executeAdvancedQuery = ViewsReportingService.executeAdvancedQuery;
export const generateReport = ViewsReportingService.generateReport;
export const getReportHistory = ViewsReportingService.getReportHistory;

export const duplicateView = ViewsReportingService.duplicateView;
export const shareView = ViewsReportingService.shareView;