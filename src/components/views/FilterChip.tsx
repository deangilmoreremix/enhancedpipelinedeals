import React, { useState } from 'react';
import { FilterCondition } from '../ui/AdvancedFilter';
import { X, Edit2, Check } from 'lucide-react';

interface FilterChipProps {
  filter: FilterCondition;
  onRemove: (filter: FilterCondition) => void;
  onEdit?: (filter: FilterCondition) => void;
  editable?: boolean;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  filter,
  onRemove,
  onEdit,
  editable = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState<string | number>(filter.value);

  const getOperatorLabel = (operator: string): string => {
    const labels: Record<string, string> = {
      gt: '>',
      gte: '≥',
      lt: '<',
      lte: '≤',
      eq: '=',
      equals: 'is',
      not_equals: 'is not',
      contains: 'contains',
      starts_with: 'starts with',
      ends_with: 'ends with'
    };
    return labels[operator] || operator;
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      value: 'Value',
      probability: 'Probability',
      stage: 'Stage',
      priority: 'Priority',
      created_at: 'Created Date',
      updated_at: 'Updated Date',
      owner: 'Owner',
      company: 'Company',
      title: 'Title',
      close_date: 'Close Date'
    };
    return labels[field] || field;
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit({ ...filter, value: editedValue });
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEdit();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedValue(filter.value);
    }
  };

  return (
    <div className="inline-flex items-center px-3 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-full text-sm group hover:shadow-sm transition-shadow">
      <span className="text-blue-700 dark:text-blue-300 font-medium">
        {getFieldLabel(filter.field)}
      </span>
      <span className="text-blue-600 dark:text-blue-400 mx-1">{getOperatorLabel(filter.operator)}</span>
      {isEditing ? (
        <input
          type={filter.field === 'value' || filter.field === 'probability' ? 'number' : 'text'}
          value={editedValue}
          onChange={(e) => setEditedValue(
            filter.field === 'value' || filter.field === 'probability'
              ? Number(e.target.value)
              : e.target.value
          )}
          onKeyDown={handleKeyDown}
          onBlur={handleEdit}
          className="w-20 px-1 py-0 border border-gray-300 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-transparent"
          autoFocus
        />
      ) : (
        <span className="text-blue-900 dark:text-blue-200">{String(filter.value)}</span>
      )}

      <div className="flex items-center space-x-1 ml-1">
        {editable && onEdit && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Edit filter"
          >
            {isEditing ? <Check className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
          </button>
        )}
        <button
          onClick={() => onRemove(filter)}
          className="text-blue-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove filter"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

interface FilterChipsContainerProps {
  filters: FilterCondition[];
  onRemove: (filter: FilterCondition) => void;
  onEdit?: (filter: FilterCondition) => void;
  onClearAll?: () => void;
  editable?: boolean;
}

export const FilterChipsContainer: React.FC<FilterChipsContainerProps> = ({
  filters,
  onRemove,
  onEdit,
  onClearAll,
  editable = false
}) => {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Active Filters:</span>
      {filters.map((filter, index) => (
        <FilterChip
          key={`${filter.field}-${filter.operator}-${filter.value}-${index}`}
          filter={filter}
          onRemove={onRemove}
          onEdit={onEdit}
          editable={editable}
        />
      ))}
      {onClearAll && (
        <button
          onClick={onClearAll}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
};

export default FilterChip;