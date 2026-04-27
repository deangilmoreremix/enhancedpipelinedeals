import React, { useState, useEffect } from 'react';
import { SavedPipelineView, getAllViews, setDefaultView, deleteView } from '../../services/savedPipelineViewService';
import { isFeatureEnabled } from '../../services/featureFlagService';

/**
 * Saved Pipeline Views Panel - Twenty Feature
 * Allows users to manage and switch between saved pipeline view configurations
 */
export const SavedViewsPanel: React.FC<{
  onViewSelect?: (view: SavedPipelineView) => void;
}> = ({ onViewSelect }) => {
  const [views, setViews] = useState<SavedPipelineView[]>([]);
  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(false);

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
          onClick={() => {
            // TODO: Implement save current view functionality
            console.log('Save current view');
          }}
        >
          Save Current View
        </button>
      </div>
    </div>
  );
};