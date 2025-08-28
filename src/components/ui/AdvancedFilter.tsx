import React, { useState } from 'react';
import { Filter, X, Plus, Check } from 'lucide-react';

interface FilterCondition {
  field: string;
  operator: string;
  value: string | number;
}

interface AdvancedFilterProps {
  onApplyFilters: (filters: FilterCondition[]) => void;
  onClearFilters: () => void;
}

export const AdvancedFilter: React.FC<AdvancedFilterProps> = ({ 
  onApplyFilters, 
  onClearFilters 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [newFilter, setNewFilter] = useState<FilterCondition>({
    field: 'value',
    operator: 'gt',
    value: '',
  });

  const filterFields = [
    { id: 'value', label: 'Value' },
    { id: 'probability', label: 'Probability' },
    { id: 'stage', label: 'Stage' },
    { id: 'priority', label: 'Priority' },
  ];

  const operatorOptions: Record<string, { id: string; label: string }[]> = {
    value: [
      { id: 'gt', label: '>' },
      { id: 'lt', label: '<' },
      { id: 'eq', label: '=' },
      { id: 'gte', label: '>=' },
      { id: 'lte', label: '<=' },
    ],
    probability: [
      { id: 'gt', label: '>' },
      { id: 'lt', label: '<' },
      { id: 'eq', label: '=' },
      { id: 'gte', label: '>=' },
      { id: 'lte', label: '<=' },
    ],
    stage: [
      { id: 'equals', label: 'Is' },
      { id: 'not_equals', label: 'Is Not' },
    ],
    priority: [
      { id: 'equals', label: 'Is' },
      { id: 'not_equals', label: 'Is Not' },
    ],
  };

  const valueOptions: Record<string, { id: string; label: string }[]> = {
    stage: [
      { id: 'qualification', label: 'Qualification' },
      { id: 'proposal', label: 'Proposal' },
      { id: 'negotiation', label: 'Negotiation' },
      { id: 'closed-won', label: 'Closed Won' },
      { id: 'closed-lost', label: 'Closed Lost' },
    ],
    priority: [
      { id: 'high', label: 'High' },
      { id: 'medium', label: 'Medium' },
      { id: 'low', label: 'Low' },
    ],
  };

  const handleAddFilter = () => {
    if (!newFilter.value && typeof newFilter.value !== 'number') return;
    
    setFilters([...filters, newFilter]);
    setNewFilter({
      field: 'value',
      operator: 'gt',
      value: '',
    });
  };

  const handleRemoveFilter = (index: number) => {
    const updatedFilters = [...filters];
    updatedFilters.splice(index, 1);
    setFilters(updatedFilters);
  };

  const handleApply = () => {
    onApplyFilters(filters);
    setIsOpen(false);
  };

  const handleClear = () => {
    setFilters([]);
    onClearFilters();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
          filters.length > 0 
            ? 'bg-blue-600 text-white border-blue-600' 
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        <Filter className="w-4 h-4" />
        <span>Filter{filters.length > 0 ? ` (${filters.length})` : ''}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-30">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Filters</h3>

            {/* Applied Filters */}
            {filters.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Applied Filters</h4>
                <div className="space-y-2">
                  {filters.map((filter, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                      <span className="text-sm">
                        {filterFields.find(f => f.id === filter.field)?.label} {' '}
                        {operatorOptions[filter.field as keyof typeof operatorOptions]?.find(o => o.id === filter.operator)?.label} {' '}
                        {filter.value}
                      </span>
                      <button 
                        onClick={() => handleRemoveFilter(index)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Filter */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Add Filter</h4>
              
              <div className="flex space-x-2">
                <select
                  className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  value={newFilter.field}
                  onChange={(e) => setNewFilter({ ...newFilter, field: e.target.value })}
                >
                  {filterFields.map(field => (
                    <option key={field.id} value={field.id}>{field.label}</option>
                  ))}
                </select>
                
                <select
                  className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  value={newFilter.operator}
                  onChange={(e) => setNewFilter({ ...newFilter, operator: e.target.value })}
                >
                  {operatorOptions[newFilter.field as keyof typeof operatorOptions]?.map(op => (
                    <option key={op.id} value={op.id}>{op.label}</option>
                  ))}
                </select>
                
                {valueOptions[newFilter.field as keyof typeof valueOptions] ? (
                  <select
                    className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    value={newFilter.value.toString()}
                    onChange={(e) => setNewFilter({ ...newFilter, value: e.target.value })}
                  >
                    {valueOptions[newFilter.field as keyof typeof valueOptions].map(val => (
                      <option key={val.id} value={val.id}>{val.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={newFilter.field === 'value' || newFilter.field === 'probability' ? 'number' : 'text'}
                    className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Value"
                    value={newFilter.value.toString()}
                    onChange={(e) => setNewFilter({ 
                      ...newFilter, 
                      value: newFilter.field === 'value' || newFilter.field === 'probability' 
                        ? Number(e.target.value) 
                        : e.target.value 
                    })}
                  />
                )}
                
                <button
                  onClick={handleAddFilter}
                  className="p-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  title="Add filter"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={handleClear}
                className="px-3 py-1 text-gray-600 hover:text-gray-800 transition-colors"
                disabled={filters.length === 0}
              >
                Clear All
              </button>
              <div className="space-x-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  disabled={filters.length === 0}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedFilter;