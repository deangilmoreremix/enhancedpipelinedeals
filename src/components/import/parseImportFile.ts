import { parseCsvTable } from '../../utils/csv';

export interface ImportTable {
  headers: string[];
  rows: string[][];
}

export const ACCEPTED_IMPORT_EXTENSIONS = ['.csv', '.tsv', '.txt', '.json', '.xlsx'];
export const MAX_IMPORT_ROWS = 5000;

const cellToString = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.map(cellToString).filter(Boolean).join(';');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('result' in o) return cellToString(o.result);            // exceljs formula
    if (Array.isArray(o.richText)) return (o.richText as Array<{ text?: string }>).map(t => t.text ?? '').join('');
    if (typeof o.text === 'string') return o.text;               // exceljs hyperlink
    return JSON.stringify(v);
  }
  return String(v);
};

/** Reads a File/Blob as text (File.text() with a FileReader fallback). */
async function readText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsText(file);
  });
}

export function parseJsonTable(text: string): ImportTable {
  const data: unknown = JSON.parse(text);
  const list: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { deals?: unknown }).deals)
      ? (data as { deals: unknown[] }).deals
      : [];
  const objects = list.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r));
  if (objects.length === 0) throw new Error('JSON must be an array of deal objects (or { "deals": [...] })');
  const headers: string[] = [];
  objects.forEach(o => Object.keys(o).forEach(k => { if (!headers.includes(k)) headers.push(k); }));
  return { headers, rows: objects.map(o => headers.map(h => cellToString(o[h]))) };
}

async function parseXlsx(file: Blob): Promise<ImportTable> {
  // exceljs is heavy: load it only when an Excel file is actually imported
  const mod: any = await import('exceljs');
  const WorkbookCtor = mod.Workbook ?? mod.default?.Workbook;
  const workbook = new WorkbookCtor();
  const buffer = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : await new Response(file).arrayBuffer();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('The workbook has no sheets');
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row: { values: unknown[] }) => {
    // exceljs row.values is 1-based (index 0 is empty)
    const values = (row.values as unknown[]).slice(1).map(cellToString);
    if (values.some(v => v.trim() !== '')) rows.push(values);
  });
  if (rows.length === 0) throw new Error('The first sheet is empty');
  const width = Math.max(...rows.map(r => r.length));
  const pad = (r: string[]) => (r.length < width ? [...r, ...Array(width - r.length).fill('')] : r);
  return { headers: pad(rows[0]).map(h => h.trim()), rows: rows.slice(1).map(pad) };
}

/** Parse an uploaded .csv/.tsv/.txt/.json/.xlsx file into headers + string rows. */
export async function parseImportFile(file: { name: string } & Blob): Promise<ImportTable> {
  const name = file.name.toLowerCase();
  let table: ImportTable;
  if (name.endsWith('.xlsx')) {
    table = await parseXlsx(file);
  } else if (name.endsWith('.json')) {
    table = parseJsonTable(await readText(file));
  } else if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    const parsed = parseCsvTable(await readText(file), name.endsWith('.tsv') ? { delimiter: '\t' } : {});
    table = { headers: parsed.headers, rows: parsed.rows };
  } else {
    throw new Error('Unsupported file type. Use .csv, .tsv, .json or .xlsx');
  }
  if (table.headers.length === 0 || table.headers.every(h => !h)) throw new Error('No header row found');
  if (table.rows.length === 0) throw new Error('The file has a header but no data rows');
  if (table.rows.length > MAX_IMPORT_ROWS) throw new Error(`Too many rows (${table.rows.length}). The limit is ${MAX_IMPORT_ROWS} per import.`);
  return table;
}
