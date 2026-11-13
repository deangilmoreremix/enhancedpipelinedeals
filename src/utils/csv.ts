/**
 * Small RFC 4180 CSV/TSV parser and writer (no dependencies).
 * - quoted fields with "" escapes and embedded delimiters / newlines
 * - CRLF, LF and CR row endings, UTF-8 BOM stripped
 * - delimiter sniffing (comma, semicolon, tab, pipe)
 */

export const CSV_DELIMITERS = [',', ';', '\t', '|'] as const;

const stripBom = (text: string): string => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

/** Pick the delimiter that yields the most consistent column count over the first rows (quotes respected). */
export function sniffDelimiter(text: string): string {
  const sample = stripBom(text).slice(0, 8192);
  let best = ',';
  let bestScore = 0;
  for (const d of CSV_DELIMITERS) {
    const rows = parseCsv(sample, { delimiter: d }).slice(0, 6);
    if (rows.length === 0) continue;
    const widths = rows.map(r => r.length);
    const first = widths[0];
    if (first < 2) continue;
    const consistent = widths.filter(w => w === first).length;
    // stray quotes left inside parsed fields usually mean this delimiter mis-split a quoted field
    const stray = rows.reduce((n, r) => n + r.filter(f => f.includes('"')).length, 0);
    const score = consistent * 1000 + first * 10 - stray;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

export interface ParseCsvOptions {
  /** Field delimiter; sniffed when omitted. */
  delimiter?: string;
  /** Keep rows whose fields are all empty (default false). */
  keepEmptyRows?: boolean;
}

/** Parse CSV text into rows of string fields. */
export function parseCsv(input: string, options: ParseCsvOptions = {}): string[][] {
  const text = stripBom(input);
  const delimiter = options.delimiter ?? sniffDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldWasQuoted = false;
  let i = 0;

  const endField = () => { row.push(field); field = ''; fieldWasQuoted = false; };
  const endRow = () => {
    endField();
    if (options.keepEmptyRows || row.some(f => f !== '')) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === '' && !fieldWasQuoted) { inQuotes = true; fieldWasQuoted = true; i++; continue; }
    if (ch === delimiter) { endField(); i++; continue; }
    if (ch === '\r') { endRow(); i += text[i + 1] === '\n' ? 2 : 1; continue; }
    if (ch === '\n') { endRow(); i++; continue; }
    field += ch; i++;
  }
  // last field / row (no trailing newline)
  if (field !== '' || fieldWasQuoted || row.length > 0) endRow();
  return rows;
}

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

/** First non-empty row is the header; the remaining rows are padded/truncated to the header width. */
export function parseCsvTable(text: string, options: ParseCsvOptions = {}): ParsedTable {
  const clean = stripBom(text);
  const delimiter = options.delimiter ?? sniffDelimiter(clean);
  const all = parseCsv(clean, { ...options, delimiter });
  if (all.length === 0) return { headers: [], rows: [], delimiter };
  const headers = all[0].map(h => h.trim());
  const width = headers.length;
  const rows = all.slice(1).map(r => {
    if (r.length === width) return r;
    return r.length > width ? r.slice(0, width) : [...r, ...Array(width - r.length).fill('')];
  });
  return { headers, rows, delimiter };
}

/** Neutralise spreadsheet formula injection for text cells (=, +, -, @ followed by non-numeric content). */
export function safeCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value) && isNaN(Number(value))) return `'${value}`;
  return value;
}

const needsQuotes = (s: string, delimiter: string) =>
  s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(delimiter) || /^\s|\s$/.test(s);

/** Serialise rows to CSV text (CRLF row endings per RFC 4180). */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>, options: { delimiter?: string; safeFormulas?: boolean } = {}): string {
  const delimiter = options.delimiter ?? ',';
  const safe = options.safeFormulas ?? true;
  return rows
    .map(row =>
      row
        .map(cell => {
          if (cell === null || cell === undefined) return '';
          let s = cell instanceof Date ? cell.toISOString() : String(cell);
          if (safe && typeof cell === 'string') s = safeCell(s);
          return needsQuotes(s, delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(delimiter)
    )
    .join('\r\n');
}
