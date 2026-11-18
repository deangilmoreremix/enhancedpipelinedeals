/**
 * ai-gateway task `workspace_chat`: a READ-ONLY assistant over the caller's CRM.
 * The model may call read tools (executed here through the caller's own Supabase client, so RLS applies) and answers with
 * { reply, proposals[] }. Proposals are suggestions the user must Apply in the UI; this module never writes anything.
 * Every proposal is validated against rows that were actually read in this request (deal ids, stage keys).
 */
import { respond, userClient } from './_openai';

type Obj = Record<string, unknown>;
const str = { type: 'string' };
const nullableStr = { type: ['string', 'null'] };
const nullableNum = { type: ['number', 'null'] };
const obj = (properties: Obj) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

export const PROPOSAL_KINDS = ['update_deal', 'move_deal', 'create_task', 'create_note'] as const;
export const PATCH_FIELDS = ['title', 'value', 'probability', 'priority', 'due_date', 'close_date', 'notes'] as const;

export const WORKSPACE_CHAT_SCHEMA = {
  name: 'workspace_chat',
  schema: obj({
    reply: str,
    proposals: {
      type: 'array',
      items: obj({
        id: str,
        kind: { type: 'string', enum: [...PROPOSAL_KINDS] },
        dealId: str,
        patch: obj({ title: nullableStr, value: nullableNum, probability: nullableNum, priority: nullableStr, due_date: nullableStr, close_date: nullableStr, notes: nullableStr }),
        stage: nullableStr,
        title: nullableStr,
        body: nullableStr,
        reason: str,
      }),
    },
  }),
};

export const WORKSPACE_CHAT_SYSTEM = `You are the workspace assistant of SmartCRM, a sales CRM. Answer questions about the user's pipeline, deals, contacts and companies. Be concrete, concise and factual. Never invent data: use the read tools (search_deals, get_deal, stale_deals, pipeline_summary, search_contacts, search_companies) and say "unknown" when the tools do not return it.
You can only READ. You cannot change anything. When a change would help, PROPOSE it in "proposals" (max 5): the user reviews each proposal and must press Apply themselves. Never claim that you changed, moved, created or saved anything.
Each proposal: id (short unique slug), kind (update_deal | move_deal | create_task | create_note), dealId (an id returned by a tool in this conversation, never a guess), reason (one sentence citing the data). For update_deal fill "patch" with only the fields to change (title, value, probability 0-100, priority high|medium|low, due_date / close_date YYYY-MM-DD, notes) and leave the others null. For move_deal set "stage" to an existing stage key seen in the data. For create_task set "title" (and optionally "body" and a due date in patch.due_date). For create_note set "body". Unused fields are null. Return an empty proposals array when nothing should change. Reply in plain text; keep it under 1500 characters.`;

// ---- tools ------------------------------------------------------------------------------------------------------------
export const WORKSPACE_TOOLS = [
  { type: 'function', name: 'search_deals', description: 'Search open or closed deals by text (title, company, contact name) and optional stage key.', strict: true,
    parameters: obj({ query: str, stage: nullableStr, limit: { type: ['integer', 'null'] } }) },
  { type: 'function', name: 'get_deal', description: 'Get one deal by id, including recent notes.', strict: true, parameters: obj({ id: str }) },
  { type: 'function', name: 'stale_deals', description: 'Open deals with no update for at least N days, oldest first.', strict: true, parameters: obj({ days: { type: 'integer' } }) },
  { type: 'function', name: 'pipeline_summary', description: 'Deal count and total value per pipeline stage.', strict: true, parameters: obj({}) },
  { type: 'function', name: 'search_contacts', description: 'Search contacts by name, email or company.', strict: true, parameters: obj({ query: str }) },
  { type: 'function', name: 'search_companies', description: 'Search companies by name or domain.', strict: true, parameters: obj({ query: str }) },
];

const DEAL_COLS = 'id,title,value,stage,priority,probability,close_date,due_date,company,contact,contact_id,company_id,updated_at';
const CLOSED_STAGES = '(closed-won,closed-lost,won,lost)';
const MAX_TOOL_ROUNDS = 5;
const MAX_CALLS_PER_ROUND = 6;
const MAX_TOOL_OUTPUT = 12_000;

const term = (q: unknown) => String(q ?? '').replace(/[^\p{L}\p{N}\s@.\-+_']/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
const clip = (v: unknown, n = 500) => (typeof v === 'string' && v.length > n ? `${v.slice(0, n)}…` : v);

export interface ReadState { dealIds: Set<string>; stages: Set<string> }

function runTools(db: NonNullable<ReturnType<typeof userClient>>, st: ReadState) {
  const note = (rows: any[]) => { for (const r of rows) { if (r?.id) st.dealIds.add(String(r.id)); if (r?.stage) st.stages.add(String(r.stage)); } return rows; };
  const lite = (r: any) => ({ ...r, notes: clip(r.notes) });
  return {
    async search_deals(a: any) {
      const limit = Math.min(Math.max(Number(a?.limit) || 10, 1), 25);
      let q = db.from('deals').select(DEAL_COLS).is('deleted_at', null);
      const t = term(a?.query);
      if (t) q = q.or(`title.ilike.%${t}%,company.ilike.%${t}%,contact.ilike.%${t}%`);
      if (typeof a?.stage === 'string' && a.stage) q = q.eq('stage', a.stage);
      const { data, error } = await q.order('updated_at', { ascending: false }).limit(limit);
      if (error) throw new Error(error.message);
      return { deals: note(data ?? []) };
    },
    async get_deal(a: any) {
      const { data, error } = await db.from('deals').select(`${DEAL_COLS},notes,tags`).eq('id', String(a?.id ?? '')).is('deleted_at', null).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return { deal: null };
      note([data]);
      return { deal: lite(data) };
    },
    async stale_deals(a: any) {
      const days = Math.min(Math.max(Math.floor(Number(a?.days) || 14), 1), 365);
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await db.from('deals').select(DEAL_COLS).is('deleted_at', null).not('stage', 'in', CLOSED_STAGES).lt('updated_at', cutoff).order('updated_at', { ascending: true }).limit(25);
      if (error) throw new Error(error.message);
      return { days, deals: note(data ?? []) };
    },
    async pipeline_summary() {
      const { data, error } = await db.from('deals').select('stage,value').is('deleted_at', null).limit(2000);
      if (error) throw new Error(error.message);
      const by = new Map<string, { stage: string; count: number; total_value: number }>();
      for (const r of (data ?? []) as any[]) {
        const k = String(r.stage ?? 'unknown');
        st.stages.add(k);
        const e = by.get(k) ?? { stage: k, count: 0, total_value: 0 };
        e.count++; e.total_value += Number(r.value) || 0;
        by.set(k, e);
      }
      return { stages: [...by.values()], deals_counted: (data ?? []).length };
    },
    async search_contacts(a: any) {
      const t = term(a?.query);
      let q = db.from('contacts').select('id,name,email,company,title,status').limit(10);
      if (t) q = q.or(`name.ilike.%${t}%,email.ilike.%${t}%,company.ilike.%${t}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { contacts: data ?? [] };
    },
    async search_companies(a: any) {
      const t = term(a?.query);
      let q = db.from('companies').select('id,name,domain,industry,size').is('deleted_at', null).limit(10);
      if (t) q = q.or(`name.ilike.%${t}%,domain.ilike.%${t}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { companies: data ?? [] };
    },
  } as Record<string, (a: any) => Promise<unknown>>;
}

// ---- input / output ---------------------------------------------------------------------------------------------------
export function cleanMessages(raw: unknown): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const m of raw.slice(-30)) {
    if (!m || typeof m !== 'object') continue;
    const role = (m as any).role === 'assistant' ? 'assistant' : (m as any).role === 'user' ? 'user' : null;
    const content = typeof (m as any).content === 'string' ? (m as any).content.trim().slice(0, 4000) : '';
    if (role && content) out.push({ role, content });
  }
  return out;
}

const s = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v));

/** Validates the model's proposals against what was actually read; drops anything invalid. Pure. */
export function validateProposals(raw: unknown, st: ReadState): Obj[] {
  if (!Array.isArray(raw)) return [];
  const out: Obj[] = [];
  const ids = new Set<string>();
  for (const p of raw as any[]) {
    if (out.length >= 5) break;
    if (!p || typeof p !== 'object' || !PROPOSAL_KINDS.includes(p.kind)) continue;
    const dealId = s(p.dealId, 100);
    if (!dealId || !st.dealIds.has(dealId)) continue;
    const reason = s(p.reason, 400);
    if (!reason) continue;
    let id = (s(p.id, 40) ?? `p${out.length + 1}`).replace(/[^\w-]/g, '-');
    while (ids.has(id)) id += '-x';
    const item: Obj = { id, kind: p.kind, dealId, reason };
    if (p.kind === 'update_deal') {
      const patch: Obj = {};
      const src = p.patch ?? {};
      for (const f of PATCH_FIELDS) {
        const v = src[f];
        if (v === null || v === undefined) continue;
        if (f === 'value') { if (typeof v === 'number' && Number.isFinite(v) && v >= 0) patch.value = v; }
        else if (f === 'probability') { if (typeof v === 'number' && v >= 0 && v <= 100) patch.probability = v; }
        else if (f === 'priority') { if (['high', 'medium', 'low'].includes(v)) patch.priority = v; }
        else if (f === 'due_date' || f === 'close_date') { if (typeof v === 'string' && isDate(v)) patch[f] = v.slice(0, 10); }
        else { const t = s(v, f === 'notes' ? 4000 : 200); if (t) patch[f] = t; }
      }
      if (!Object.keys(patch).length) continue;
      item.patch = patch;
    } else if (p.kind === 'move_deal') {
      const stage = s(p.stage, 60);
      if (!stage || !st.stages.has(stage)) continue;
      item.stage = stage;
    } else if (p.kind === 'create_task') {
      const title = s(p.title, 200);
      if (!title) continue;
      item.title = title;
      const body = s(p.body, 2000); if (body) item.body = body;
      const due = p.patch?.due_date;
      if (typeof due === 'string' && isDate(due)) item.patch = { due_date: due.slice(0, 10) };
    } else {
      const body = s(p.body, 4000);
      if (!body) continue;
      item.body = body;
      const title = s(p.title, 200); if (title) item.title = title;
    }
    ids.add(id);
    out.push(item);
  }
  return out;
}

export interface WorkspaceChatResult { reply: string; proposals: Obj[]; model: string; id: string; usage: unknown; toolCalls: Array<{ name: string; arguments: unknown }> }

export async function runWorkspaceChat(opts: {
  authHeader: string | undefined;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  dealId?: string;
  tier: string;
  effort?: any;
  extraInstructions?: string;
  maxOutputTokens: number;
}): Promise<WorkspaceChatResult> {
  const db = userClient(opts.authHeader);
  if (!db) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY are not configured');
  const st: ReadState = { dealIds: new Set(), stages: new Set() };
  const handlers = runTools(db, st);

  let instructions = [WORKSPACE_CHAT_SYSTEM, opts.extraInstructions].filter(Boolean).join('\n\n');
  if (opts.dealId) {
    const r = await handlers.get_deal({ id: opts.dealId }).catch(() => null) as { deal: unknown } | null;
    if (r?.deal) instructions += `\n\nThe user is currently viewing this deal (CONTEXT, JSON):\n${JSON.stringify(r.deal)}`;
  }

  let input: any[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));
  const toolCalls: WorkspaceChatResult['toolCalls'] = [];
  let last: Awaited<ReturnType<typeof respond>> | undefined;
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const finalRound = round === MAX_TOOL_ROUNDS;
    last = await respond({
      tier: opts.tier, effort: opts.effort, instructions, input, maxOutputTokens: opts.maxOutputTokens,
      jsonSchema: WORKSPACE_CHAT_SCHEMA, tools: WORKSPACE_TOOLS, toolChoice: finalRound ? 'none' : undefined,
    });
    const calls = last.output.filter((i: any) => i.type === 'function_call');
    if (!calls.length || finalRound) break;
    input = [...input, ...last.output];
    for (const [i, call] of calls.entries()) {
      let result: unknown;
      if (i >= MAX_CALLS_PER_ROUND) result = { error: 'Too many tool calls in one step; ignored' };
      else {
        let args: any = {};
        try { args = JSON.parse(call.arguments || '{}'); } catch { /* keep {} */ }
        toolCalls.push({ name: call.name, arguments: args });
        try {
          const fn = handlers[call.name];
          if (!fn) throw new Error(`Unknown tool: ${call.name}`);
          result = await fn(args);
        } catch (e: any) {
          result = { error: e?.message || String(e) };
        }
      }
      let output = JSON.stringify(result);
      if (output.length > MAX_TOOL_OUTPUT) output = JSON.stringify({ truncated: true, partial: output.slice(0, MAX_TOOL_OUTPUT) });
      input.push({ type: 'function_call_output', call_id: call.call_id, output });
    }
  }
  if (!last) throw new Error('No response');
  const j = last.json && typeof last.json === 'object' ? (last.json as any) : null;
  const reply = (typeof j?.reply === 'string' ? j.reply : last.text || '').slice(0, 4000);
  return { reply, proposals: validateProposals(j?.proposals, st), model: last.model, id: last.id, usage: last.usage, toolCalls };
}
