import React, { useState, useEffect } from 'react';
import { isFeatureEnabled } from '../../../services/featureFlagService';
import { getCustomColumns } from '../../../services/pipelineColumnService';
import { CustomPipelineColumn } from '../../../types/pipeline';

export interface CustomPipelineColumn {
  id: string;
  name: string;
  position: number;
  config: {
    color?: string;
    wipLimit?: number;
    description?: string;
  };
  is_active: boolean;
}

export interface CustomColumnManagerProps {
  onColumnsChange?: (columns: CustomPipelineColumn[]) => void;
  onClose?: () => void;
}

/**
 * Manager for custom pipeline columns (Twenty feature)
 */
export const CustomColumnManager: React.FC<CustomColumnManagerProps> = ({
  onColumnsChange,
  onClose
}) => {
  const [columns, setColumns] = useState<CustomPipelineColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(false);

  useEffect(() => {
    const init = async () => {
      const enabled = await isFeatureEnabled('twenty_custom_columns');
      setFeatureEnabled(enabled);

      if (enabled) {
        // Load custom columns from service
        const savedColumns = await getCustomColumns();
        if (savedColumns && savedColumns.length > 0) {
          setColumns(savedColumns);
        } else {
          // Default columns fallback
          const defaultColumns: CustomPipelineColumn[] = [
            {
              id: 'qualification',
              name: 'Qualification',
              position: 1,
              config: { color: 'border-blue-500', wipLimit: 10 },
              is_active: true
            },
            {
              id: 'proposal',
              name: 'Proposal',
              position: 2,
              config: { color: 'border-indigo-500', wipLimit: 8 },
              is_active: true
            },
            {
              id: 'negotiation',
              name: 'Negotiation',
              position: 3,
              config: { color: 'border-purple-500', wipLimit: 6 },
              is_active: true
            },
            {
              id: 'closed-won',
              name: 'Closed Won',
              position: 4,
              config: { color: 'border-green-500', wipLimit: 0 },
              is_active: true
            },
            {
              id: 'closed-lost',
              name: 'Closed Lost',
              position: 5,
              config: { color: 'border-red-500', wipLimit: 0 },
              is_active: true
            }
          ];
          setColumns(defaultColumns);
        }
      }
      setLoading(false);
    };

    init();
  }, []);

  const addColumn = () => {
    const newColumn: CustomPipelineColumn = {
      id: `custom-${Date.now()}`,
      name: 'New Column',
      position: columns.length + 1,
      config: { color: 'border-gray-500', wipLimit: 5 },
      is_active: true
    };
    const updatedColumns = [...columns, newColumn];
    setColumns(updatedColumns);
    onColumnsChange?.(updatedColumns);
  };

  const updateColumn = (id: string, updates: Partial<CustomPipelineColumn>) => {
    const updatedColumns = columns.map(col =>
      col.id === id ? { ...col, ...updates } : col
    );
    setColumns(updatedColumns);
    onColumnsChange?.(updatedColumns);
  };

  const deleteColumn = (id: string) => {
    const updatedColumns = columns.filter(col => col.id !== id);
    setColumns(updatedColumns);
    onColumnsChange?.(updatedColumns);
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
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
        Custom Columns feature is not yet available.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Manage Pipeline Columns
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {columns.map((column) => (
          <div key={column.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <input
                type="text"
                value={column.name}
                onChange={(e) => updateColumn(column.id, { name: e.target.value })}
                className="font-medium text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
              />
              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-1 text-sm">
                  <input
                    type="checkbox"
                    checked={column.is_active}
                    onChange={(e) => updateColumn(column.id, { is_active: e.target.checked })}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-gray-600 dark:text-gray-400">Active</span>
                </label>
                <button
                  onClick={() => deleteColumn(column.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  WIP Limit
                </label>
                <input
                  type="number"
                  value={column.config.wipLimit || 0}
                  onChange={(e) => updateColumn(column.id, {
                    config: { ...column.config, wipLimit: parseInt(e.target.value) || 0 }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Position
                </label>
                <input
                  type="number"
                  value={column.position}
                  onChange={(e) => updateColumn(column.id, { position: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="1"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={column.config.description || ''}
                onChange={(e) => updateColumn(column.id, {
                  config: { ...column.config, description: e.target.value }
                })}
                placeholder="Optional description..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-between">
        <button
          onClick={addColumn}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Add Column</span>
        </button>

        <button
          onClick={onClose}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
        >
          Done
        </button>
      </div>
    </div>
  );
};