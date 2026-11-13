import { Deal } from '../../types';
import { toCsv } from '../../utils/csv';

export type BoardExportFormat = 'csv' | 'xlsx' | 'json';

const MIME: Record<BoardExportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

export interface DealExportColumn {
  id: string;
  label: string;
  value: (d: Deal) => unknown;
}

const iso = (d?: Date | string | null) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? '' : date.toISOString();
};

/** Columns available when exporting with a column selection. */
export const DEAL_EXPORT_COLUMNS: DealExportColumn[] = [
  { id: 'id', label: 'ID', value: d => d.id },
  { id: 'title', label: 'Title', value: d => d.title ?? '' },
  { id: 'company', label: 'Company', value: d => d.company },
  { id: 'contact', label: 'Contact', value: d => d.contact },
  { id: 'value', label: 'Value', value: d => d.value },
  { id: 'stage', label: 'Stage', value: d => d.stage },
  { id: 'probability', label: 'Probability', value: d => d.probability },
  { id: 'priority', label: 'Priority', value: d => d.priority },
  { id: 'owner', label: 'Owner', value: d => d.assignedTo ?? '' },
  { id: 'dueDate', label: 'Due date', value: d => iso(d.dueDate) },
  { id: 'tags', label: 'Tags', value: d => (d.tags ?? []).join(';') },
  { id: 'notes', label: 'Notes', value: d => (d.notes ?? '').replace(/\r?\n/g, ' ') },
  { id: 'isFavorite', label: 'Favorite', value: d => Boolean(d.isFavorite) },
  { id: 'healthScore', label: 'Health score', value: d => d.healthScore ?? '' },
  { id: 'createdAt', label: 'Created', value: d => iso(d.createdAt) },
  { id: 'updatedAt', label: 'Updated', value: d => iso(d.updatedAt) }
];

export const DEFAULT_EXPORT_COLUMN_IDS = ['title', 'company', 'contact', 'value', 'stage', 'probability', 'priority', 'owner', 'dueDate', 'tags', 'notes'];

const COLUMNS_KEY = 'deal_export_columns_v1';

/** Previously chosen export columns (falls back to the defaults). */
export function loadExportColumns(): string[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(COLUMNS_KEY) : null;
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((c): c is string => typeof c === 'string' && DEAL_EXPORT_COLUMNS.some(x => x.id === c));
      if (valid.length > 0) return valid;
    }
  } catch { /* ignore */ }
  return DEFAULT_EXPORT_COLUMN_IDS;
}

export function saveExportColumns(ids: string[]): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(COLUMNS_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Build the export file content for a chosen column selection (csv/json as text, xlsx as bytes). */
export async function buildColumnExport(deals: Deal[], format: BoardExportFormat, columnIds: string[]): Promise<string | Uint8Array> {
  const cols = columnIds.map(id => DEAL_EXPORT_COLUMNS.find(c => c.id === id)).filter((c): c is DealExportColumn => !!c);
  if (format === 'csv') {
    return toCsv([cols.map(c => c.label), ...deals.map(d => cols.map(c => c.value(d)))]);
  }
  if (format === 'json') {
    return JSON.stringify(deals.map(d => Object.fromEntries(cols.map(c => [c.id, c.value(d)]))), null, 2);
  }
  const mod: any = await import('exceljs');
  const workbook = new (mod.Workbook ?? mod.default.Workbook)();
  const sheet = workbook.addWorksheet('Deals');
  sheet.addRow(cols.map(c => c.label));
  sheet.getRow(1).font = { bold: true };
  deals.forEach(d => sheet.addRow(cols.map(c => c.value(d))));
  const buffer: ArrayBuffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export interface DownloadDealsOptions {
  /** Limit the file to these columns (see DEAL_EXPORT_COLUMNS). Omit for the full default export. */
  columns?: string[];
  /** Filename prefix, default "deals". */
  name?: string;
}

/** Export deals and trigger a browser download. Returns the filename. */
export async function downloadDeals(deals: Deal[], format: BoardExportFormat, options: DownloadDealsOptions = {}): Promise<string> {
  const filename = `${options.name ?? 'deals'}-${new Date().toISOString().slice(0, 10)}.${format}`;

  if (options.columns && options.columns.length > 0) {
    const content = await buildColumnExport(deals, format, options.columns);
    if (typeof content === 'string') {
      const withBom = format === 'csv' ? `﻿${content}` : content;
      saveBlob(new Blob([withBom], { type: MIME[format] }), filename);
    } else {
      saveBlob(new Blob([content as BlobPart], { type: MIME.xlsx }), filename);
    }
    return filename;
  }

  // Loaded on demand: exceljs/jspdf are heavy
  const { exportService } = await import('../../services/exportService');
  const content = await exportService.exportDeals(deals, { format, includeMetadata: true });
  if (format === 'xlsx') {
    // exportService returns the workbook base64-encoded
    const bin = atob(content);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    saveBlob(new Blob([bytes], { type: MIME.xlsx }), filename);
  } else {
    exportService.downloadFile(content, filename, MIME[format]);
  }
  return filename;
}
