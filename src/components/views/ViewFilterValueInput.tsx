import React, { useState, useRef, useEffect } from 'react';
import { Filter, Calendar, Hash, Type as TypeIcon, Select as SelectIcon } from 'lucide-react';

interface ViewFilterValueInputProps {
  field: string;
  operator: string;
  value: string | number | Date | null;
  onChange: (value: string | number | Date) => void;
  fieldType?: 'text' | 'number' | 'select' | 'date' | 'multi-select';
  options?: Array<{ id: string; label: string; value: string | number }>;
  placeholder?: string;
  disabled?: boolean;
}

const FIELD_TYPES: Record<string, 'text' | 'number' | 'select' | 'date' | 'multi-select'> = {
  value: 'number',
  probability: 'number',
  stage: 'select',
  priority: 'select',
  created_at: 'date',
  close_date: 'date',
  owner: 'select',
  company: 'text',
  title: 'text',
  tags: 'multi-select'
};

const OPERATOR_LABELS: Record<string, string> = {
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  eq: '=',
  equals: 'is',
  not_equals: 'is not',
  contains: 'contains',
  starts_with: 'starts with',
  ends_with: 'ends with',
  before: 'before',
  after: 'after',
  on: 'on'
};

export const ViewFilterValueInput: React.FC<ViewFilterValueInputProps> = ({
  field,
  operator,
  value,
  onChange,
  fieldType,
  options,
  placeholder,
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState<string>(
    value instanceof Date
      ? value.toISOString().split('T')[0]
      : String(value || '')
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [field, operator, disabled]);

  const actualType = fieldType || FIELD_TYPES[field] || 'text';

  const handleInputChange = (newValue: string | number | Date) => {
    setInputValue(
      newValue instanceof Date
        ? newValue.toISOString().split('T')[0]
        : String(newValue)
    );
    onChange(newValue);
  };

  const renderIcon = () => {
    switch (actualType) {
      case 'number':
        return <Hash className="w-4 h-4 text-gray-400" />;
      case 'date':
        return <Calendar className="w-4 h-4 text-gray-400" />;
      case 'select':
      case 'multi-select':
        return <SelectIcon className="w-4 h-4 text-gray-400" />;
      default:
        return <TypeIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  const renderInput = () => {
    switch (actualType) {
      case 'number':
        return (
          <div className="relative">
            {renderIcon()}
            <input
              ref={inputRef}
              type="number"
              value={inputValue}
              onChange={(e) => handleInputChange(Number(e.target.value))}
              disabled={disabled}
              placeholder={placeholder || 'Enter number'}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
        );

      case 'date':
        return (
          <div className="relative">
            {renderIcon()}
            <input
              ref={inputRef}
              type="date"
              value={inputValue}
              onChange={(e) => handleInputChange(new Date(e.target.value))}
              disabled={disabled}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
        );

      case 'select':
        return (
          <div className="relative">
            {renderIcon()}
            <select
              ref={selectRef}
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={disabled}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 appearance-none"
            >
              <option value="">{placeholder || 'Select value'}</option>
              {options?.map(opt => (
                <option key={opt.id} value={opt.value}>{opt.label}</option>
              ))}
              {actualType === 'select' && field === 'stage' && (
                <>
                  <option value="qualification">Qualification</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="closed-won">Closed Won</option>
                  <option value="closed-lost">Closed Lost</option>
                </>
              )}
              {actualType === 'select' && field === 'priority' && (
                <>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </>
              )}
            </select>
          </div>
        );

      case 'multi-select':
        return (
          <div className="relative">
            {renderIcon()}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={disabled}
              placeholder={placeholder || 'Type and press Enter to add tags'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  handleInputChange(inputValue.trim());
                }
              }}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
        );

      default:
        return (
          <div className="relative">
            {renderIcon()}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={disabled}
              placeholder={placeholder || 'Enter value'}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center space-x-2 text-sm">
        <span className="text-gray-600 dark:text-gray-400 font-medium">
          {OPERATOR_LABELS[operator] || operator}
        </span>
        <div className="flex-1">
          {renderInput()}
        </div>
      </div>
    </div>
  );
};

export default ViewFilterValueInput;