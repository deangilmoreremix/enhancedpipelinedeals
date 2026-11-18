import { callAI, AIGatewayError } from './aiClient';
import { useDealStore } from '../store/dealStore';
import { captureFields, pushUndo, restoreFields, undoableMoveDeal } from './undoService';
import type { Deal } from '../types';
import type { EntityKind, PermissionAction, PermissionResult } from './permissionService';

/**
 * Workspace AI chat. Request/response through the gateway task `workspace_chat` (read-only on the server).
 * The model only PROPOSES changes; nothing is applied until the user presses Apply, and every apply goes through the
 * normal stores/services with a permission check and an Undo toast.
 */
export type ProposalKind = 'update_deal' | 'move_deal' | 'create_task' | 'create_note';
export const PROPOSAL_KINDS: readonly ProposalKind[] = ['update_deal', 'move_deal', 'create_task', 'create_note'];

export interface Proposal {
  id: string;
  kind: ProposalKind;
  dealId: string;
  patch?: Record<string, unknown> | null;
  stage?: string | null;
  title?: string | null;
  body?: string | null;
  reason: string;
}

export interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; proposals?: Proposal[]; error?: boolean }
export interface ChatReply { reply: string; proposals: Proposal[] }

const MAX_HISTORY = 20;

/** Drops malformed proposals (unknown kind, missing deal id) and de-duplicates ids. */
export function normalizeProposals(raw: unknown): Proposal[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Proposal[] = [];
  raw.forEach((r: any, i) => {
    if (!r || !PROPOSAL_KINDS.includes(r.kind) || typeof r.dealId !== 'string' || !r.dealId) return;
    let id = typeof r.id === 'string' && r.id ? r.id : `p${i}`;
    while (seen.has(id)) id = `${id}_${i}`;
    seen.add(id);
    out.push({ id, kind: r.kind, dealId: r.dealId, patch: r.patch && typeof r.patch === 'object' ? r.patch : null, stage: r.stage ?? null, title: r.title ?? null, body: r.body ?? null, reason: String(r.reason ?? '') });
  });
  return out;
}

/** Human message for a gateway failure (explicit down / auth / rate-limit states). */
export function chatErrorMessage(e: unknown): string {
  if (e instanceof AIGatewayError) {
    if (e.status === 401 || e.status === 403) return 'You are not signed in to the AI gateway. Sign in and try again.';
    if (e.status === 429) return 'The AI gateway is rate limiting requests. Wait a moment and try again.';
    if (e.status === 404 || e.status === 502 || e.status === 503 || e.status === 504) return 'The AI gateway is unavailable right now. Try again later.';
    return `The AI gateway returned an error: ${e.message}`;
  }
  if (e instanceof TypeError || (e as any)?.name === 'TypeError') return 'Could not reach the AI gateway. Check your connection and try again.';
  return e instanceof Error ? e.message : 'The AI request failed.';
}

export async function sendChat(history: ChatMessage[], opts: { dealId?: string | null; signal?: AbortSignal } = {}): Promise<ChatReply> {
  const messages = history.filter(m => !m.error).slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content }));
  const r = await callAI<{ reply?: string; proposals?: unknown }>('workspace_chat', {
    messages, context: opts.dealId ? { dealId: opts.dealId } : undefined, signal: opts.signal,
  });
  const reply = (r.data?.reply ?? r.text ?? '').toString();
  if (!reply && !r.data) throw new Error('The assistant returned an empty answer.');
  return { reply: reply || 'No answer.', proposals: normalizeProposals(r.data?.proposals) };
}

// ---- describing + applying ------------------------------------------------------------------------------------
const dealName = (d?: Deal): string => d?.title || d?.company || 'deal';

export function describeProposal(p: Proposal, deals: Record<string, Deal>, stages: Array<{ key: string; name: string }>): string {
  const d = deals[p.dealId];
  const n = dealName(d);
  switch (p.kind) {
    case 'move_deal': return `Move ${n} to ${stages.find(s => s.key === p.stage)?.name ?? p.stage ?? '?'}`;
    case 'update_deal': {
      const fields = Object.entries(p.patch ?? {}).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => `${k.replace(/_/g, ' ')} to ${String(v)}`);
      return `Update ${n}${fields.length ? `: ${fields.join(', ')}` : ''}`;
    }
    case 'create_task': return `Create task "${p.title ?? 'Follow up'}" on ${n}`;
    case 'create_note': return `Add a note to ${n}`;
  }
}

/** snake_case patch from the gateway -> Deal updates (nulls = "leave unchanged"). Returns the updates and rejected field names. */
export function patchToUpdates(patch: Record<string, unknown> | null | undefined): { updates: Partial<Deal>; ignored: string[] } {
  const updates: Partial<Deal> = {}; const ignored: string[] = [];
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v === null || v === undefined || v === '') continue;
    switch (k) {
      case 'title': case 'notes': (updates as any)[k] = String(v); break;
      case 'value': { const n = Number(v); if (Number.isFinite(n) && n >= 0) updates.value = n; else ignored.push(k); break; }
      case 'probability': { const n = Number(v); if (Number.isFinite(n) && n >= 0 && n <= 100) updates.probability = n; else ignored.push(k); break; }
      case 'priority': if (v === 'high' || v === 'medium' || v === 'low') updates.priority = v; else ignored.push(k); break;
      case 'due_date': case 'close_date': {
        const dt = new Date(String(v));
        if (Number.isNaN(dt.getTime())) ignored.push(k); else (updates as any)[k === 'due_date' ? 'dueDate' : 'closeDate'] = dt;
        break;
      }
      default: ignored.push(k);
    }
  }
  return { updates, ignored };
}

export interface ApplyDeps { can: (action: PermissionAction, kind: EntityKind, record?: Deal | null) => PermissionResult }
export interface ApplyResult { ok: boolean; message: string }

const toDoc = (text: string) => ({ type: 'doc', content: text.split(/\n+/).filter(Boolean).map(line => ({ type: 'paragraph', content: [{ type: 'text', text: line }] })) });

/** Applies one proposal through the existing stores/services. Never throws; the result carries the message. */
export async function applyProposal(p: Proposal, deps: ApplyDeps): Promise<ApplyResult> {
  const store = useDealStore.getState();
  const deal = store.deals[p.dealId];
  if (!deal) return { ok: false, message: 'That deal no longer exists.' };
  const n = dealName(deal);
  try {
    if (p.kind === 'update_deal') {
      const perm = deps.can('edit', 'deal', deal);
      if (!perm.allowed) return { ok: false, message: perm.reason };
      const { updates, ignored } = patchToUpdates(p.patch);
      const keys = Object.keys(updates) as Array<keyof Deal>;
      if (keys.length === 0) return { ok: false, message: ignored.length ? `Nothing valid to change (ignored: ${ignored.join(', ')}).` : 'Nothing to change.' };
      const prev = captureFields([deal.id], keys);
      await store.updateDeal(deal.id, updates);
      pushUndo({ label: `AI update applied to ${n}`, undo: () => restoreFields(prev) });
      return { ok: true, message: `Updated ${n}` };
    }
    if (p.kind === 'move_deal') {
      const perm = deps.can('edit', 'deal', deal);
      if (!perm.allowed) return { ok: false, message: perm.reason };
      const stage = store.stages.find(s => s.key === p.stage);
      if (!stage) return { ok: false, message: `Unknown stage "${p.stage ?? ''}".` };
      if (deal.stage === stage.key) return { ok: false, message: `${n} is already in ${stage.name}.` };
      const pos = Object.values(store.deals).filter(d => d.stage === stage.key).reduce((m, d) => Math.max(m, d.position ?? 0), 0) + 1;
      const ok = await undoableMoveDeal(deal.id, stage.key, pos); // pushes its own Undo
      return ok ? { ok: true, message: `Moved ${n} to ${stage.name}` } : { ok: false, message: 'The move failed.' };
    }
    if (p.kind === 'create_task') {
      const perm = deps.can('create', 'task', deal);
      if (!perm.allowed) return { ok: false, message: perm.reason };
      const title = (p.title || '').trim();
      if (!title) return { ok: false, message: 'The task has no title.' };
      const { createTask, deleteTask } = await import('./dealTasksService');
      const due = p.patch && typeof p.patch.due_date === 'string' ? p.patch.due_date : null;
      const t = await createTask(deal.id, { title, notes: p.body ?? null, dueDate: due });
      pushUndo({ label: `AI task "${title}" created`, undo: () => deleteTask(deal.id, t.id) });
      return { ok: true, message: `Task created on ${n}` };
    }
    // create_note
    const perm = deps.can('create', 'note', deal);
    if (!perm.allowed) return { ok: false, message: perm.reason };
    const text = (p.body || '').trim();
    if (!text) return { ok: false, message: 'The note is empty.' };
    const { createNote, deleteNote } = await import('./dealNotesService');
    const note = await createNote(deal.id, { title: p.title ?? null, body: toDoc(text), bodyText: text });
    pushUndo({ label: `AI note added to ${n}`, undo: () => deleteNote(deal.id, note.id) });
    return { ok: true, message: `Note added to ${n}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not apply the change.' };
  }
}
