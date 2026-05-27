import React, { useState } from 'react';
import { ViewFilter, AdvancedFilterGroup } from '../../types';
import { Filter, X, Plus, Copy, Group } from 'lucide-react';

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string | number;
}

interface ComplexFilterBuilderProps {
  onApplyFilters: (groups: AdvancedFilterGroup[]) => void;
  onClearFilters: () => void;
  availableFields?: string[];
}

interface FilterGroupProps {
  group: AdvancedFilterGroup;
  onGroupChange: (updatedGroup: AdvancedFilterGroup) => void;
  onRemoveGroup: (groupId: string) => void;
}

const filterFields = [
  { id: 'value', label: 'Value' },
  { id: 'probability', label: 'Probability' },
  { id: 'stage', label: 'Stage' },
  { id: 'priority', label: 'Priority' },
  { id: 'company', label: 'Company' },
  { id: 'contact', label: 'Contact' },
  { id: 'createdAt', label: 'Created Date' },
  { id: 'updatedAt', label: 'Updated Date' }
];

const operatorOptions: Record<string, { id: string; label: string }[]> = {
  value: [
    { id: 'gt', label: '>' },
    { id: 'lt', label: '<' },
    { id: 'eq', label: '=' },
    { id: 'gte', label: '>=' },
    { id: 'lte', label: '<=' },
    { id: 'between', label: 'Between' }
  ],
  probability: [
    { id: 'gt', label: '>' },
    { id: 'lt', label: '<' },
    { id: 'eq', label: '=' },
    { id: 'gte', label: '>=' },
    { id: 'lte', label: '<=' }
  ],
  stage: [
    { id: 'equals', label: 'Is' },
    { id: 'not_equals', label: 'Is Not' },
    { id: 'in', label: 'Is One Of' }
  ],
  priority: [
    { id: 'equals', label: 'Is' },
    { id: 'not_equals', label: 'Is Not' }
  ],
  company: [
    { id: 'contains', label: 'Contains' },
    { id: 'equals', label: 'Is' },
    { id: 'not_contains', label: 'Does Not Contain' }
  ],
  contact: [
    { id: 'contains', label: 'Contains' },
    { id: 'equals', label: 'Is' }
  ],
  createdAt: [
    { id: 'after', label: 'After' },
    { id: 'before', label: 'Before' },
    { id: 'on', label: 'On' }
  ],
  updatedAt: [
    { id: 'after', label: 'After' },
    { id: 'before', label: 'Before' },
    { id: 'on', label: 'On' }
  ]
};

const valueOptions: Record<string, { id: string; label: string }[]> = {
  stage: [
    { id: 'qualification', label: 'Qualification' },
    { id: 'proposal', label: 'Proposal' },
    { id: 'negotiation', label: 'Negotiation' },
    { id: 'closed-won', label: 'Closed Won' },
    { id: 'closed-lost', label: 'Closed Lost' }
  ],
  priority: [
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' }
  ]
};

const generateId = () => `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const FilterRow: React.FC<{
  filter: FilterCondition;
  onFilterChange: (filter: FilterCondition) => void;
  onRemove: (id: string) => void;
}> = ({ filter, onFilterChange, onRemove }) => {
  return (
    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
      <select
        className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        value={filter.field}
        onChange={(e) => onFilterChange({ ...filter, field: e.target.value, operator: operatorOptions[e.target.value][0]?.id || 'eq' })}
      >
        {filterFields.map(field => (
          <option key={field.id} value={field.id}>{field.label}</option>
        ))}
      </select>

      <select
        className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        value={filter.operator}
        onChange={(e) => onFilterChange({ ...filter, operator: e.target.value })}
      >
        {operatorOptions[filter.field as keyof typeof operatorOptions]?.map(op => (
          <option key={op.id} value={op.id}>{op.label}</option>
        ))}
      </select>

      {valueOptions[filter.field as keyof typeof valueOptions] ? (
        <select
          className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          value={filter.value.toString()}
          onChange={(e) => onFilterChange({ ...filter, value: e.target.value })}
        >
          {valueOptions[filter.field as keyof typeof valueOptions].map(val => (
            <option key={val.id} value={val.id}>{val.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={filter.field === 'value' || filter.field === 'probability' ? 'number' : 'text'}
          className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Value"
          value={filter.value.toString()}
          onChange={(e) => onFilterChange({
            ...filter,
            value: filter.field === 'value' || filter.field === 'probability'
              ? Number(e.target.value)
              : e.target.value
          })}
        />
      )}

      <button
        onClick={() => onRemove(filter.id)}
        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
        title="Remove filter"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const FilterGroupComponent: React.FC<FilterGroupProps> = ({ group, onGroupChange, onRemoveGroup }) => {
  const handleAddFilter = () => {
    const newFilter: FilterCondition = {
      id: generateId(),
      field: 'value',
      operator: 'gt',
      value: ''
    };
    const viewFilter: ViewFilter = {
      field: newFilter.field,
      operator: newFilter.operator as ViewFilter['operator'],
      value: newFilter.value
    };
    onGroupChange({
      ...group,
      filters: [...group.filters, viewFilter]
    });
  };

  const handleFilterChange = (updatedFilter: FilterCondition) => {
    const viewFilter: ViewFilter = {
      field: updatedFilter.field,
      operator: updatedFilter.operator as ViewFilter['operator'],
      value: updatedFilter.value
    };
    const updatedFilters = group.filters.map(f =>
      f.field === updatedFilter.field ? viewFilter : f
    );
    onGroupChange({ ...group, filters: updatedFilters });
  };

  const handleRemoveFilter = (filterId: string) => {
    const updatedFilters = group.filters.filter(f => f.field !== filterId);
    onGroupChange({ ...group, filters: updatedFilters });
  };

  const handleLogicalOperatorChange = (operator: 'AND' | 'OR') => {
    onGroupChange({ ...group, logicalOperator: operator });
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <Group className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Group name"
            value={group.name}
            onChange={(e) => onGroupChange({ ...group, name: e.target.value })}
            className="text-sm font-medium border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={group.logicalOperator}
            onChange={(e) => handleLogicalOperatorChange(e.target.value as 'AND' | 'OR')}
            className="text-xs border border-gray-300 rounded px-2 py-1"
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        </div>
        <button
          onClick={() => onRemoveGroup(group.id)}
          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
          title="Remove group"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 mb-3">
        {group.filters.map((filter, index) => (
          <FilterRow
            key={`${filter.field}-${index}`}
            filter={{ ...filter, id: `${filter.field}-${index}` } as FilterCondition}
            onFilterChange={handleFilterChange}
            onRemove={handleRemoveFilter}
          />
        ))}
      </div>

      <button
        onClick={handleAddFilter}
        className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
      >
        <Plus className="w-3 h-3" />
        <span>Add Condition</span>
      </button>
    </div>
  );
};

const ComplexFilterBuilder: React.FC<ComplexFilterBuilderProps> = ({
  onApplyFilters,
  onClearFilters
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [groups, setGroups] = useState<AdvancedFilterGroup[]>([
    {
      id: generateId(),
      name: 'Group 1',
      filters: [],
      logicalOperator: 'AND',
      isActive: true,
      createdBy: 'current-user',
      createdAt: new Date()
    }
  ]);

  const handleAddGroup = () => {
    const newGroup: AdvancedFilterGroup = {
      id: generateId(),
      name: `Group ${groups.length + 1}`,
      filters: [],
      logicalOperator: 'AND',
      isActive: true,
      createdBy: 'current-user',
      createdAt: new Date()
    };
    setGroups([...groups, newGroup]);
  };

  const handleGroupChange = (updatedGroup: AdvancedFilterGroup) => {
    setGroups(groups.map(g => g.id === updatedGroup.id ? updatedGroup : g));
  };

  const handleRemoveGroup = (groupId: string) => {
    if (groups.length === 1) return;
    setGroups(groups.filter(g => g.id !== groupId));
  };

  const handleApply = () => {
    const activeGroups = groups.filter(g => g.filters.length > 0);
    onApplyFilters(activeGroups);
    setIsOpen(false);
  };

  const handleClear = () => {
    setGroups([{
      id: generateId(),
      name: 'Group 1',
      filters: [],
      logicalOperator: 'AND',
      isActive: true,
      createdBy: 'current-user',
      createdAt: new Date()
    }]);
    onClearFilters();
  };

  const totalFilters = groups.reduce((acc, g) => acc + g.filters.length, 0);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
          totalFilters > 0
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        <Filter className="w-4 h-4" />
        <span>Complex Filter{totalFilters > 0 ? ` (${totalFilters})` : ''}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[500px] bg-white border border-gray-200 rounded-lg shadow-xl z-30 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Complex Filter Builder</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddGroup}
                className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Copy className="w-3 h-3" />
                <span>Add Group</span>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Combine multiple filter conditions using AND/OR logic across groups
          </p>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {groups.map(group => (
              <FilterGroupComponent
                key={group.id}
                group={group}
                onGroupChange={handleGroupChange}
                onRemoveGroup={handleRemoveGroup}
              />
            ))}
          </div>

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={handleClear}
              className="px-3 py-1 text-gray-600 hover:text-gray-800 transition-colors"
              disabled={totalFilters === 0}
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
                disabled={totalFilters === 0}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplexFilterBuilder;