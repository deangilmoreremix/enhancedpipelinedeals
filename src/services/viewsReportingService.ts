import { supabase } from './supabaseService';
import { AdvancedFilteringService } from './advancedFilteringService';
import { CustomMetricsService } from './customMetricsService';
import { dealFromRow } from './dealMapper';
import { assertRowsAffected } from '../utils/rlsError';
import {
  SavedPipelineView,
  SavedPipelineViewService,
  SavedViewFilters,
  SavedViewType,
  normalizeSavedFilters,
  normalizeSavedSorting
} from './savedPipelineViewService';
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

// ---- client-side report / query helpers (no server RPCs exist for these) ------
type AnyRecord = Record<string, any>;

const applyAdvancedFilters = (rows: AnyRecord[], filters: ViewFilter[]): AnyRecord[] =>
  !filters || filters.length === 0 ? rows : AdvancedFilteringService.filterContacts(rows as any, filters) as AnyRecord[];

/**
 * Group + aggregate `records` per `ReportConfig.dataSource`. Pure so it can be unit tested.
 * Returns the filtered rows, the grouped rows (one per group key) and overall totals.
 */
export function buildReport(config: ReportConfig, records: AnyRecord[]) {
  const ds = config.dataSource;
  const rows = applyAdvancedFilters(records, ds.filters ?? []);
  const aggs = ds.aggregations?.length ? ds.aggregations : [{ field: '*', function: 'count' as const, alias: 'count' }];
  const compute = (list: AnyRecord[]) => {
    const out: Record<string, number> = {};
    for (const a of aggs) {
      const alias = a.alias || `${a.function}_${a.field}`;
      const nums = list.map(r => Number(r[a.field])).filter(n => Number.isFinite(n));
      switch (a.function) {
        case 'count': out[alias] = list.length; break;
        case 'sum': out[alias] = nums.reduce((x, y) => x + y, 0); break;
        case 'avg': out[alias] = nums.length ? nums.reduce((x, y) => x + y, 0) / nums.length : 0; break;
        case 'min': out[alias] = nums.length ? Math.min(...nums) : 0; break;
        case 'max': out[alias] = nums.length ? Math.max(...nums) : 0; break;
      }
    }
    return out;
  };
  const groupBy = ds.groupBy ?? [];
  let groups: Array<{ key: Record<string, unknown>; count: number; values: Record<string, number> }> = [];
  if (groupBy.length) {
    const map = new Map<string, { key: Record<string, unknown>; list: AnyRecord[] }>();
    for (const r of rows) {
      const key: Record<string, unknown> = {};
      groupBy.forEach(g => { key[g] = r[g] ?? null; });
      const id = JSON.stringify(key);
      const slot = map.get(id) ?? { key, list: [] };
      slot.list.push(r);
      map.set(id, slot);
    }
    groups = [...map.values()].map(g => ({ key: g.key, count: g.list.length, values: compute(g.list) }));
  }
  return {
    reportId: config.id,
    name: config.name,
    type: config.type,
    entity: ds.entity,
    generatedAt: new Date().toISOString(),
    totalRecords: rows.length,
    totals: compute(rows),
    groups,
    rows: config.type === 'detailed' || !groupBy.length ? rows : [],
  };
}

// ---- saved view <-> saved_pipeline_views row mapping ------------------------
const toRowViewType = (t: SavedView['viewType'] | undefined): SavedViewType => (t === 'kanban' || !t ? 'board' : t);
const fromRowViewType = (t: SavedViewType): SavedView['viewType'] =>
  t === 'board' ? 'kanban' : t === 'list' ? 'table' : (t as SavedView['viewType']);

const packFilters = (conditions: ViewFilter[], base?: SavedViewFilters): SavedViewFilters => ({
  conditions,
  groups: base?.groups ?? [],
  search: base?.search ?? '',
  favoritesOnly: base?.favoritesOnly ?? false
});

function rowToSavedView(row: SavedPipelineView): SavedView {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    viewType: fromRowViewType(row.view_type),
    filters: normalizeSavedFilters(row.filters).conditions,
    sorting: normalizeSavedSorting(row.sorting),
    columns: Array.isArray(row.columns) ? (row.columns as ViewColumn[]) : [],
    groupBy: row.group_by ? row.group_by.split(',').filter(Boolean) : undefined,
    isDefault: row.is_default,
    isPublic: row.is_public,
    createdBy: row.user_id ?? '',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    usageCount: row.usage_count,
    tags: row.tags
  };
}

/** camelCase SavedView fields -> row columns (only the ones present). */
function savedViewToPatch(v: Partial<SavedView>): Partial<SavedPipelineView> {
  const patch: Partial<SavedPipelineView> = {};
  if (v.name !== undefined) patch.name = v.name;
  if (v.description !== undefined) patch.description = v.description;
  if (v.viewType !== undefined) patch.view_type = toRowViewType(v.viewType);
  if (v.sorting !== undefined) patch.sorting = v.sorting;
  if (v.columns !== undefined) patch.columns = v.columns;
  if (v.groupBy !== undefined) patch.group_by = v.groupBy.join(',') || null;
  if (v.isDefault !== undefined) patch.is_default = v.isDefault;
  if (v.isPublic !== undefined) patch.is_public = v.isPublic;
  if (v.usageCount !== undefined) patch.usage_count = v.usageCount;
  if (v.tags !== undefined) patch.tags = v.tags;
  return patch;
}

/**
 * Views and Reporting Service
 * Handles saved views, custom metrics, dashboards, and reporting functionality
 */
export class ViewsReportingService {
  // Saved Views Management
  // Backed by the single canonical table `saved_pipeline_views` through SavedPipelineViewService.
  static async getSavedViews(userId?: string): Promise<SavedView[]> {
    const rows = await SavedPipelineViewService.getAllViews();
    const visible = userId ? rows.filter(r => r.user_id === userId || r.is_public || r.user_id === null) : rows;
    return visible
      .map(rowToSavedView)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  static async createSavedView(view: Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedView | null> {
    const row = await SavedPipelineViewService.createView({
      ...savedViewToPatch(view),
      name: view.name,
      view_type: toRowViewType(view.viewType),
      filters: packFilters(view.filters ?? []),
      sorting: view.sorting ?? [],
      columns: view.columns ?? []
    });
    return row ? rowToSavedView(row) : null;
  }

  static async updateSavedView(id: string, updates: Partial<SavedView>): Promise<boolean> {
    const patch = savedViewToPatch(updates);
    if (updates.filters) {
      const existing = await SavedPipelineViewService.getViewById(id);
      patch.filters = packFilters(updates.filters, normalizeSavedFilters(existing?.filters));
    }
    return SavedPipelineViewService.updateView(id, patch);
  }

  static async deleteSavedView(id: string): Promise<boolean> {
    return SavedPipelineViewService.deleteView(id);
  }

  static async setDefaultView(id: string, _userId?: string): Promise<boolean> {
    return SavedPipelineViewService.setDefaultView(id);
  }

  static async incrementViewUsage(id: string): Promise<void> {
    await SavedPipelineViewService.incrementUsage(id);
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

  /**
   * Client-side metric evaluation (there is no `calculate_custom_metric` RPC): loads the metric
   * definition, the live (non-deleted) deals, applies the filters and runs the formula engine.
   */
  static async calculateMetricValue(metricId: string, filters?: ViewFilter[]): Promise<number | null> {
    try {
      const { data: row, error } = await supabase.from('custom_metrics').select('*').eq('id', metricId).maybeSingle();
      if (error) throw error;
      if (!row) return null;
      const { data: dealRows, error: dErr } = await supabase.from('deals').select('*').is('deleted_at', null);
      if (dErr) throw dErr;
      let deals = (dealRows ?? []).map(dealFromRow);
      if (filters?.length) deals = AdvancedFilteringService.filterDeals(deals, filters);
      const metric: CustomMetric = {
        id: row.id,
        name: row.name ?? '',
        description: row.description ?? '',
        formula: row.formula ?? '',
        parameters: row.parameters ?? {},
        dataType: row.data_type ?? 'number',
        category: row.category ?? 'custom',
        visualization: row.visualization ?? 'number',
        isActive: row.is_active ?? true,
        createdBy: row.created_by ?? '',
        createdAt: new Date(row.created_at ?? Date.now()),
        updatedAt: new Date(row.updated_at ?? Date.now()),
      };
      return await CustomMetricsService.calculateMetric(metric, deals);
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

  /**
   * Plain updates (there is no `update_widget_position` RPC): widgets live in `dashboards.widgets`
   * (jsonb) or, for analytics dashboards, as `dashboard_widgets` rows. Both paths verify a row changed.
   */
  static async updateWidgetPosition(dashboardId: string, widgetId: string, position: DashboardWidget['position']): Promise<boolean> {
    try {
      const { data: dash, error: gErr } = await supabase.from('dashboards').select('id,widgets').eq('id', dashboardId).maybeSingle();
      if (gErr) throw gErr;
      const widgets = Array.isArray(dash?.widgets) ? (dash!.widgets as DashboardWidget[]) : null;
      if (widgets && widgets.some(w => w.id === widgetId)) {
        const next = widgets.map(w => (w.id === widgetId ? { ...w, position } : w));
        const { data, error } = await supabase
          .from('dashboards').update({ widgets: next, updated_at: new Date().toISOString() }).eq('id', dashboardId).select('id');
        if (error) throw error;
        assertRowsAffected(data);
        return true;
      }
      const { data, error } = await supabase
        .from('dashboard_widgets')
        .update({ position, updated_at: new Date().toISOString() })
        .eq('id', widgetId)
        .eq('dashboard_id', dashboardId)
        .select('id');
      if (error) throw error;
      assertRowsAffected(data);
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
  /** Client-side filter/sort/page over the live table (there is no `execute_advanced_query` RPC). */
  static async executeAdvancedQuery(
    entityType: 'deals' | 'contacts',
    filters: ViewFilter[],
    sorting: ViewSort[],
    limit?: number,
    offset?: number
  ): Promise<any[]> {
    try {
      let q = supabase.from(entityType).select('*');
      if (entityType === 'deals') q = q.is('deleted_at', null);
      const { data, error } = await q;
      if (error) throw error;
      let rows: any[] = entityType === 'deals' ? (data ?? []).map(dealFromRow) : (data ?? []);
      if (filters?.length) {
        rows = entityType === 'deals'
          ? AdvancedFilteringService.filterDeals(rows, filters)
          : AdvancedFilteringService.filterContacts(rows, filters);
      }
      if (sorting?.length) {
        if (entityType === 'deals') rows = AdvancedFilteringService.sortDeals(rows, sorting);
        else {
          const sorts = [...sorting].sort((a, b) => a.priority - b.priority);
          rows = [...rows].sort((a, b) => {
            for (const s of sorts) {
              const av = a[s.field]; const bv = b[s.field];
              if (av === bv) continue;
              const cmp = av == null ? -1 : bv == null ? 1 : av < bv ? -1 : 1;
              return s.direction === 'desc' ? -cmp : cmp;
            }
            return 0;
          });
        }
      }
      const start = offset ?? 0;
      return limit != null ? rows.slice(start, start + limit) : rows.slice(start);
    } catch (error) {
      console.error('Error executing advanced query:', error);
      return [];
    }
  }

  // Reporting
  /** Client-side report (there is no `generate_report` RPC); the run is logged to `report_history`. */
  static async generateReport(config: ReportConfig): Promise<any> {
    try {
      const table = config.dataSource.entity;
      let q = supabase.from(table).select('*');
      if (table === 'deals') q = q.is('deleted_at', null);
      const { data, error } = await q;
      if (error) throw error;
      const records = table === 'deals' ? (data ?? []).map(dealFromRow) : (data ?? []);
      const result = buildReport(config, records as AnyRecord[]);
      try {
        await supabase.from('report_history').insert({ report_id: String(config.id), parameters: config as unknown as AnyRecord, result: { ...result, rows: undefined } });
      } catch { /* history is best effort */ }
      return result;
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
    const row = await SavedPipelineViewService.getViewById(id);
    return row ? rowToSavedView(row) : null;
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