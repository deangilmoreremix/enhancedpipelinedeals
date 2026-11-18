import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Button } from '../../ui/Button';
import {
  CUSTOM_FIELD_TYPES, ROLLUP_METRICS,
  type CustomFieldEntityType, type CustomFieldType, type DealFieldDefinition, type RollupMetric,
} from '../../../types/customFields';
import { errMsg, type FieldDefinitionInput } from '../../../services/customFieldService';
import { BUILTIN_FORMULA_FIELDS, FORMULA_FUNCTIONS, formulaRefs } from '../../../utils/formula';
import { ROLLUP_METRIC_LABELS } from '../../../services/companyRollupService';

export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text', number: 'Number', select: 'Select', multi_select: 'Multi-select', rating: 'Rating',
  link: 'Link', email: 'Email', phone: 'Phone', date: 'Date', formula: 'Formula', rollup: 'Rollup',
};

export const INPUT = 'w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
export const hasOptions = (t: CustomFieldType) => t === 'select' || t === 'multi_select';
export const parseOptions = (s: string) => s.split(/[\n,]/).map(o => o.trim()).filter(Boolean);

/** Types offered when adding a field to this entity (rollups only exist on companies). */
export const typesForEntity = (et: CustomFieldEntityType): CustomFieldType[] =>
  CUSTOM_FIELD_TYPES.filter(t => t !== 'rollup' || et === 'company');

export interface FieldFormProps {
  mode: 'add' | 'edit';
  entityType: CustomFieldEntityType;
  /** edit mode: the definition being edited (its type is fixed). */
  definition?: DealFieldDefinition;
  disabled?: boolean;
  busy?: boolean;
  /** Resolve true when saved (the add form then resets). */
  onSubmit: (input: FieldDefinitionInput) => Promise<boolean> | boolean;
  onCancel?: () => void;
  /** Other definitions of the entity (the formula hint lists their keys). */
  siblings?: DealFieldDefinition[];
}

/** Add / edit form for one custom field definition: label, type, group, select options, formula or rollup metric. */
export const FieldForm: React.FC<FieldFormProps> = ({ mode, entityType, definition, disabled, busy, onSubmit, onCancel, siblings = [] }) => {
  const edit = mode === 'edit';
  const [label, setLabel] = useState(definition?.label ?? '');
  const [type, setType] = useState<CustomFieldType>(definition?.type ?? 'text');
  const [group, setGroup] = useState(definition?.groupName ?? '');
  const [options, setOptions] = useState((definition?.options ?? []).join('\n'));
  const [formula, setFormula] = useState(definition?.config?.formula ?? '');
  const [metric, setMetric] = useState<RollupMetric>(definition?.config?.metric ?? 'open_deal_value');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!definition) return;
    setLabel(definition.label); setType(definition.type); setGroup(definition.groupName ?? '');
    setOptions(definition.options.join('\n')); setFormula(definition.config?.formula ?? ''); setMetric(definition.config?.metric ?? 'open_deal_value');
  }, [definition]);

  const L = (add: string, ed: string) => (edit ? ed : add);
  const formulaProblem = useMemo(() => {
    if (type !== 'formula' || !formula.trim()) return null;
    try { formulaRefs(formula); return null; } catch (e) { return errMsg(e); }
  }, [type, formula]);
  const available = useMemo(
    () => [...BUILTIN_FORMULA_FIELDS[entityType], ...siblings.filter(d => d.id !== definition?.id && d.isActive).map(d => d.key)],
    [entityType, siblings, definition],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!label.trim()) { setError('Enter a field name'); return; }
    if (hasOptions(type) && parseOptions(options).length === 0) { setError('Add at least one option'); return; }
    if (type === 'formula') {
      if (!formula.trim()) { setError('Enter a formula'); return; }
      if (formulaProblem) { setError(`Invalid formula: ${formulaProblem}`); return; }
    }
    const ok = await onSubmit({
      label, type, groupName: group || null, options: parseOptions(options),
      config: type === 'formula' ? { formula } : type === 'rollup' ? { metric } : undefined,
    });
    if (ok && !edit) { setLabel(''); setOptions(''); setGroup(''); setType('text'); setFormula(''); }
  };

  return (
    <form onSubmit={e => void submit(e)} className={edit ? 'space-y-2' : 'space-y-2 rounded-xl border border-dashed border-gray-300 p-3 dark:border-gray-600'}>
      {!edit && <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add a field</h3>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input aria-label={L('New field name', 'Field name')} className={INPUT} placeholder="Field name" value={label} onChange={e => setLabel(e.target.value)} disabled={disabled} />
        {edit ? (
          <p className="self-center text-xs text-gray-500 dark:text-gray-400">{FIELD_TYPE_LABELS[type]} (type cannot change) - key <code>{definition?.key}</code></p>
        ) : (
          <select aria-label="Field type" className={INPUT} value={type} onChange={e => setType(e.target.value as CustomFieldType)} disabled={disabled}>
            {typesForEntity(entityType).map(t => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
          </select>
        )}
      </div>
      <input aria-label={L('New field group', 'Group')} className={INPUT} placeholder="Group (optional)" value={group} onChange={e => setGroup(e.target.value)} disabled={disabled} />
      {hasOptions(type) && (
        <textarea aria-label={L('New field options', 'Options')} rows={3} className={INPUT} placeholder="One option per line" value={options} onChange={e => setOptions(e.target.value)} disabled={disabled} />
      )}
      {type === 'formula' && (
        <div className="space-y-1">
          <textarea aria-label="Formula" rows={2} className={`${INPUT} font-mono`} placeholder="{value} * {probability} / 100" value={formula} onChange={e => setFormula(e.target.value)} disabled={disabled} spellCheck={false} />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Use <code>{'{field}'}</code> references, + - * / %, comparisons and {FORMULA_FUNCTIONS.join(', ')}. Fields: {available.map(k => `{${k}}`).join(' ')}
          </p>
          {formulaProblem && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">{formulaProblem}</p>}
        </div>
      )}
      {type === 'rollup' && (
        <label className="block text-xs text-gray-600 dark:text-gray-300">Metric
          <select aria-label="Rollup metric" className={`${INPUT} mt-1`} value={metric} onChange={e => setMetric(e.target.value as RollupMetric)} disabled={disabled}>
            {ROLLUP_METRICS.map(m => <option key={m} value={m}>{ROLLUP_METRIC_LABELS[m]}</option>)}
          </select>
        </label>
      )}
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        {edit && <Button type="button" size="sm" variant="ghost" onClick={onCancel}><X className="mr-1 h-4 w-4" />Cancel</Button>}
        <Button type="submit" size="sm" disabled={disabled || busy}>
          {edit ? <><Check className="mr-1 h-4 w-4" />Save</> : <><Plus className="mr-1 h-4 w-4" />Add field</>}
        </Button>
      </div>
    </form>
  );
};

export default FieldForm;
