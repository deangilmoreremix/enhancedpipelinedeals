import React, { useMemo, useState } from 'react';
import type { AdvancedFilterGroup, PipelineStage, ViewFilter } from '../../types';
import type { DealFieldDefinition } from '../../types/customFields';
import Modal from '../ui/Modal';
import { BTN, BTN_PRIMARY, CONTROL } from '../ui/buttonStyles';
import ComplexFilterBuilder from '../deals/ComplexFilterBuilder';
import { BOARD_FILTER_FIELDS } from '../pipeline/filterFieldConfig';
import {
  CHART_LABEL, CHART_TYPES, DEFAULT_WIDGET_CONFIG, GROUPS_FOR, GROUP_LABEL, MEASURES, MEASURE_LABEL, OBJECTS, OBJECT_LABEL, RANGES, RANGE_LABEL,
  WidgetConfig, WidgetObject, defaultWidgetTitle, isMonthGroup, numericFieldsFor, validateWidgetConfig,
} from './widgetModel';

interface Props {
  initial?: { title: string; config: WidgetConfig } | null;
  defs: DealFieldDefinition[];
  stages: PipelineStage[];
  onSave: (title: string, config: WidgetConfig) => void;
  onClose: () => void;
}

/** Filterable text fields for the non-deal objects (deals reuse the board filter builder). */
const SIMPLE_FIELDS: Record<Exclude<WidgetObject, 'deals'>, Array<{ id: string; label: string }>> = {
  tasks: [{ id: 'title', label: 'Title' }, { id: 'status', label: 'Status' }],
  contacts: [{ id: 'name', label: 'Name' }, { id: 'company', label: 'Company' }, { id: 'status', label: 'Status' }],
  companies: [{ id: 'name', label: 'Name' }, { id: 'industry', label: 'Industry' }],
};

const groupOf = (filters: ViewFilter[]): AdvancedFilterGroup[] => filters.length
  ? [{ id: 'g1', name: 'Group 1', filters, logicalOperator: 'AND', isActive: true, createdBy: 'user', createdAt: new Date() }]
  : [];

const SimpleFilters: React.FC<{ object: Exclude<WidgetObject, 'deals'>; groups: AdvancedFilterGroup[]; onChange: (g: AdvancedFilterGroup[]) => void }> = ({ object, groups, onChange }) => {
  const fields = SIMPLE_FIELDS[object];
  const filters = groups.flatMap(g => g.filters);
  const [field, setField] = useState(fields[0].id);
  const [value, setValue] = useState('');
  return (
    <div className="space-y-2">
      <ul aria-label="Active filters" className="space-y-1">
        {filters.map((f, i) => (
          <li key={i} className="flex items-center justify-between rounded bg-gray-100 px-2 py-1 text-sm dark:bg-gray-700">
            <span>{fields.find(x => x.id === f.field)?.label ?? f.field} contains “{String(f.value)}”</span>
            <button type="button" aria-label={`Remove filter ${i + 1}`} onClick={() => onChange(groupOf(filters.filter((_, j) => j !== i)))} className="text-gray-500 hover:text-red-600">×</button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <select aria-label="Filter field" value={field} onChange={e => setField(e.target.value)} className={CONTROL}>
          {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <input aria-label="Filter value" value={value} onChange={e => setValue(e.target.value)} placeholder="contains…" className={`${CONTROL} flex-1`} />
        <button type="button" disabled={!value.trim()} className={BTN}
          onClick={() => { onChange(groupOf([...filters, { field, operator: 'contains', value: value.trim() }])); setValue(''); }}>Add filter</button>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700 dark:text-gray-200">{label}</span>{children}</label>
);

export const WidgetEditor: React.FC<Props> = ({ initial, defs, stages, onSave, onClose }) => {
  const [cfg, setCfg] = useState<WidgetConfig>(initial?.config ?? DEFAULT_WIDGET_CONFIG);
  const [title, setTitle] = useState(initial?.title ?? '');
  const fields = useMemo(() => numericFieldsFor(cfg.object, defs), [cfg.object, defs]);
  const verdict = useMemo(() => validateWidgetConfig(cfg, defs), [cfg, defs]);
  const groups = GROUPS_FOR[cfg.object].filter(g => cfg.chart !== 'line' || isMonthGroup(g));

  const patch = (p: Partial<WidgetConfig>) => setCfg(c => ({ ...c, ...p }));
  const setObject = (object: WidgetObject) => {
    const f = numericFieldsFor(object, defs);
    setCfg(c => ({
      ...c, object, filterGroups: [], field: c.measure === 'count' ? undefined : f[0]?.id,
      measure: c.measure !== 'count' && f.length === 0 ? 'count' : c.measure,
      groupBy: c.chart === 'number' ? 'none' : GROUPS_FOR[object][0],
    }));
  };
  const setChart = (chart: WidgetConfig['chart']) => setCfg(c => ({
    ...c, chart,
    groupBy: chart === 'number' ? 'none' : chart === 'line' ? (isMonthGroup(c.groupBy) ? c.groupBy : 'created_month')
      : c.groupBy === 'none' || !GROUPS_FOR[c.object].includes(c.groupBy) ? GROUPS_FOR[c.object][0] : c.groupBy,
  }));
  const setMeasure = (measure: WidgetConfig['measure']) => patch({ measure, field: measure === 'count' ? undefined : cfg.field ?? fields[0]?.id });

  const save = () => { if (verdict.ok) onSave(title.trim() || defaultWidgetTitle(verdict.config, defs), verdict.config); };

  return (
    <Modal isOpen onClose={onClose} title={initial ? 'Edit widget' : 'Add widget'} className="!max-w-2xl">
      <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-4" aria-label="Widget settings">
        <Field label="Title">
          <input aria-label="Widget title" value={title} onChange={e => setTitle(e.target.value)} placeholder={defaultWidgetTitle(cfg, defs)} className={`${CONTROL} w-full`} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Chart type">
            <select aria-label="Chart type" value={cfg.chart} onChange={e => setChart(e.target.value as WidgetConfig['chart'])} className={`${CONTROL} w-full`}>
              {CHART_TYPES.map(c => <option key={c} value={c}>{CHART_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="Object">
            <select aria-label="Object" value={cfg.object} onChange={e => setObject(e.target.value as WidgetObject)} className={`${CONTROL} w-full`}>
              {OBJECTS.map(o => <option key={o} value={o}>{OBJECT_LABEL[o]}</option>)}
            </select>
          </Field>
          <Field label="Measure">
            <select aria-label="Measure" value={cfg.measure} onChange={e => setMeasure(e.target.value as WidgetConfig['measure'])} className={`${CONTROL} w-full`}>
              {MEASURES.filter(m => m === 'count' || fields.length > 0).map(m => <option key={m} value={m}>{MEASURE_LABEL[m]}</option>)}
            </select>
          </Field>
          {cfg.measure !== 'count' && (
            <Field label="Field">
              <select aria-label="Field" value={cfg.field ?? ''} onChange={e => patch({ field: e.target.value })} className={`${CONTROL} w-full`}>
                {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </Field>
          )}
          {cfg.chart !== 'number' && (
            <Field label="Group by">
              <select aria-label="Group by" value={cfg.groupBy} onChange={e => patch({ groupBy: e.target.value as WidgetConfig['groupBy'] })} className={`${CONTROL} w-full`}>
                {groups.map(g => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
              </select>
            </Field>
          )}
          <Field label="Time range (created)">
            <select aria-label="Time range" value={cfg.range} onChange={e => patch({ range: e.target.value as WidgetConfig['range'] })} className={`${CONTROL} w-full`}>
              {RANGES.map(r => <option key={r} value={r}>{RANGE_LABEL[r]}</option>)}
            </select>
          </Field>
          <Field label="Width (columns)">
            <select aria-label="Width" value={cfg.cols} onChange={e => patch({ cols: Number(e.target.value) as WidgetConfig['cols'] })} className={`${CONTROL} w-full`}>
              <option value={1}>1 column</option><option value={2}>2 columns</option><option value={3}>3 columns</option>
            </select>
          </Field>
        </div>
        <details className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200">
            Filters{cfg.filterGroups.length ? ` (${cfg.filterGroups.reduce((n, g) => n + g.filters.length, 0)})` : ''}
          </summary>
          <div className="mt-3">
            {cfg.object === 'deals' ? (
              <ComplexFilterBuilder
                key={cfg.object}
                stages={stages}
                availableFields={BOARD_FILTER_FIELDS.map(f => f.id)}
                initialGroups={cfg.filterGroups}
                onApplyFilters={g => patch({ filterGroups: g })}
                onClearFilters={() => patch({ filterGroups: [] })}
              />
            ) : (
              <SimpleFilters key={cfg.object} object={cfg.object} groups={cfg.filterGroups} onChange={g => patch({ filterGroups: g })} />
            )}
          </div>
        </details>
        {!verdict.ok && <ul role="alert" className="list-disc pl-5 text-sm text-red-600 dark:text-red-400">{verdict.errors.map(e => <li key={e}>{e}</li>)}</ul>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN}>Cancel</button>
          <button type="submit" disabled={!verdict.ok} className={BTN_PRIMARY}>{initial ? 'Save widget' : 'Add widget'}</button>
        </div>
      </form>
    </Modal>
  );
};
