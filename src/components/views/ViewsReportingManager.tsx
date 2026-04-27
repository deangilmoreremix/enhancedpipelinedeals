import React, { useState, useEffect, useMemo } from 'react';
import { Deal, ViewType, SavedView, ViewFilter, ViewSort, ViewColumn, Dashboard, CustomMetric } from '../types';
import {
  Table,
  Kanban,
  BarChart3,
  Calendar,
  Settings,
  Save,
  Share,
  Download,
  Filter,
  Plus
} from 'lucide-react';
import { AdvancedTableView } from './AdvancedTableView';
import { AdvancedKanbanView } from './AdvancedKanbanView';
import { AdvancedDashboardView } from './AdvancedDashboardView';
import { AdvancedCalendarView } from './AdvancedCalendarView';
import { ViewsReportingService } from '../../services/viewsReportingService';
import { CustomMetricsService } from '../../services/customMetricsService';
import { AdvancedFilteringService } from '../../services/advancedFilteringService';
import { exportService } from '../../services/exportService';
import { featureFlagService } from '../../services/featureFlagService';

interface ViewsReportingManagerProps {
  deals: Record<string, Deal>;
  onDealClick: (dealId: string) => void;
  onDealUpdate: (dealId: string, updates: Partial<Deal>) => void;
  currentUserId?: string;
}

export const ViewsReportingManager: React.FC<ViewsReportingManagerProps> = ({
  deals,
  onDealClick,
  onDealUpdate,
  currentUserId
}) => {
  const [currentViewType, setCurrentViewType] = useState<ViewType>('table');
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [currentSavedView, setCurrentSavedView] = useState<SavedView | null>(null);
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);

  // View configuration state
  const [filters, setFilters] = useState<ViewFilter[]>([]);
  const [sorting, setSorting] = useState<ViewSort[]>([]);
  const [columns, setColumns] = useState<ViewColumn[]>([]);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [viewName, setViewName] = useState('');

  // Feature flags
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});

  // Load data on mount
  useEffect(() => {
    loadFeatureFlags();
    loadSavedViews();
    loadCustomMetrics();
    loadDashboards();
    initializeDefaultColumns();
  }, []);

  const loadFeatureFlags = async () => {
    const flags = [
      'advanced_table_view',
      'advanced_kanban_view',
      'advanced_dashboard',
      'advanced_calendar_view',
      'saved_views',
      'custom_metrics',
      'advanced_export',
      'advanced_filtering'
    ];

    const flagValues: Record<string, boolean> = {};
    for (const flag of flags) {
      flagValues[flag] = await featureFlagService.isFeatureEnabled(flag);
    }
    setFeatureFlags(flagValues);
  };

  const loadSavedViews = async () => {
    const views = await ViewsReportingService.getSavedViews(currentUserId);
    setSavedViews(views);

    // Set default view if available
    const defaultView = views.find(v => v.isDefault);
    if (defaultView) {
      loadSavedView(defaultView);
    }
  };

  const loadCustomMetrics = async () => {
    const metrics = await ViewsReportingService.getCustomMetrics(currentUserId);
    setCustomMetrics(metrics);
  };

  const loadDashboards = async () => {
    const boards = await ViewsReportingService.getDashboards(currentUserId);
    setDashboards(boards);

    // Set default dashboard if available
    const defaultDashboard = boards.find(d => d.isDefault);
    if (defaultDashboard) {
      setCurrentDashboard(defaultDashboard);
    }
  };

  const initializeDefaultColumns = () => {
    const defaultColumns: ViewColumn[] = [
      { field: 'title', label: 'Title', type: 'text', sortable: true, filterable: true, visible: true },
      { field: 'company', label: 'Company', type: 'text', sortable: true, filterable: true, visible: true },
      { field: 'contact', label: 'Contact', type: 'text', sortable: true, filterable: true, visible: true },
      { field: 'value', label: 'Value', type: 'currency', sortable: true, filterable: true, visible: true },
      { field: 'stage', label: 'Stage', type: 'select', sortable: true, filterable: true, visible: true },
      { field: 'probability', label: 'Probability', type: 'number', sortable: true, filterable: true, visible: true },
      { field: 'priority', label: 'Priority', type: 'select', sortable: true, filterable: true, visible: true },
      { field: 'dueDate', label: 'Due Date', type: 'date', sortable: true, filterable: true, visible: true },
      { field: 'updatedAt', label: 'Last Updated', type: 'date', sortable: true, filterable: false, visible: true }
    ];
    setColumns(defaultColumns);
  };

  const loadSavedView = (view: SavedView) => {
    setCurrentSavedView(view);
    setCurrentViewType(view.viewType);
    setFilters(view.filters);
    setSorting(view.sorting);
    setColumns(view.columns);
  };

  const saveCurrentView = async () => {
    if (!viewName.trim()) return;

    const viewData = {
      name: viewName,
      viewType: currentViewType,
      filters,
      sorting,
      columns,
      isDefault: false,
      isPublic: false,
      createdBy: currentUserId || 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      tags: []
    };

    const savedView = await ViewsReportingService.createSavedView(viewData);
    if (savedView) {
      setSavedViews(prev => [...prev, savedView]);
      setCurrentSavedView(savedView);
      setShowSaveDialog(false);
      setViewName('');
    }
  };

  const exportCurrentView = async (format: 'csv' | 'xlsx' | 'pdf' | 'json') => {
    const filteredDeals = AdvancedFilteringService.filterDeals(Object.values(deals), filters);

    try {
      const exportData = await exportService.exportDeals(filteredDeals, {
        format,
        includeMetadata: true,
        customColumns: columns.filter(c => c.visible)
      });

      const filename = `deals-export-${new Date().toISOString().split('T')[0]}.${format}`;
      let mimeType = 'text/plain';

      switch (format) {
        case 'csv': mimeType = 'text/csv'; break;
        case 'xlsx': mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; break;
        case 'pdf': mimeType = 'application/pdf'; break;
        case 'json': mimeType = 'application/json'; break;
      }

      exportService.downloadFile(exportData, filename, mimeType);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const viewOptions = useMemo(() => [
    {
      type: 'table' as ViewType,
      label: 'Table',
      icon: Table,
      enabled: featureFlags.advanced_table_view
    },
    {
      type: 'kanban' as ViewType,
      label: 'Kanban',
      icon: Kanban,
      enabled: featureFlags.advanced_kanban_view
    },
    {
      type: 'dashboard' as ViewType,
      label: 'Dashboard',
      icon: BarChart3,
      enabled: featureFlags.advanced_dashboard
    },
    {
      type: 'calendar' as ViewType,
      label: 'Calendar',
      icon: Calendar,
      enabled: featureFlags.advanced_calendar_view
    }
  ], [featureFlags]);

  const renderCurrentView = () => {
    switch (currentViewType) {
      case 'table':
        return (
          <AdvancedTableView
            deals={deals}
            columns={columns}
            filters={filters}
            sorting={sorting}
            onDealClick={onDealClick}
            onDealUpdate={onDealUpdate}
            onColumnResize={(columnId, width) => {
              setColumns(prev => prev.map(col =>
                col.field === columnId ? { ...col, width } : col
              ));
            }}
            onSortingChange={setSorting}
            onFiltersChange={setFilters}
            selectable={true}
            showToolbar={true}
          />
        );

      case 'kanban':
        return (
          <AdvancedKanbanView
            deals={deals}
            config={{
              columns: [
                { id: 'qualification', title: 'Qualification', color: '#3b82f6' },
                { id: 'proposal', title: 'Proposal', color: '#6366f1' },
                { id: 'negotiation', title: 'Negotiation', color: '#f59e0b' },
                { id: 'closed-won', title: 'Won', color: '#10b981' },
                { id: 'closed-lost', title: 'Lost', color: '#ef4444' }
              ],
              cardTemplate: {
                showFields: ['title', 'company', 'value', 'probability'],
                layout: 'detailed'
              }
            }}
            onDealClick={onDealClick}
            onDealMove={(dealId, newStage) => {
              onDealUpdate(dealId, { stage: newStage as any });
            }}
            onDealUpdate={onDealUpdate}
            showMetrics={true}
          />
        );

      case 'dashboard':
        return currentDashboard ? (
          <AdvancedDashboardView
            deals={deals}
            dashboard={currentDashboard}
            customMetrics={customMetrics}
            isEditable={false}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No dashboard selected
          </div>
        );

      case 'calendar':
        return (
          <AdvancedCalendarView
            deals={deals}
            config={{
              dateField: 'dueDate',
              viewMode: 'month',
              eventTemplate: {
                titleField: 'title',
                descriptionField: 'company',
                colorField: 'stage'
              },
              filters: []
            }}
            onDealClick={onDealClick}
          />
        );

      default:
        return <div>View not implemented</div>;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Views & Reporting</h1>

            {/* View Type Selector */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {viewOptions.filter(option => option.enabled).map(option => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.type}
                    onClick={() => setCurrentViewType(option.type)}
                    className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                      currentViewType === option.type
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {featureFlags.advanced_filtering && (
              <button
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  showFiltersPanel
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {filters.length > 0 && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                    {filters.length}
                  </span>
                )}
              </button>
            )}

            {featureFlags.saved_views && (
              <button
                onClick={() => setShowSaveDialog(true)}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium"
              >
                <Save className="w-4 h-4" />
                Save View
              </button>
            )}

            {featureFlags.advanced_export && (
              <div className="relative">
                <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium">
                  <Download className="w-4 h-4" />
                  Export
                </button>
                {/* Export dropdown would go here */}
              </div>
            )}

            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Current View Info */}
        {currentSavedView && (
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
            <span>Current view: <strong>{currentSavedView.name}</strong></span>
            <span>•</span>
            <span>{currentSavedView.description}</span>
            {currentSavedView.tags && currentSavedView.tags.length > 0 && (
              <>
                <span>•</span>
                <div className="flex gap-1">
                  {currentSavedView.tags.map(tag => (
                    <span key={tag} className="bg-gray-100 px-2 py-1 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Filters Panel */}
      {showFiltersPanel && featureFlags.advanced_filtering && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Filters</h3>
            <button
              onClick={() => setShowFiltersPanel(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          {/* Advanced filtering UI would go here */}
          <div className="text-sm text-gray-600">
            Advanced filtering controls - {filters.length} active filters
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {renderCurrentView()}
      </div>

      {/* Save View Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Save Current View</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                View Name
              </label>
              <input
                type="text"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter view name..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={saveCurrentView}
                disabled={!viewName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};