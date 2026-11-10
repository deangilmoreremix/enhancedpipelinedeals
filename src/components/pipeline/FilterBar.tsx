import React, { useEffect, useRef, useState } from 'react';
import { Filter, Plus, SlidersHorizontal } from 'lucide-react';
import type { AdvancedFilterGroup, PipelineStage } from '../../types';
import { useBoardViewStore } from '../../store/boardViewStore';
import { FilterChip } from '../views/FilterChip';
import { Modal } from '../ui/Modal';
import ComplexFilterBuilder from '../deals/ComplexFilterBuilder';
import { FilterBarEditor } from './FilterBarEditor';
import { describeFilter } from './filterFieldConfig';

interface FilterBarProps {
  stages: PipelineStage[];
  /** Deals matching all active filters / search. */
  matchCount: number;
  /** All deals on the board before filtering. */
  totalCount: number;
}

type Popover = { mode: 'add' } | { mode: 'edit'; index: number } | null;

const groupConditionCount = (groups: AdvancedFilterGroup[]) => groups.reduce((n, g) => n + g.filters.length, 0);

/** Filter chips + "Add filter" + "Advanced" (AND/OR groups) for the board. Reads/writes useBoardViewStore. */
export const FilterBar: React.FC<FilterBarProps> = ({ stages, matchCount, totalCount }) => {
  const filters = useBoardViewStore(s => s.filters);
  const groups = useBoardViewStore(s => s.groups);
  const search = useBoardViewStore(s => s.search);
  const favoritesOnly = useBoardViewStore(s => s.favoritesOnly);
  const addFilter = useBoardViewStore(s => s.addFilter);
  const updateFilter = useBoardViewStore(s => s.updateFilter);
  const removeFilter = useBoardViewStore(s => s.removeFilter);
  const setGroups = useBoardViewStore(s => s.setGroups);
  const clearFilters = useBoardViewStore(s => s.clearFilters);

  const [popover, setPopover] = useState<Popover>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the popover on outside click
  useEffect(() => {
    if (!popover) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPopover(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [popover]);

  const activeCount = filters.length + groupConditionCount(groups) + (favoritesOnly ? 1 : 0) + (search.trim() ? 1 : 0);
  const hasAnything = activeCount > 0;
  const editing = popover?.mode === 'edit' ? filters[popover.index] : undefined;

  return (
    <div className="mb-4" data-testid="filter-bar">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center space-x-1 text-xs font-medium text-gray-500 dark:text-gray-400">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters</span>
          {activeCount > 0 && (
            <span
              className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px]"
              aria-label={`${activeCount} active filter${activeCount === 1 ? '' : 's'}`}
              data-testid="filter-count"
            >
              {activeCount}
            </span>
          )}
        </span>

        {filters.map((f, i) => {
          const labels = describeFilter(f, stages);
          return (
            <FilterChip
              key={`${f.field}-${f.operator}-${i}`}
              filter={{ field: f.field, operator: f.operator, value: labels.value }}
              labels={labels}
              onRemove={() => removeFilter(i)}
              onActivate={() => setPopover({ mode: 'edit', index: i })}
            />
          );
        })}

        {groups.length > 0 && (
          <FilterChip
            filter={{ field: 'advanced', operator: '', value: '' }}
            labels={{
              field: 'Advanced',
              operator: '',
              value: `${groups.length} group${groups.length === 1 ? '' : 's'}, ${groupConditionCount(groups)} condition${groupConditionCount(groups) === 1 ? '' : 's'}`
            }}
            onRemove={() => setGroups([])}
            onActivate={() => setAdvancedOpen(true)}
          />
        )}

        <div className="relative" ref={wrapRef}>
          <button
            type="button"
            onClick={() => setPopover(p => (p?.mode === 'add' ? null : { mode: 'add' }))}
            aria-haspopup="dialog"
            aria-expanded={popover?.mode === 'add'}
            className="inline-flex items-center space-x-1 px-3 py-1 text-sm rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add filter</span>
          </button>
          {popover && (
            <div className="absolute left-0 top-full mt-1 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
              <FilterBarEditor
                key={popover.mode === 'edit' ? `edit-${popover.index}` : 'add'}
                stages={stages}
                initial={editing}
                onCancel={() => setPopover(null)}
                onSave={(f) => {
                  if (popover.mode === 'edit') updateFilter(popover.index, f);
                  else addFilter(f);
                  setPopover(null);
                }}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen(true)}
          className="inline-flex items-center space-x-1 px-3 py-1 text-sm rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Advanced</span>
        </button>

        {hasAnything && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 underline"
          >
            Clear all
          </button>
        )}

        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400" role="status" aria-live="polite" data-testid="filter-result-count">
          {hasAnything ? `${matchCount} of ${totalCount} deals` : `${totalCount} deals`}
        </span>
      </div>

      <Modal isOpen={advancedOpen} onClose={() => setAdvancedOpen(false)} title="Advanced filters" className="max-w-3xl">
        <ComplexFilterBuilder
          stages={stages}
          initialGroups={groups}
          onApplyFilters={(g) => { setGroups(g); setAdvancedOpen(false); }}
          onClearFilters={() => { setGroups([]); setAdvancedOpen(false); }}
        />
      </Modal>
    </div>
  );
};

export default FilterBar;
