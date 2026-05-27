import React, { useState, useRef, useEffect } from 'react';
import { FilterCondition } from '../ui/AdvancedFilter';
import { X, Edit2, Check, Tag } from 'lucide-react';

interface EditableChipProps {
  filter?: FilterCondition;
  onSave: (filter: FilterCondition) => void;
  onCancel?: () => void;
  onDelete?: (filterId: string) => void;
  availableFields?: Array<{ id: string; label: string; type: 'text' | 'number' | 'select' | 'date' }>;
  availableOperators?: Array<{ id: string; label: string }>;
  editMode?: boolean;
}

const DEFAULT_FIELDS: Array<{ id: string; label: string; type: 'text' | 'number' | 'select' | 'date' }> = [
  { id: 'value', label: 'Value', type: 'number' },
  { id: 'probability', label: 'Probability', type: 'number' },
  { id: 'stage', label: 'Stage', type: 'select' },
  { id: 'priority', label: 'Priority', type: 'select' },
  { id: 'created_at', label: 'Created Date', type: 'date' },
  { id: 'close_date', label: 'Close Date', type: 'date' }
];

const DEFAULT_OPERATORS: Record<string, Array<{ id: string; label: string }>> = {
  value: [
    { id: 'gt', label: '>' },
    { id: 'lt', label: '<' },
    { id: 'eq', label: '=' },
    { id: 'gte', label: '≥' },
    { id: 'lte', label: '≤' }
  ],
  probability: [
    { id: 'gt', label: '>' },
    { id: 'lt', label: '<' },
    { id: 'eq', label: '=' },
    { id: 'gte', label: '≥' },
    { id: 'lte', label: '≤' }
  ],
  stage: [
    { id: 'equals', label: 'is' },
    { id: 'not_equals', label: 'is not' }
  ],
  priority: [
    { id: 'equals', label: 'is' },
    { id: 'not_equals', label: 'is not' }
  ],
  created_at: [
    { id: 'gt', label: 'after' },
    { id: 'lt', label: 'before' },
    { id: 'eq', label: 'on' }
  ],
  close_date: [
    { id: 'gt', label: 'after' },
    { id: 'lt', label: 'before' },
    { id: 'eq', label: 'on' }
  ]
};

export const EditableChip: React.FC<EditableChipProps> = ({
  filter,
  onSave,
  onCancel,
  onDelete,
  availableFields = DEFAULT_FIELDS,
  editMode = false
}) => {
  const [internalEditMode, setInternalEditMode] = useState(editMode);
  const [field, setField] = useState(filter?.field || availableFields[0].id);
  const [operator, setOperator] = useState(filter?.operator || 'eq');
  const [value, setValue] = useState<string | number | Date>(filter?.value || '');
  const [tag, setTag] = useState<string>('');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (internalEditMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [internalEditMode]);

  const operators = DEFAULT_OPERATORS[field] || [];

  const handleSave = () => {
    const newFilter: FilterCondition = {
      field,
      operator,
      value: typeof value === 'string' ? value : value
    };

    onSave(newFilter);
    setInternalEditMode(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
    if (e.key === 'Escape' && onCancel) {
      onCancel();
      setInternalEditMode(false);
    }
  };

  const renderValueInput = () => {
    const fieldConfig = availableFields.find(f => f.id === field);

    switch (fieldConfig?.type) {
      case 'number':
        return (
          <input
            ref={inputRef}
            type="number"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-[80px] px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter value"
          />
        );
      case 'select':
        const options: Record<string, Array<{ id: string; label: string }>> = {
          priority: [
            { id: 'high', label: 'High' },
            { id: 'medium', label: 'Medium' },
            { id: 'low', label: 'Low' }
          ],
          stage: [
            { id: 'qualification', label: 'Qualification' },
            { id: 'proposal', label: 'Proposal' },
            { id: 'negotiation', label: 'Negotiation' },
            { id: 'closed-won', label: 'Closed Won' },
            { id: 'closed-lost', label: 'Closed Lost' }
          ]
        };
        return (
          <select
            ref={inputRef}
            value={String(value)}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-[100px] px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-transparent"
          >
            {options[field]?.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        );
      case 'date':
        return (
          <input
            ref={inputRef}
            type="date"
            value={value instanceof Date ? value.toISOString().split('T')[0] : ''}
            onChange={(e) => setValue(new Date(e.target.value))}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-[120px] px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-transparent"
          />
        );
      default:
        return (
          <input
            ref={inputRef}
            type="text"
            value={String(value)}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-[80px] px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter value"
          />
        );
    }
  };

  if (!internalEditMode && !filter) {
    return (
      <button
        onClick={() => setInternalEditMode(true)}
        className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        <Tag className="w-3 h-3 mr-1" />
        <span>Add Filter</span>
      </button>
    );
  }

  return (
    <div className="inline-flex items-center px-3 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-full text-sm">
      {internalEditMode ? (
        <>
          <select
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white mr-1 focus:ring-1 focus:ring-blue-500"
          >
            {availableFields.map(f => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>

          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white mr-1 focus:ring-1 focus:ring-blue-500"
          >
            {operators.map(op => (
              <option key={op.id} value={op.id}>{op.label}</option>
            ))}
          </select>

          {renderValueInput()}

          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Tag (optional)"
            className="w-20 px-1 py-0.5 ml-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
          />

          <div className="flex items-center space-x-1 ml-1">
            <button
              onClick={handleSave}
              className="text-blue-600 hover:text-blue-800"
              title="Save"
            >
              <Check className="w-3 h-3" />
            </button>
            {onCancel && (
              <button
                onClick={() => {
                  onCancel();
                  setInternalEditMode(false);
                }}
                className="text-gray-500 hover:text-gray-700"
                title="Cancel"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <span className="text-blue-700 dark:text-blue-300 font-medium">
            {availableFields.find(f => f.id === filter.field)?.label || filter.field}
          </span>
          <span className="text-blue-600 dark:text-blue-400 mx-1">
            {DEFAULT_OPERATORS[filter.field]?.find(o => o.id === filter.operator)?.label || filter.operator}
          </span>
          <span className="text-blue-900 dark:text-blue-200">{String(filter.value)}</span>

          <div className="flex items-center space-x-1 ml-1">
            <button
              onClick={() => setInternalEditMode(true)}
              className="text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(`${filter.field}-${filter.operator}-${filter.value}`)}
                className="text-blue-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default EditableChip;