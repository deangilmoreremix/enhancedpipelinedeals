import React, { useState, useEffect } from 'react';
import { SavedPipelineView, getAllViews, setDefaultView, deleteView, saveCurrentView as saveView } from '../../services/savedPipelineViewService';
import { isFeatureEnabled } from '../../services/featureFlagService';

/**
 * Saved Pipeline Views Panel - Twenty Feature
 * Allows users to manage and switch between saved pipeline view configurations
 */
export const SavedViewsPanel: React.FC<{
  onViewSelect?: (view: SavedPipelineView) => void;
  currentViewType?: string;
  currentFilters?: any;
  currentSorting?: any;
  currentColumns?: string[];
}> = ({ onViewSelect, currentViewType, currentFilters, currentSorting, currentColumns }) => {
  const [views, setViews] = useState<SavedPipelineView[]>([]);
  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  useEffect(() => {
    const init = async () => {
      const enabled = await isFeatureEnabled('twenty_views_reporting');
      setFeatureEnabled(enabled);

      if (enabled) {
        await loadViews();
      }
      setLoading(false);
    };

    init();
  }, []);

  const loadViews = async () => {
    const viewData = await getAllViews();
    setViews(viewData);
  };

  const handleSetDefault = async (viewId: string) => {
    const success = await setDefaultView(viewId);
    if (success) {
      await loadViews(); // Refresh to show updated default status
    }
  };

  const handleDelete = async (viewId: string) => {
    if (window.confirm('Are you sure you want to delete this saved view?')) {
      const success = await deleteView(viewId);
      if (success) {
        await loadViews(); // Refresh the list
      }
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!featureEnabled) {
    return (
      <div className="p-4 text-center text-gray-500">
        Saved Views feature is not yet available.
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Saved Pipeline Views</h3>

      {views.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          No saved views yet. Save your current view configuration to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {views.map((view) => (
            <div
              key={view.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex justify-between items-center"
            >
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {view.name}
                  </h4>
                  {view.is_default && (
                    <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded">
                      Default
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                  <span className="capitalize">{view.view_type}</span>
                  <span>{view.columns?.length || 0} columns</span>
                  {view.filters && Object.keys(view.filters).length > 0 && (
                    <span>{Object.keys(view.filters).length} filters</span>
                  )}
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  className="text-sm bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded"
                  onClick={() => onViewSelect?.(view)}
                >
                  Load
                </button>
                {!view.is_default && (
                  <button
                    className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
                    onClick={() => handleSetDefault(view.id)}
                  >
                    Set Default
                  </button>
                )}
                <button
                  className="text-sm bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                  onClick={() => handleDelete(view.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => setShowSaveModal(true)}
        >
          Save Current View
        </button>
      </div>

      {/* Save View Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Save Current View</h3>
            <input
              type="text"
              placeholder="Enter view name"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                className="px-3 py-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded text-gray-700 dark:text-gray-200"
                onClick={() => {
                  setShowSaveModal(false);
                  setNewViewName('');
                }}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
                onClick={async () => {
                  if (!newViewName.trim()) return;
                  await saveView(
                    newViewName,
                    currentViewType || 'kanban',
                    currentFilters || {},
                    currentSorting || {},
                    currentColumns || []
                  );
                  setShowSaveModal(false);
                  setNewViewName('');
                  await loadViews();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};