import type { Deal, PipelineStage } from '../../types';
import { toCsv } from '../../utils/csv';

export type ImportField = 'title' | 'company' | 'contact' | 'value' | 'stage' | 'probability' | 'priority' | 'dueDate' | 'notes' | 'tags';

export interface ImportFieldDef {
  id: ImportField;
  label: string;
  required?: boolean;
  /** Normalised (lowercase, alphanumeric) header names that map to this field. */
  synonyms: string[];
}

export const IMPORT_FIELDS: ImportFieldDef[] = [
  { id: 'title', label: 'Title', required: true, synonyms: ['title', 'name', 'dealname', 'dealtitle', 'deal', 'opportunity', 'opportunityname', 'subject'] },
  { id: 'company', label: 'Company', synonyms: ['company', 'companyname', 'account', 'accountname', 'organization', 'organisation', 'org', 'client', 'customer'] },
  { id: 'contact', label: 'Contact', synonyms: ['contact', 'contactname', 'contactperson', 'person', 'fullname', 'primarycontact'] },
  { id: 'value', label: 'Value', synonyms: ['value', 'amount', 'dealvalue', 'dealamount', 'price', 'revenue', 'arr', 'total', 'worth'] },
  { id: 'stage', label: 'Stage', synonyms: ['stage', 'dealstage', 'pipelinestage', 'status', 'phase'] },
  { id: 'probability', label: 'Probability', synonyms: ['probability', 'prob', 'winprobability', 'chance', 'likelihood', 'winrate'] },
  { id: 'priority', label: 'Priority', synonyms: ['priority', 'importance', 'urgency'] },
  { id: 'dueDate', label: 'Due / close date', synonyms: ['duedate', 'due', 'closedate', 'expectedclosedate', 'expectedclose', 'closingdate', 'closeby', 'deadline', 'date'] },
  { id: 'notes', label: 'Notes', synonyms: ['notes', 'note', 'description', 'comments', 'comment', 'details', 'summary'] },
  { id: 'tags', label: 'Tags', synonyms: ['tags', 'tag', 'labels', 'label', 'categories', 'category'] }
];

/** Mapping for each file column (by index): the deal field it feeds, or '' to skip it. */
export type ColumnMapping = Array<ImportField | ''>;

export const normalizeHeader = (h: string): string => h.toLowerCase().replace(/[^a-z0-9]+/g, '');

const MAPPING_KEY = 'deal_import_mapping_v1';

type SavedMapping = Record<string, ImportField | ''>;

const readSaved = (): SavedMapping => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MAPPING_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as SavedMapping : {};
  } catch {
    return {};
  }
};

/** Remember header -> field choices for the next import. */
export function saveMappingPreference(headers: string[], mapping: ColumnMapping): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const saved = readSaved();
    headers.forEach((h, i) => { const k = normalizeHeader(h); if (k) saved[k] = mapping[i] ?? ''; });
    localStorage.setItem(MAPPING_KEY, JSON.stringify(saved));
  } catch {
    /* storage unavailable */
  }
}

/** Best-guess mapping: saved preference first, then exact synonym match, then partial match. Each field is used once. */
export function autoMapHeaders(headers: string[], useSaved = true): ColumnMapping {
  const result: ColumnMapping = headers.map(() => '');
  const taken = new Set<ImportField>();
  const norm = headers.map(normalizeHeader);
  const saved = useSaved ? readSaved() : {};

  // 1. saved preferences
  norm.forEach((h, i) => {
    const pref = saved[h];
    if (pref && !taken.has(pref) && IMPORT_FIELDS.some(f => f.id === pref)) { result[i] = pref; taken.add(pref); }
  });
  // 2. exact synonym
  IMPORT_FIELDS.forEach(field => {
    if (taken.has(field.id)) return;
    const idx = norm.findIndex((h, i) => result[i] === '' && field.synonyms.includes(h) && !(h in saved && saved[h] === ''));
    if (idx >= 0) { result[idx] = field.id; taken.add(field.id); }
  });
  // 3. partial (header contains a synonym of 4+ chars)
  IMPORT_FIELDS.forEach(field => {
    if (taken.has(field.id)) return;
    const idx = norm.findIndex((h, i) => result[i] === '' && !(h in saved) && h.length > 0 && field.synonyms.some(s => s.length >= 4 && h.includes(s)));
    if (idx >= 0) { result[idx] = field.id; taken.add(field.id); }
  });
  return result;
}

// ---------------------------------------------------------------------------
// Value parsing
// ---------------------------------------------------------------------------

/** "$1,200.50", "1.5k", "2M", "(300)" -> number; NaN when not a number. Empty -> 0. */
export function parseMoney(raw: string): number {
  let s = raw.trim();
  if (s === '') return 0;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/[\s$€£¥]/g, '').replace(/^(usd|eur|gbp)/i, '').replace(/(usd|eur|gbp)$/i, '');
  // 1.234,56 (European) vs 1,234.56
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  let mult = 1;
  const suffix = s.slice(-1).toLowerCase();
  if (suffix === 'k') { mult = 1e3; s = s.slice(0, -1); }
  else if (suffix === 'm') { mult = 1e6; s = s.slice(0, -1); }
  else if (suffix === 'b') { mult = 1e9; s = s.slice(0, -1); }
  if (s === '' || !/^-?\d*\.?\d+$/.test(s)) return NaN;
  const n = Number(s) * mult;
  return negative ? -n : n;
}

/** "75", "75%", "0.75" -> 75; NaN when invalid; empty -> undefined. */
export function parseProbability(raw: string): number | undefined {
  const s = raw.trim().replace(/%$/, '').trim();
  if (s === '') return undefined;
  if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
  const n = Number(s);
  // 0.75 style fractions
  if (n > 0 && n < 1 && !raw.includes('%')) return Math.round(n * 100);
  return n;
}

/** ISO, yyyy/mm/dd, m/d/yyyy, d.m.yyyy, "Jan 5, 2025", Excel serials -> Date; null when invalid; undefined when empty. */
export function parseDateValue(raw: string): Date | null | undefined {
  const s = raw.trim();
  if (s === '') return undefined;
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (m) return validDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  m = /^(\d{1,2})[.](\d{1,2})[.](\d{4})$/.exec(s);
  if (m) return validDate(+m[3], +m[2], +m[1]);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 80000) return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function validDate(y: number, mo: number, d: number): Date | null {
  const date = new Date(y, mo - 1, d, 12, 0, 0);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

export function parsePriority(raw: string): Deal['priority'] | null | undefined {
  const s = raw.trim().toLowerCase();
  if (s === '') return undefined;
  if (['high', 'h', 'urgent', 'hot', '1', 'critical'].includes(s)) return 'high';
  if (['medium', 'med', 'm', 'normal', 'mid', '2'].includes(s)) return 'medium';
  if (['low', 'l', 'cold', '3', 'minor'].includes(s)) return 'low';
  return null;
}

export const parseTags = (raw: string): string[] =>
  raw.split(/[;,|]/).map(t => t.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// Row normalisation / validation
// ---------------------------------------------------------------------------

export type ImportDeal = Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>;

export interface NormalizedRow {
  /** 1-based data row number (header excluded). */
  row: number;
  raw: string[];
  /** Absent when the row has errors. */
  deal?: ImportDeal;
  /** Fields that were present in the file (used for "update existing"). */
  provided: Set<ImportField>;
  errors: string[];
  /** Stage text from the file that matches no stage (normalised key -> original text). */
  unknownStage?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

export const dealKey = (title: string | undefined, company: string | undefined): string =>
  `${norm(title ?? '')}|${norm(company ?? '')}`;

/** Resolve stage text to a stage key (by key or name, case/punctuation-insensitive). */
export function matchStage(text: string, stages: PipelineStage[]): string | null {
  const n = norm(text);
  if (!n) return null;
  return stages.find(s => norm(s.key) === n || norm(s.name) === n)?.key ?? null;
}

export interface NormalizeContext {
  stages: PipelineStage[];
  /** normalised unknown stage text -> existing stage key | NEW_STAGE */
  stageResolution: Record<string, string>;
  defaultStage: string;
}

export const NEW_STAGE = '__new__';

export function normalizeRow(raw: string[], rowNumber: number, mapping: ColumnMapping, ctx: NormalizeContext): NormalizedRow {
  const get = (field: ImportField): string | undefined => {
    const idx = mapping.indexOf(field);
    return idx >= 0 ? (raw[idx] ?? '').trim() : undefined;
  };
  const provided = new Set<ImportField>();
  IMPORT_FIELDS.forEach(({ id }) => {
    const v = get(id);
    if (v !== undefined && v !== '') provided.add(id);
  });

  const errors: string[] = [];
  const title = get('title') ?? '';
  if (!title) errors.push('Missing title');
  else if (title.length > 200) errors.push('Title is longer than 200 characters');

  const company = get('company') ?? '';
  if (company.length > 100) errors.push('Company is longer than 100 characters');
  const contact = get('contact') ?? '';
  if (contact.length > 100) errors.push('Contact is longer than 100 characters');

  let value = 0;
  const rawValue = get('value');
  if (rawValue !== undefined && rawValue !== '') {
    const n = parseMoney(rawValue);
    if (isNaN(n)) errors.push(`Invalid number "${rawValue}" for value`);
    else if (n < 0) errors.push('Value cannot be negative');
    else value = n;
  }

  let probability: number | undefined;
  const rawProb = get('probability');
  if (rawProb !== undefined && rawProb !== '') {
    const p = parseProbability(rawProb);
    if (p === undefined) { /* empty */ }
    else if (isNaN(p) || p < 0 || p > 100) errors.push(`Invalid probability "${rawProb}" (use 0-100)`);
    else probability = p;
  }

  let priority: Deal['priority'] = 'medium';
  const rawPriority = get('priority');
  if (rawPriority) {
    const pr = parsePriority(rawPriority);
    if (pr === null) errors.push(`Invalid priority "${rawPriority}" (use high, medium or low)`);
    else if (pr) priority = pr;
  }

  let dueDate: Date | undefined;
  const rawDue = get('dueDate');
  if (rawDue) {
    const d = parseDateValue(rawDue);
    if (d === null) errors.push(`Invalid date "${rawDue}"`);
    else if (d) dueDate = d;
  }

  let stage = ctx.defaultStage;
  let unknownStage: string | undefined;
  const rawStage = get('stage');
  if (rawStage) {
    const matched = matchStage(rawStage, ctx.stages);
    if (matched) stage = matched;
    else {
      unknownStage = rawStage;
      const res = ctx.stageResolution[norm(rawStage)];
      if (res && res !== NEW_STAGE) stage = res;
      // NEW_STAGE / unresolved: stage is filled in at import time
      else stage = `${NEW_STAGE}:${norm(rawStage)}`;
    }
  }

  const stageProbability = ctx.stages.find(s => s.key === stage)?.probability;
  const tags = parseTags(get('tags') ?? '');
  const notes = get('notes') ?? '';

  const base: NormalizedRow = { row: rowNumber, raw, provided, errors, unknownStage };
  if (errors.length > 0) return base;

  return {
    ...base,
    deal: {
      title,
      company,
      contact,
      value,
      stage,
      probability: probability ?? stageProbability ?? 0,
      priority,
      ...(dueDate ? { dueDate } : {}),
      ...(notes ? { notes } : {}),
      ...(tags.length > 0 ? { tags } : {})
    }
  };
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export const TEMPLATE_HEADERS = ['title', 'company', 'contact', 'value', 'stage', 'probability', 'priority', 'due_date', 'notes', 'tags'];

export function buildTemplateCsv(stages: PipelineStage[]): string {
  const first = stages[0]?.name ?? 'Lead';
  const second = stages[1]?.name ?? first;
  return toCsv([
    TEMPLATE_HEADERS,
    ['Website redesign', 'Acme Inc', 'Jane Doe', '25000', first, '20', 'high', '2026-12-31', 'Intro call booked', 'web;design'],
    ['Annual support plan', 'Globex', 'John Smith', '$12,500', second, '60%', 'medium', '2027-01-15', '', 'renewal']
  ]);
}

/** CSV of rows that were not imported, with an extra "error" column. */
export function buildErrorCsv(headers: string[], failures: Array<{ raw: string[]; error: string }>): string {
  return toCsv([[...headers, 'error'], ...failures.map(f => [...f.raw, f.error])]);
}
