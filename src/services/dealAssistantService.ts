/**
 * Deal AI service shared by DealAssistantPanel, DealAIAssist and DealInsightsTab.
 * Everything goes through the server-side OpenAI Responses gateway (callAI). The assistant only PROPOSES
 * changes (structured suggestions); nothing is written until the user clicks Apply, which goes through
 * the caller-supplied updateDeal (dealStore.updateDeal).
 */
import { callAI, AIGatewayError } from './aiClient';
import { canUseRemote } from './dealRecordShared';
import type { Deal } from '../types';

export type SuggestionKind = 'field_edit' | 'next_step';
export const EDITABLE_FIELDS = ['title', 'value', 'probability', 'priority', 'dueDate', 'notes', 'tags'] as const;
export type EditableField = typeof EDITABLE_FIELDS[number];

export interface AssistantSuggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  rationale: string;
  field: EditableField | null;
  /** Proposed value as sent by the model (string); parse with `suggestionToUpdates`. */
  value: string | null;
}

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

export interface AssistantReply { reply: string; suggestions: AssistantSuggestion[] }

/** Human-readable error for any AI failure (unreachable gateway, auth, rate limit, ...). */
export function aiErrorMessage(e: unknown): string {
  if (e instanceof AIGatewayError) {
    if (e.status === 401) return 'The AI service rejected your session. Please sign in again.';
    if (e.status === 429) return 'The AI service is rate limited. Please wait a moment and try again.';
    if (e.status && e.status >= 500) return `The AI service had a problem (${e.status}). Please try again shortly.`;
    return e.message || 'The AI request failed.';
  }
  const msg = e instanceof Error ? e.message : '';
  if (e instanceof TypeError || /failed to fetch|network|load failed/i.test(msg)) {
    return 'The AI gateway is unreachable right now. Check your connection and try again.';
  }
  return msg || 'The AI request failed.';
}

/** Compact deal snapshot sent as context (the gateway also loads the row + contact server-side when dealId is a saved deal). */
export function dealSnapshot(deal: Partial<Deal> | undefined | null): Record<string, unknown> | undefined {
  if (!deal) return undefined;
  return {
    id: deal.id, title: deal.title, company: deal.company, contact: deal.contact, value: deal.value, stage: deal.stage,
    probability: deal.probability, priority: deal.priority, dueDate: deal.dueDate, notes: deal.notes, tags: deal.tags,
  };
}

const isField = (f: unknown): f is EditableField => typeof f === 'string' && (EDITABLE_FIELDS as readonly string[]).includes(f);

/** Validate model output: drop malformed cards, unknown fields and cards without a usable value. */
export function normalizeSuggestions(raw: unknown): AssistantSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: AssistantSuggestion[] = [];
  raw.forEach((r: any, i) => {
    if (!r || typeof r.title !== 'string' || !r.title.trim()) return;
    const kind: SuggestionKind = r.kind === 'field_edit' ? 'field_edit' : 'next_step';
    const base = { id: typeof r.id === 'string' && r.id ? r.id : `s${i}`, kind, title: r.title.trim(), rationale: typeof r.rationale === 'string' ? r.rationale : '' };
    if (kind === 'field_edit') {
      if (!isField(r.field) || typeof r.value !== 'string') return;
      const card: AssistantSuggestion = { ...base, field: r.field, value: r.value };
      if (!suggestionToUpdates(card)) return;
      out.push(card);
    } else {
      out.push({ ...base, field: null, value: null });
    }
  });
  // unique ids
  const seen = new Set<string>();
  return out.map((s, i) => {
    let id = s.id;
    while (seen.has(id)) id = `${s.id}-${i}`;
    seen.add(id);
    return { ...s, id };
  });
}

/** Convert a field_edit suggestion into a Partial<Deal>; null when the value is invalid. */
export function suggestionToUpdates(s: AssistantSuggestion): Partial<Deal> | null {
  if (s.kind !== 'field_edit' || !s.field || s.value === null) return null;
  const v = s.value.trim();
  switch (s.field) {
    case 'title':
    case 'notes':
      return v ? ({ [s.field]: v } as Partial<Deal>) : null;
    case 'value': {
      const n = Number(v.replace(/[$,\s]/g, ''));
      return Number.isFinite(n) && n >= 0 ? { value: n } : null;
    }
    case 'probability': {
      const n = Number(v.replace('%', ''));
      return Number.isFinite(n) && n >= 0 && n <= 100 ? { probability: Math.round(n) } : null;
    }
    case 'priority': {
      const p = v.toLowerCase();
      return p === 'high' || p === 'medium' || p === 'low' ? { priority: p } : null;
    }
    case 'dueDate': {
      if (!/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : { dueDate: d };
    }
    case 'tags': {
      const tags = v.split(',').map(t => t.trim()).filter(Boolean);
      return tags.length ? { tags } : null;
    }
    default:
      return null;
  }
}

/** Current value of the field on the deal, formatted for the "before -> after" display. */
export function currentFieldValue(deal: Partial<Deal> | undefined, field: EditableField): string {
  if (!deal) return '';
  const v: any = (deal as any)[field];
  if (v === undefined || v === null || v === '') return '(empty)';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function transcript(history: ChatTurn[], message: string): string {
  const lines = history.slice(-10).map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`);
  return [lines.length ? `Conversation so far:\n${lines.join('\n')}` : '', `Latest user message: ${message}`, 'Respond as JSON.'].filter(Boolean).join('\n\n');
}

export async function askDealAssistant(args: {
  dealId: string;
  deal?: Partial<Deal> | null;
  history: ChatTurn[];
  message: string;
  signal?: AbortSignal;
}): Promise<AssistantReply> {
  const res = await callAI<{ reply?: string; suggestions?: unknown }>('deal_assistant', {
    input: transcript(args.history, args.message),
    ...(canUseRemote(args.dealId) ? { dealId: args.dealId } : {}),
    context: { deal_snapshot: dealSnapshot(args.deal) },
    signal: args.signal,
  });
  const data = res.data ?? {};
  return {
    reply: (typeof data.reply === 'string' && data.reply.trim()) || res.text || 'I could not produce an answer for that.',
    suggestions: normalizeSuggestions(data.suggestions),
  };
}

/** Apply an accepted field_edit through the supplied updater (dealStore.updateDeal). Only call from a user click. */
export async function applySuggestion(
  dealId: string,
  s: AssistantSuggestion,
  updateDeal: (id: string, updates: Partial<Deal>) => Promise<unknown>,
): Promise<void> {
  const updates = suggestionToUpdates(s);
  if (!updates) throw new Error('This suggestion is not an applicable field edit.');
  await updateDeal(dealId, updates);
}

// ---------------------------------------------------------------------------
// Shared analysis (summary / next best action / insights)
// ---------------------------------------------------------------------------

export interface DealAnalysis {
  insights?: string[];
  risks?: string[];
  recommendations?: string[];
  suggestedNextSteps?: string[];
  probability?: number;
  confidence?: number;
  notes?: string;
}

export type AnalysisMode = 'summary' | 'next' | 'insights';

const PROMPTS: Record<AnalysisMode, string> = {
  summary: 'Summarize this deal for a colleague in 3-5 sentences: where it stands, key stakeholders, open risks. Put the summary in "notes" and 3-5 key points in "insights". Respond in JSON.',
  next: 'What is the single best next action for this deal? Put it in "suggestedNextSteps" (max 3, most important first, each one concrete and time-bound) with the reasoning in "recommendations". Respond in JSON.',
  insights: 'Analyze this deal using the CRM context. Return insights, risks, recommendations, suggestedNextSteps, probability and confidence. Only state what the data supports. Respond in JSON.',
};

export async function analyzeDeal(dealId: string, mode: AnalysisMode, deal?: Partial<Deal> | null, signal?: AbortSignal): Promise<{ data: DealAnalysis; text: string }> {
  const res = await callAI<DealAnalysis>('deal_analyze', {
    input: PROMPTS[mode],
    instructions: PROMPTS[mode],
    ...(canUseRemote(dealId) ? { dealId } : {}),
    context: { deal_snapshot: dealSnapshot(deal) },
    signal,
  });
  return { data: res.data ?? {}, text: res.text };
}

// ---- cached last insights result (per browser) ----
export interface CachedInsights { at: string; data: DealAnalysis }
const cacheKey = (dealId: string) => `deal-insights:${dealId}`;

export function readCachedInsights(dealId: string): CachedInsights | null {
  try {
    const raw = localStorage.getItem(cacheKey(dealId));
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && typeof p.at === 'string' && p.data ? (p as CachedInsights) : null;
  } catch {
    return null;
  }
}

export function writeCachedInsights(dealId: string, data: DealAnalysis): CachedInsights {
  const entry: CachedInsights = { at: new Date().toISOString(), data };
  try { localStorage.setItem(cacheKey(dealId), JSON.stringify(entry)); } catch { /* storage unavailable */ }
  return entry;
}

/** Fetch fresh insights and cache them. */
export async function refreshInsights(dealId: string, deal?: Partial<Deal> | null, signal?: AbortSignal): Promise<CachedInsights> {
  const { data } = await analyzeDeal(dealId, 'insights', deal, signal);
  return writeCachedInsights(dealId, data);
}
