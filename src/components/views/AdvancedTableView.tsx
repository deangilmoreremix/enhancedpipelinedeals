import React, { useState, useMemo, useCallback } from 'react';
import { Deal, ViewColumn, ViewFilter, ViewSort } from '../types';
import { ChevronUp, ChevronDown, Filter, MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import { AdvancedFilteringService } from '../../services/advancedFilteringService';

interface AdvancedTableViewProps {
  deals: Record<string, Deal>;
  columns: ViewColumn[];
  filters: ViewFilter[];
  sorting: ViewSort[];
  onDealClick: (dealId: string) => void;
  onDealUpdate: (dealId: string, updates: Partial<Deal>) => void;
  onColumnResize?: (columnId: string, width: number) => void;
  onSortingChange?: (sorting: ViewSort[]) => void;
  onFiltersChange?: (filters: ViewFilter[]) => void;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  density?: 'compact' | 'comfortable' | 'spacious';
  showToolbar?: boolean;
}

export const AdvancedTableView: React.FC<AdvancedTableViewProps> = ({
  deals,
  columns,
  filters,
  sorting,
  onDealClick,
  onDealUpdate,
  onColumnResize,
  onSortingChange,
  onFiltersChange,
  selectable = false,
  onSelectionChange,
  density = 'comfortable',
  showToolbar = true
}) => {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // Filter and sort deals
  const processedDeals = useMemo(() => {
    let result = Object.values(deals);

    // Apply filters
    if (filters.length > 0) {
      result = AdvancedFilteringService.filterDeals(result, filters);
    }

    // Apply sorting
    if (sorting.length > 0) {
      result.sort((a, b) => {
        for (const sort of sorting) {
          const aValue = getNestedValue(a, sort.field);
          const bValue = getNestedValue(b, sort.field);

          let comparison = 0;
          if (aValue < bValue) comparison = -1;
          else if (aValue > bValue) comparison = 1;

          if (comparison !== 0) {
            return sort.direction === 'asc' ? comparison : -comparison;
          }
        }
        return 0;
      });
    }

    return result;
  }, [deals, filters, sorting]);

  // Handle column sorting
  const handleSort = useCallback((columnField: string) => {
    if (!onSortingChange) return;

    const existingSortIndex = sorting.findIndex(s => s.field === columnField);
    let newSorting: ViewSort[];

    if (existingSortIndex >= 0) {
      // Toggle direction or remove if already desc
      const currentSort = sorting[existingSortIndex];
      if (currentSort.direction === 'asc') {
        newSorting = sorting.map(s =>
          s.field === columnField ? { ...s, direction: 'desc' as const } : s
        );
      } else {
        // Remove this sort
        newSorting = sorting.filter(s => s.field !== columnField);
      }
    } else {
      // Add new sort as primary
      newSorting = [
        { field: columnField, direction: 'asc', priority: 0 },
        ...sorting.map(s => ({ ...s, priority: s.priority + 1 }))
      ];
    }

    onSortingChange(newSorting);
  }, [sorting, onSortingChange]);

  // Handle row selection
  const handleRowSelect = useCallback((dealId: string, selected: boolean) => {
    const newSelection = new Set(selectedRows);
    if (selected) {
      newSelection.add(dealId);
    } else {
      newSelection.delete(dealId);
    }
    setSelectedRows(newSelection);
    onSelectionChange?.(Array.from(newSelection));
  }, [selectedRows, onSelectionChange]);

  const handleSelectAll = useCallback((selected: boolean) => {
    const newSelection = selected ? new Set(processedDeals.map(d => d.id)) : new Set<string>();
    setSelectedRows(newSelection);
    onSelectionChange?.(Array.from(newSelection));
  }, [processedDeals, onSelectionChange]);

  // Handle column resizing
  const handleResizeStart = useCallback((columnId: string, startX: number, startWidth: number) => {
    setResizingColumn(columnId);
    setStartX(startX);
    setStartWidth(startWidth);
  }, []);

  const handleResizeMove = useCallback((currentX: number) => {
    if (!resizingColumn) return;

    const deltaX = currentX - startX;
    const newWidth = Math.max(50, startWidth + deltaX);

    onColumnResize?.(resizingColumn, newWidth);
  }, [resizingColumn, startX, startWidth, onColumnResize]);

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null);
  }, []);

  // Get sort icon for column
  const getSortIcon = useCallback((field: string) => {
    const sort = sorting.find(s => s.field === field);
    if (!sort) return null;

    return sort.direction === 'asc' ?
      <ChevronUp className="w-4 h-4" /> :
      <ChevronDown className="w-4 h-4" />;
  }, [sorting]);

  // Format cell value
  const formatCellValue = useCallback((deal: Deal, column: ViewColumn) => {
    const value = getNestedValue(deal, column.field);

    if (value === null || value === undefined) return '';

    switch (column.type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0
        }).format(value);

      case 'number':
        return column.format ? new Intl.NumberFormat('en-US', column.format).format(value) : value;

      case 'date':
        const date = new Date(value);
        return date.toLocaleDateString('en-US', column.format || {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

      case 'boolean':
        return value ? 'Yes' : 'No';

      case 'array':
        return Array.isArray(value) ? value.join(', ') : value;

      default:
        return String(value);
    }
  }, []);

  // Get density classes
  const getDensityClasses = useCallback(() => {
    switch (density) {
      case 'compact':
        return 'text-sm leading-tight';
      case 'spacious':
        return 'text-base leading-relaxed py-4';
      default:
        return 'text-sm leading-normal py-2';
    }
  }, [density]);

  return (
    <div className="flex flex-col h-full">
      {showToolbar && (
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center gap-4">
            {selectable && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedRows.size === processedDeals.length && processedDeals.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-600">
                  {selectedRows.size > 0 ? `${selectedRows.size} selected` : 'Select all'}
                </span>
              </label>
            )}
            <span className="text-sm text-gray-500">
              {processedDeals.length} deals
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded">
              <Filter className="w-4 h-4" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {selectable && (
                <th className="w-12 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === processedDeals.length && processedDeals.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                </th>
              )}
              {columns.filter(col => col.visible).map((column) => (
                <th
                  key={column.field}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 relative group"
                  style={{ width: column.width || 'auto' }}
                  onClick={() => column.sortable && handleSort(column.field)}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {getSortIcon(column.field) || <ChevronUp className="w-4 h-4 text-gray-400" />}
                      </div>
                    )}
                  </div>

                  {/* Resize handle */}
                  {onColumnResize && (
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      onMouseDown={(e) => {
                        handleResizeStart(column.field, e.clientX, column.width || 150);
                      }}
                    />
                  )}
                </th>
              ))}
              <th className="w-20 px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {processedDeals.map((deal) => (
              <tr
                key={deal.id}
                className={`hover:bg-gray-50 cursor-pointer ${getDensityClasses()}`}
                onClick={() => onDealClick(deal.id)}
              >
                {selectable && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(deal.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleRowSelect(deal.id, e.target.checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />
                  </td>
                )}
                {columns.filter(col => col.visible).map((column) => (
                  <td key={column.field} className="px-4 py-3 text-gray-900">
                    {formatCellValue(deal, column)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle edit
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle delete
                      }}
                      className="p-1 hover:bg-gray-100 rounded text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resize overlay */}
      {resizingColumn && (
        <div
          className="fixed inset-0 z-50 cursor-col-resize"
          onMouseMove={(e) => handleResizeMove(e.clientX)}
          onMouseUp={handleResizeEnd}
          onMouseLeave={handleResizeEnd}
        />
      )}
    </div>
  );
};

// Helper function to get nested object values
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}