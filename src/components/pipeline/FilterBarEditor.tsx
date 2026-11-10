import React, { useState } from 'react';
import type { PipelineStage, ViewFilter } from '../../types';
import { Button } from '../ui/Button';
import { FilterBarValueInput } from './FilterBarValueInput';
import {
  BOARD_FILTER_FIELDS,
  DraftValue,
  defaultDraft,
  draftFromFilter,
  fieldDef,
  filterFromDraft,
  isDraftValid,
  operatorsForKind
} from './filterFieldConfig';

interface Props {
  stages: PipelineStage[];
  /** Existing filter to edit; omit when adding. */
  initial?: ViewFilter;
  /** Preselected field when adding. */
  initialField?: string;
  onSave: (filter: ViewFilter) => void;
  onCancel: () => void;
}

const SELECT_CLASS =
  'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent';

/** Popover body for adding/editing a single filter condition. */
export const FilterBarEditor: React.FC<Props> = ({ stages, initial, initialField, onSave, onCancel }) => {
  const start = initial ? draftFromFilter(initial) : null;
  const [field, setField] = useState(initial?.field ?? initialField ?? BOARD_FILTER_FIELDS[0].id);
  const kind = fieldDef(field).kind;
  const [opKey, setOpKey] = useState(start?.opKey ?? operatorsForKind(kind)[0].id);
  const [draft, setDraft] = useState<DraftValue>(start?.draft ?? defaultDraft(kind, opKey));

  const changeField = (next: string) => {
    const nextKind = fieldDef(next).kind;
    const nextOp = operatorsForKind(nextKind)[0].id;
    setField(next);
    setOpKey(nextOp);
    setDraft(defaultDraft(nextKind, nextOp));
  };
  const changeOp = (next: string) => {
    setOpKey(next);
    setDraft(defaultDraft(kind, next));
  };

  const valid = isDraftValid(kind, opKey, draft);
  const submit = () => { if (valid) onSave(filterFromDraft(field, opKey, draft)); };

  return (
    <div
      className="w-72 p-3 space-y-3"
      role="dialog"
      aria-label={initial ? 'Edit filter' : 'Add filter'}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'SELECT') { e.preventDefault(); submit(); }
      }}
    >
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
        Field
        <select value={field} onChange={(e) => changeField(e.target.value)} className={`${SELECT_CLASS} mt-1`}>
          {BOARD_FILTER_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </label>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
        Condition
        <select value={opKey} onChange={(e) => changeOp(e.target.value)} className={`${SELECT_CLASS} mt-1`}>
          {operatorsForKind(kind).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <div>
        <FilterBarValueInput key={`${field}:${opKey}`} field={field} kind={kind} opKey={opKey} value={draft} onChange={setDraft} stages={stages} />
      </div>
      <div className="flex justify-end space-x-2">
        <Button variant="ghost" size="sm" type="button" onClick={onCancel}>Cancel</Button>
        <Button size="sm" type="button" onClick={submit} disabled={!valid}>{initial ? 'Update' : 'Add filter'}</Button>
      </div>
    </div>
  );
};

export default FilterBarEditor;
