import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileUp, Upload } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useDealStore } from '../../store/dealStore';
import type { Deal } from '../../types';
import { bulkImportDeals, assignBulkPositions, BulkImportItem, BULK_CHUNK_SIZE } from '../../services/dealBulkService';
import { ACCEPTED_IMPORT_EXTENSIONS, ImportTable, parseImportFile } from './parseImportFile';
import {
  ColumnMapping,
  IMPORT_FIELDS,
  ImportField,
  NEW_STAGE,
  NormalizedRow,
  autoMapHeaders,
  buildErrorCsv,
  buildTemplateCsv,
  dealKey,
  normalizeRow,
  saveMappingPreference
} from './dealImportMapping';
import { downloadTextFile } from './downloadFile';

type Step = 'upload' | 'map' | 'preview' | 'importing' | 'result';
type DuplicatePolicy = 'skip' | 'update' | 'import';

interface DealImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after an import finishes with the number of deals created or updated. */
  onImported?: (count: number) => void;
}

interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  failed: Array<{ row: number; message: string }>;
}

const STEP_LABELS: Array<{ id: Step; label: string }> = [
  { id: 'upload', label: 'Upload' },
  { id: 'map', label: 'Map columns' },
  { id: 'preview', label: 'Preview' },
  { id: 'importing', label: 'Import' },
  { id: 'result', label: 'Result' }
];

const SELECT_CLASS =
  'px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500';

type RowStatus = 'ok' | 'error' | 'duplicate' | 'file-duplicate';

const UPDATE_PROPS: Partial<Record<ImportField, keyof Deal>> = {
  contact: 'contact', value: 'value', stage: 'stage', probability: 'probability',
  priority: 'priority', dueDate: 'dueDate', notes: 'notes', tags: 'tags'
};

export const DealImportWizard: React.FC<DealImportWizardProps> = ({ isOpen, onClose, onImported }) => {
  const dealsMap = useDealStore(s => s.deals);
  const stages = useDealStore(s => s.stages);
  const createDeal = useDealStore(s => s.createDeal);
  const updateDeal = useDealStore(s => s.updateDeal);
  const addStage = useDealStore(s => s.addStage);

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState<ImportTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapping, setMapping] = useState<ColumnMapping>([]);
  const [stageResolution, setStageResolution] = useState<Record<string, string>>({});
  const [policy, setPolicy] = useState<DuplicatePolicy>('skip');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [errorCsv, setErrorCsv] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.position - b.position), [stages]);
  const defaultStage = (sortedStages.find(s => s.visible) ?? sortedStages[0])?.key ?? 'lead';

  const reset = useCallback(() => {
    setStep('upload'); setFileName(''); setTable(null); setError(null); setLoading(false); setMapping([]);
    setStageResolution({}); setPolicy('skip'); setProgress({ done: 0, total: 0 }); setSummary(null); setErrorCsv(null);
    cancelRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const close = () => { if (step === 'importing') return; reset(); onClose(); };

  const handleFile = async (file: (File & { name: string }) | undefined | null) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const parsed = await parseImportFile(file);
      setTable(parsed);
      setFileName(file.name);
      setMapping(autoMapHeaders(parsed.headers));
      setStep('map');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the file');
    } finally {
      setLoading(false);
    }
  };

  const setColumnField = (col: number, field: ImportField | '') => {
    setMapping(prev => prev.map((f, i) => (i === col ? field : field !== '' && f === field ? '' : f)));
  };

  // ---- preview model ----------------------------------------------------------
  const preview = useMemo(() => {
    if (!table || step === 'upload' || step === 'map') return null;
    const ctx = { stages: sortedStages, stageResolution, defaultStage };
    const rows: NormalizedRow[] = table.rows.map((r, i) => normalizeRow(r, i + 1, mapping, ctx));

    const existing = new Map<string, Deal>();
    Object.values(dealsMap).forEach(d => {
      const k = dealKey(d.title, d.company);
      if (!existing.has(k)) existing.set(k, d);
    });
    const seen = new Set<string>();
    const statuses: RowStatus[] = rows.map(r => {
      if (!r.deal) return 'error';
      const k = dealKey(r.deal.title, r.deal.company);
      if (existing.has(k)) return 'duplicate';
      if (seen.has(k)) return 'file-duplicate';
      seen.add(k);
      return 'ok';
    });
    const unknownStages = new Map<string, string>();
    rows.forEach(r => {
      if (r.unknownStage) unknownStages.set(r.unknownStage.toLowerCase().replace(/[^a-z0-9]+/g, ''), r.unknownStage);
    });
    return { rows, statuses, existing, unknownStages };
  }, [table, step, mapping, sortedStages, stageResolution, defaultStage, dealsMap]);

  const counts = useMemo(() => {
    const c = { ok: 0, error: 0, duplicate: 0, 'file-duplicate': 0 };
    preview?.statuses.forEach(s => { c[s]++; });
    return c;
  }, [preview]);

  const titleMapped = mapping.includes('title');

  // ---- import -------------------------------------------------------------------
  const runImport = async () => {
    if (!preview || !table) return;
    saveMappingPreference(table.headers, mapping);
    cancelRef.current = false;
    setStep('importing');

    // 1. create stages the file introduces
    const newStageKeys: Record<string, string> = {};
    const needed = new Map<string, string>();
    preview.rows.forEach((r, i) => {
      if (r.deal?.stage.startsWith(`${NEW_STAGE}:`) && preview.statuses[i] !== 'error') {
        needed.set(r.deal.stage, r.unknownStage ?? r.deal.stage.slice(NEW_STAGE.length + 1));
      }
    });
    for (const [placeholder, name] of needed) {
      const created = await addStage(name);
      newStageKeys[placeholder] = created?.key ?? defaultStage;
    }
    const resolveStage = (stage: string) => (stage.startsWith(`${NEW_STAGE}:`) ? newStageKeys[stage] ?? defaultStage : stage);

    // 2. plan
    let skipped = 0;
    const items: BulkImportItem[] = [];
    preview.rows.forEach((r, i) => {
      const status = preview.statuses[i];
      if (!r.deal || status === 'error') return;
      const deal = { ...r.deal, stage: resolveStage(r.deal.stage) };
      if (status === 'ok') { items.push({ row: r.row, action: 'create', data: deal }); return; }
      if (policy === 'skip') { skipped++; return; }
      if (policy === 'import') { items.push({ row: r.row, action: 'create', data: deal }); return; }
      // update existing (only for deals that already exist in the store)
      const existing = status === 'duplicate' ? preview.existing.get(dealKey(deal.title, deal.company)) : undefined;
      if (!existing) { skipped++; return; }
      const updates: Partial<Deal> = {};
      r.provided.forEach(field => {
        const prop = UPDATE_PROPS[field];
        if (prop) (updates as Record<string, unknown>)[prop] = (deal as unknown as Record<string, unknown>)[prop];
      });
      items.push({ row: r.row, action: 'update', existingId: existing.id, data: updates });
    });

    // 3. write in chunks
    setProgress({ done: 0, total: items.length });
    const planned = assignBulkPositions(items, Object.values(useDealStore.getState().deals));
    const result = await bulkImportDeals(
      planned,
      { createDeal: (d) => createDeal(d), updateDeal: (id, u) => updateDeal(id, u) },
      { chunkSize: BULK_CHUNK_SIZE, onProgress: (done, total) => setProgress({ done, total }), isCancelled: () => cancelRef.current }
    );

    const failures = [
      ...preview.rows.filter(r => r.errors.length > 0).map(r => ({ raw: r.raw, error: r.errors.join('; ') })),
      ...result.failed.map(f => ({ raw: table.rows[f.row - 1] ?? [], error: f.message }))
    ];
    setErrorCsv(failures.length > 0 ? buildErrorCsv(table.headers, failures) : null);
    setSummary({ created: result.created, updated: result.updated, skipped, failed: [
      ...preview.rows.filter(r => r.errors.length > 0).map(r => ({ row: r.row, message: r.errors.join('; ') })),
      ...result.failed
    ] });
    setStep('result');
    if (result.created + result.updated > 0) onImported?.(result.created + result.updated);
  };

  const importable = counts.ok + (policy === 'skip' ? 0 : counts.duplicate + counts['file-duplicate']);

  // ---- render ---------------------------------------------------------------------
  const stepIndex = STEP_LABELS.findIndex(s => s.id === step);

  return (
    <Modal isOpen={isOpen} onClose={close} title="Import deals" className="max-w-4xl">
      <ol className="flex items-center gap-2 mb-5 text-xs" aria-label="Import progress">
        {STEP_LABELS.map((s, i) => (
          <li
            key={s.id}
            aria-current={i === stepIndex ? 'step' : undefined}
            className={`px-2 py-1 rounded-full ${i === stepIndex ? 'bg-blue-600 text-white' : i < stepIndex ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      {error && (
        <div role="alert" className="mb-4 flex items-start space-x-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void handleFile(e.dataTransfer.files?.[0]); }}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center"
          >
            <FileUp className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">Drop a file here or choose one ({ACCEPTED_IMPORT_EXTENSIONS.join(', ')})</p>
            <label className="inline-flex items-center px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              <span>{loading ? 'Reading...' : 'Choose file'}</span>
              <input
                ref={fileInputRef}
                type="file"
                data-testid="import-file-input"
                aria-label="Deal import file"
                accept={ACCEPTED_IMPORT_EXTENSIONS.join(',')}
                className="sr-only"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
            </label>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
            <span>Need a starting point?</span>
            <Button variant="outline" size="sm" type="button" onClick={() => downloadTextFile(buildTemplateCsv(sortedStages), 'deal-import-template.csv')}>
              <Download className="w-4 h-4 mr-1" />
              Download CSV template
            </Button>
          </div>
        </div>
      )}

      {step === 'map' && table && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <strong>{fileName}</strong>: {table.rows.length} row{table.rows.length === 1 ? '' : 's'}. Match each column to a deal field.
          </p>
          <div className="overflow-auto max-h-80 border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-left text-xs text-gray-500 dark:text-gray-400">
                <tr><th className="px-3 py-2">Column</th><th className="px-3 py-2">Sample</th><th className="px-3 py-2">Import as</th></tr>
              </thead>
              <tbody>
                {table.headers.map((h, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{h || `(column ${i + 1})`}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 max-w-[16rem] truncate">
                      {table.rows.slice(0, 3).map(r => r[i]).filter(Boolean).join(' | ')}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Map column ${h || i + 1}`}
                        value={mapping[i] ?? ''}
                        onChange={(e) => setColumnField(i, e.target.value as ImportField | '')}
                        className={SELECT_CLASS}
                      >
                        <option value="">Do not import</option>
                        {IMPORT_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}{f.required ? ' *' : ''}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!titleMapped && <p role="alert" className="text-sm text-amber-600 dark:text-amber-400">Map a column to Title to continue.</p>}
          <div className="flex justify-between">
            <Button variant="ghost" type="button" onClick={reset}>Back</Button>
            <Button type="button" disabled={!titleMapped} onClick={() => setStep('preview')}>Preview</Button>
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 text-sm" role="status">
            <span className="px-2 py-1 rounded bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200">{counts.ok} ready</span>
            <span className="px-2 py-1 rounded bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">{counts.duplicate + counts['file-duplicate']} duplicate{counts.duplicate + counts['file-duplicate'] === 1 ? '' : 's'}</span>
            <span className="px-2 py-1 rounded bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200">{counts.error} with errors</span>
          </div>

          {preview.unknownStages.size > 0 && (
            <fieldset className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
              <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-200">Unknown stages</legend>
              {[...preview.unknownStages.entries()].map(([k, original]) => (
                <label key={k} className="flex items-center justify-between gap-3 text-sm text-gray-700 dark:text-gray-200">
                  <span>"{original}"</span>
                  <select
                    aria-label={`Stage for ${original}`}
                    value={stageResolution[k] ?? NEW_STAGE}
                    onChange={(e) => setStageResolution(prev => ({ ...prev, [k]: e.target.value }))}
                    className={SELECT_CLASS}
                  >
                    <option value={NEW_STAGE}>Create new stage "{original}"</option>
                    {sortedStages.map(s => <option key={s.key} value={s.key}>Use {s.name}</option>)}
                  </select>
                </label>
              ))}
            </fieldset>
          )}

          {(counts.duplicate + counts['file-duplicate']) > 0 && (
            <fieldset className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
              <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-200">Duplicates (same title and company)</legend>
              <div className="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-200">
                {([['skip', 'Skip duplicates'], ['update', 'Update existing deals'], ['import', 'Import anyway']] as Array<[DuplicatePolicy, string]>).map(([v, label]) => (
                  <label key={v} className="flex items-center space-x-1">
                    <input type="radio" name="dup-policy" value={v} checked={policy === v} onChange={() => setPolicy(v)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="overflow-auto max-h-72 border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full text-sm" data-testid="import-preview">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-left text-xs text-gray-500 dark:text-gray-400">
                <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Company</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Stage</th><th className="px-3 py-2">Status</th></tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 50).map((r, i) => {
                  const status = preview.statuses[i];
                  const stageKey = r.deal?.stage ?? '';
                  const stageName = stageKey.startsWith(`${NEW_STAGE}:`) ? `${r.unknownStage} (new)` : sortedStages.find(s => s.key === stageKey)?.name ?? stageKey;
                  return (
                    <tr key={r.row} className={`border-t border-gray-100 dark:border-gray-700 ${status === 'error' ? 'bg-red-50/60 dark:bg-red-900/10' : ''}`}>
                      <td className="px-3 py-1.5 text-gray-500">{r.row}</td>
                      <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">{r.deal?.title ?? ''}</td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.deal?.company ?? ''}</td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.deal ? r.deal.value.toLocaleString() : ''}</td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{stageName}</td>
                      <td className="px-3 py-1.5">
                        {status === 'error' && <span className="text-red-600 dark:text-red-400">{r.errors.join('; ')}</span>}
                        {status === 'duplicate' && <span className="text-yellow-700 dark:text-yellow-400">Duplicate of existing deal</span>}
                        {status === 'file-duplicate' && <span className="text-yellow-700 dark:text-yellow-400">Duplicate within file</span>}
                        {status === 'ok' && <span className="text-green-700 dark:text-green-400">Ready</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 50 && <p className="text-xs text-gray-500 dark:text-gray-400">Showing the first 50 of {preview.rows.length} rows.</p>}

          <div className="flex justify-between">
            <Button variant="ghost" type="button" onClick={() => setStep('map')}>Back</Button>
            <Button type="button" disabled={importable === 0 && !(policy === 'update' && counts.duplicate > 0)} onClick={() => void runImport()}>
              Import {importable > 0 ? `${importable} deal${importable === 1 ? '' : 's'}` : ''}
            </Button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="space-y-3 py-6">
          <p className="text-sm text-gray-700 dark:text-gray-200">Importing deals... {progress.done} of {progress.total}</p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            aria-label="Import progress"
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
          >
            <div className="h-2 bg-blue-600 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
          <Button variant="outline" size="sm" type="button" onClick={() => { cancelRef.current = true; }}>Stop after this batch</Button>
        </div>
      )}

      {step === 'result' && summary && (
        <div className="space-y-4" data-testid="import-result">
          <div className="flex items-center space-x-2 text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Import finished</span>
          </div>
          <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
            <li>{summary.created} deal{summary.created === 1 ? '' : 's'} created</li>
            <li>{summary.updated} deal{summary.updated === 1 ? '' : 's'} updated</li>
            <li>{summary.skipped} skipped as duplicates</li>
            <li>{summary.failed.length} row{summary.failed.length === 1 ? '' : 's'} with errors</li>
          </ul>
          {summary.failed.length > 0 && (
            <ul className="max-h-32 overflow-auto text-xs text-red-600 dark:text-red-400 space-y-0.5">
              {summary.failed.slice(0, 20).map((f, i) => <li key={i}>Row {f.row}: {f.message}</li>)}
            </ul>
          )}
          <div className="flex justify-between">
            {errorCsv ? (
              <Button variant="outline" type="button" onClick={() => downloadTextFile(errorCsv, 'deal-import-errors.csv')}>
                <Download className="w-4 h-4 mr-1" />
                Download error CSV
              </Button>
            ) : <span />}
            <div className="space-x-2">
              <Button variant="ghost" type="button" onClick={reset}>Import another file</Button>
              <Button type="button" onClick={close}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default DealImportWizard;
