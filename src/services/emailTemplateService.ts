import { supabase, isSupabaseConfigured } from './supabaseService';
import { isDemoMode } from '../config/demoMode';
import { assertRowsAffected } from '../utils/rlsError';
import type { Deal } from '../types';

/**
 * Email templates and snippets (table email_templates). Templates are full messages (subject + body); snippets are
 * short blocks inserted into the composer by typing `/shortcut`. Both may contain {{variables}}.
 * Demo mode keeps them in memory (and localStorage when available).
 */
export interface EmailTemplateRow {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  is_snippet: boolean;
  shortcut: string | null;
  is_active: boolean;
}
export type EmailTemplateInput = Omit<EmailTemplateRow, 'id' | 'is_active'> & { is_active?: boolean };

export const TEMPLATE_CATEGORIES = ['general', 'outreach', 'follow_up', 'proposal', 'closing'] as const;

export const TEMPLATE_VARIABLES: Array<{ key: string; label: string }> = [
  { key: 'contact_name', label: 'Contact full name' },
  { key: 'first_name', label: 'Contact first name' },
  { key: 'company', label: 'Company' },
  { key: 'deal_title', label: 'Deal title' },
  { key: 'deal_value', label: 'Deal value' },
  { key: 'owner', label: 'Deal owner' },
  { key: 'stage', label: 'Stage' },
  { key: 'today', label: "Today's date" },
];

export interface TemplateContext {
  deal?: Pick<Deal, 'title' | 'company' | 'value' | 'contact' | 'assignedTo' | 'stage'> | null;
  contact?: { name?: string; firstName?: string } | null;
  /** Sample values for the live preview in the editor. */
  now?: Date;
}

const VAR_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/** Names of all {{variables}} used in `text` (unique, in order of appearance). */
export function extractVariables(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(VAR_RE)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

export function variableValues(ctx: TemplateContext): Record<string, string> {
  const d = ctx.deal; const c = ctx.contact;
  const full = c?.name || d?.contact || '';
  const value = d?.value;
  return {
    contact_name: full,
    first_name: c?.firstName || full.split(/\s+/)[0] || '',
    company: d?.company || '',
    deal_title: d?.title || d?.company || '',
    deal_value: typeof value === 'number' ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '',
    owner: d?.assignedTo || '',
    stage: d?.stage || '',
    today: (ctx.now ?? new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  };
}

export interface RenderResult { text: string; unresolved: string[] }

/** Replaces {{variables}}. Unknown or empty values are left as {{name}} and listed in `unresolved` so nothing is silently blank. */
export function renderTemplate(text: string, ctx: TemplateContext): RenderResult {
  const values = variableValues(ctx);
  const unresolved: string[] = [];
  const out = text.replace(VAR_RE, (whole, key: string) => {
    const v = values[key];
    if (v) return v;
    if (!unresolved.includes(key)) unresolved.push(key);
    return whole;
  });
  return { text: out, unresolved };
}

/** Shortcut must be letters/digits/-/_ , 1-24 chars (no leading slash). */
export const normalizeShortcut = (s: string): string => s.trim().replace(/^\/+/, '').toLowerCase();
export const isValidShortcut = (s: string): boolean => /^[a-z0-9_-]{1,24}$/.test(normalizeShortcut(s));

/** If the text ends with `/word`, returns the snippet it names (exact shortcut match) and the text without that token. */
export function expandShortcut(text: string, snippets: EmailTemplateRow[]): { snippet: EmailTemplateRow; before: string } | null {
  const m = /(^|\s)\/([a-z0-9_-]{1,24})$/i.exec(text);
  if (!m) return null;
  const sc = m[2].toLowerCase();
  const snippet = snippets.find(s => s.is_snippet && s.shortcut && normalizeShortcut(s.shortcut) === sc);
  if (!snippet) return null;
  return { snippet, before: text.slice(0, text.length - m[2].length - 1) };
}

export function validateTemplate(t: EmailTemplateInput, existing: EmailTemplateRow[], editingId?: string): string | null {
  if (!t.name.trim()) return 'Name is required.';
  if (t.is_snippet) {
    if (!t.shortcut || !isValidShortcut(t.shortcut)) return 'Shortcut must be 1-24 letters, numbers, - or _.';
    const sc = normalizeShortcut(t.shortcut);
    if (existing.some(e => e.id !== editingId && e.is_snippet && e.shortcut && normalizeShortcut(e.shortcut) === sc)) return `The shortcut /${sc} is already used.`;
  } else if (!t.subject.trim()) return 'Subject is required for a template.';
  if (!t.body.trim()) return 'Body is required.';
  return null;
}

// ---- store -------------------------------------------------------------------------------------------------
const LS_KEY = 'email-templates:demo';
let local: EmailTemplateRow[] | null = null;
const seed = (): EmailTemplateRow[] => [
  { id: 'demo-tpl-1', name: 'Intro follow-up', subject: 'Following up on {{deal_title}}', body: 'Hi {{first_name}},\n\nThanks for your time. I wanted to follow up on {{deal_title}} for {{company}}.\n\nBest,\n{{owner}}', category: 'follow_up', is_snippet: false, shortcut: null, is_active: true },
  { id: 'demo-snip-1', name: 'Meeting link', subject: '', body: 'You can book a time that suits you here: https://example.com/book', category: 'general', is_snippet: true, shortcut: 'meet', is_active: true },
];
const loadLocal = (): EmailTemplateRow[] => {
  if (local) return local;
  try { const raw = localStorage.getItem(LS_KEY); if (raw) { local = JSON.parse(raw); return local!; } } catch { /* ignore */ }
  local = seed();
  return local;
};
const saveLocal = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(local)); } catch { /* ignore */ } };
export const __resetLocalTemplates = (): void => { local = null; try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } };
const remote = (): boolean => isSupabaseConfigured && !isDemoMode();

const COLS = 'id,name,subject,body,category,is_snippet,shortcut,is_active';
const fromRow = (r: any): EmailTemplateRow => ({
  id: r.id, name: r.name ?? '', subject: r.subject ?? '', body: r.body ?? '', category: r.category ?? 'general',
  is_snippet: !!r.is_snippet, shortcut: r.shortcut ?? null, is_active: r.is_active !== false,
});

export async function listTemplates(): Promise<EmailTemplateRow[]> {
  if (!remote()) return loadLocal().filter(t => t.is_active).map(t => ({ ...t }));
  const { data, error } = await supabase.from('email_templates').select(COLS).eq('is_active', true).order('name');
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function saveTemplate(input: EmailTemplateInput, id?: string): Promise<EmailTemplateRow> {
  const row = {
    name: input.name.trim(), subject: input.is_snippet ? '' : input.subject.trim(), body: input.body, category: input.category || 'general',
    is_snippet: input.is_snippet, shortcut: input.is_snippet && input.shortcut ? normalizeShortcut(input.shortcut) : null,
    variables: extractVariables(`${input.subject}\n${input.body}`), is_active: input.is_active ?? true,
  };
  if (!remote()) {
    const list = loadLocal();
    const { variables: _variables, ...rest } = row;
    const saved: EmailTemplateRow = { id: id ?? `demo-tpl-${Date.now()}`, ...rest };
    local = id ? list.map(t => (t.id === id ? saved : t)) : [...list, saved];
    saveLocal();
    return saved;
  }
  if (id) {
    const { data, error } = await supabase.from('email_templates').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id).select(COLS);
    if (error) throw error;
    assertRowsAffected(data);
    return fromRow(data![0]);
  }
  const { data, error } = await supabase.from('email_templates').insert(row).select(COLS).single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteTemplate(id: string): Promise<void> {
  if (!remote()) { local = loadLocal().filter(t => t.id !== id); saveLocal(); return; }
  const { data, error } = await supabase.from('email_templates').delete().eq('id', id).select('id');
  if (error) throw error;
  assertRowsAffected(data);
}
