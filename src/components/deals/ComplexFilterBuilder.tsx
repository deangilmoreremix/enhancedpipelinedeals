import React, { useState } from 'react';
import { AdvancedFilterGroup, PipelineStage } from '../../types';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { FilterBarValueInput } from '../pipeline/FilterBarValueInput';
import {
  BOARD_FILTER_FIELDS,
  DraftValue,
  defaultDraft,
  draftFromFilter,
  fieldDef,
  filterFromDraft,
  isDraftValid,
  operatorsForKind
} from '../pipeline/filterFieldConfig';

interface ComplexFilterBuilderProps {
  /** Receives AND/OR groups of ViewFilter conditions (groups are ANDed together). */
  onApplyFilters: (groups: AdvancedFilterGroup[]) => void;
  onClearFilters: () => void;
  /** Restrict the selectable fields to these ids (defaults to every board field). */
  availableFields?: string[];
  /** Groups to start from (editing existing advanced filters). */
  initialGroups?: AdvancedFilterGroup[];
  /** Pipeline stages (labels for the stage field). */
  stages?: PipelineStage[];
}

interface Row {
  id: string;
  field: string;
  opKey: string;
  draft: DraftValue;
}
interface DraftGroup {
  id: string;
  name: string;
  logicalOperator: 'AND' | 'OR';
  rows: Row[];
}

const uid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const SELECT_CLASS =
  'px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

const newRow = (field: string): Row => {
  const kind = fieldDef(field).kind;
  const opKey = operatorsForKind(kind)[0].id;
  return { id: uid('c'), field, opKey, draft: defaultDraft(kind, opKey) };
};

const toDraftGroups = (groups: AdvancedFilterGroup[] | undefined, fallbackField: string): DraftGroup[] => {
  if (!groups || groups.length === 0) {
    return [{ id: uid('g'), name: 'Group 1', logicalOperator: 'AND', rows: [newRow(fallbackField)] }];
  }
  return groups.map(g => ({
    id: g.id || uid('g'),
    name: g.name,
    logicalOperator: g.logicalOperator,
    rows: g.filters.map(f => ({ id: uid('c'), field: f.field, ...draftFromFilter(f) }))
  }));
};

export const ComplexFilterBuilder: React.FC<ComplexFilterBuilderProps> = ({
  onApplyFilters,
  onClearFilters,
  availableFields,
  initialGroups,
  stages = []
}) => {
  const fields = BOARD_FILTER_FIELDS.filter(f => !availableFields || availableFields.includes(f.id));
  const firstField = (fields[0] ?? BOARD_FILTER_FIELDS[0]).id;
  const [groups, setGroups] = useState<DraftGroup[]>(() => toDraftGroups(initialGroups, firstField));

  const patchGroup = (id: string, patch: Partial<DraftGroup>) =>
    setGroups(gs => gs.map(g => (g.id === id ? { ...g, ...patch } : g)));
  const patchRow = (gid: string, rid: string, patch: Partial<Row>) =>
    setGroups(gs => gs.map(g => (g.id === gid ? { ...g, rows: g.rows.map(r => (r.id === rid ? { ...r, ...patch } : r)) } : g)));

  const apply = () => {
    const result: AdvancedFilterGroup[] = groups
      .map(g => ({
        id: g.id,
        name: g.name,
        logicalOperator: g.logicalOperator,
        isActive: true,
        createdBy: 'user',
        createdAt: new Date(),
        filters: g.rows
          .filter(r => isDraftValid(fieldDef(r.field).kind, r.opKey, r.draft))
          .map(r => filterFromDraft(r.field, r.opKey, r.draft))
      }))
      .filter(g => g.filters.length > 0);
    onApplyFilters(result);
  };

  const incomplete = groups.some(g => g.rows.some(r => !isDraftValid(fieldDef(r.field).kind, r.opKey, r.draft)));

  return (
    <div className="space-y-4" data-testid="complex-filter-builder">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        A deal must match <strong>every group</strong>. Inside a group, combine conditions with AND or OR.
      </p>

      {groups.map((group, gi) => (
        <fieldset key={group.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
          <legend className="sr-only">{group.name}</legend>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-200">
              <span className="font-medium">Group {gi + 1}</span>
              <span>match</span>
              <select
                aria-label={`Group ${gi + 1} logic`}
                value={group.logicalOperator}
                onChange={(e) => patchGroup(group.id, { logicalOperator: e.target.value as 'AND' | 'OR' })}
                className={SELECT_CLASS}
              >
                <option value="AND">all (AND)</option>
                <option value="OR">any (OR)</option>
              </select>
              <span>of:</span>
            </div>
            {groups.length > 1 && (
              <button
                type="button"
                onClick={() => setGroups(gs => gs.filter(g => g.id !== group.id))}
                className="text-xs text-gray-500 hover:text-red-600"
              >
                Remove group
              </button>
            )}
          </div>

          {group.rows.map((row, ri) => {
            const kind = fieldDef(row.field).kind;
            return (
              <div key={row.id} className="flex flex-wrap items-start gap-2 p-2 bg-gray-50 dark:bg-gray-900/40 rounded-md">
                <select
                  aria-label={`Group ${gi + 1} condition ${ri + 1} field`}
                  value={row.field}
                  onChange={(e) => {
                    const k = fieldDef(e.target.value).kind;
                    const o = operatorsForKind(k)[0].id;
                    patchRow(group.id, row.id, { field: e.target.value, opKey: o, draft: defaultDraft(k, o) });
                  }}
                  className={SELECT_CLASS}
                >
                  {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <select
                  aria-label={`Group ${gi + 1} condition ${ri + 1} operator`}
                  value={row.opKey}
                  onChange={(e) => patchRow(group.id, row.id, { opKey: e.target.value, draft: defaultDraft(kind, e.target.value) })}
                  className={SELECT_CLASS}
                >
                  {operatorsForKind(kind).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <div className="flex-1 min-w-[10rem]">
                  <FilterBarValueInput
                    key={`${row.field}:${row.opKey}`}
                    field={row.field}
                    kind={kind}
                    opKey={row.opKey}
                    value={row.draft}
                    stages={stages}
                    ariaLabel={`Group ${gi + 1} condition ${ri + 1} value`}
                    onChange={(v) => patchRow(group.id, row.id, { draft: v })}
                  />
                </div>
                <button
                  type="button"
                  aria-label="Remove condition"
                  onClick={() => patchGroup(group.id, { rows: group.rows.filter(r => r.id !== row.id) })}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => patchGroup(group.id, { rows: [...group.rows, newRow(firstField)] })}
            className="inline-flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add condition</span>
          </button>
        </fieldset>
      ))}

      <button
        type="button"
        onClick={() => setGroups(gs => [...gs, { id: uid('g'), name: `Group ${gs.length + 1}`, logicalOperator: 'AND', rows: [newRow(firstField)] }])}
        className="inline-flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add group</span>
      </button>

      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-amber-600 dark:text-amber-400" role="status">
          {incomplete ? 'Incomplete conditions are ignored.' : ''}
        </span>
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" type="button" onClick={onClearFilters}>Clear</Button>
          <Button size="sm" type="button" onClick={apply}>Apply filters</Button>
        </div>
      </div>
    </div>
  );
};

export default ComplexFilterBuilder;
