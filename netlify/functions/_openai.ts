/**
 * Shared OpenAI Responses API helper for all Netlify functions.
 *
 * - Uses `client.responses.create` (NOT Chat Completions).
 * - One place for the model tiers; override with env vars.
 * - Applies the rules for the GPT-6 family: no `temperature`/`top_p`/`logprobs`
 *   when reasoning effort is not `none`; `gpt-6-astra` / `gpt-6.1-sol` don't
 *   support effort `none` (mapped to `low`); `minimal` is mapped to `low`.
 */
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export type Tier = 'fast' | 'default' | 'deep';
export type Effort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const MODEL_TIERS: Record<Tier, { model: string; effort: Effort }> = {
  fast: { model: process.env.OPENAI_MODEL_FAST || 'gpt-6-luna', effort: 'none' },
  default: { model: process.env.OPENAI_MODEL_DEFAULT || 'gpt-6.1-sol', effort: 'medium' },
  deep: { model: process.env.OPENAI_MODEL_DEEP || 'gpt-6-astra', effort: 'high' },
};

/** Models that reject reasoning effort `none`. */
const NO_NONE_EFFORT = (model: string) => /^gpt-6(\.\d+)?-(astra|sol)/.test(model);

let _client: OpenAI | null = null;
export function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured on the server');
  }
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export function resolveTier(tierOrModel?: string): { model: string; effort: Effort } {
  if (tierOrModel && tierOrModel in MODEL_TIERS) return MODEL_TIERS[tierOrModel as Tier];
  if (tierOrModel && /^gpt-/.test(tierOrModel)) {
    return { model: tierOrModel, effort: NO_NONE_EFFORT(tierOrModel) ? 'low' : 'none' };
  }
  return MODEL_TIERS.default;
}

export function normalizeEffort(model: string, effort: string | undefined): Effort {
  let e = (effort || 'medium') as string;
  if (e === 'minimal') e = 'low';
  if (e === 'none' && NO_NONE_EFFORT(model)) e = 'low';
  return e as Effort;
}

export interface RespondOptions {
  /** Tier name (`fast` | `default` | `deep`) or an explicit model id. */
  tier?: string;
  effort?: Effort;
  instructions?: string;
  /** String or Responses input items. */
  input: string | any[];
  maxOutputTokens?: number;
  /** Only sent when effort is `none` (otherwise the API rejects it). */
  temperature?: number;
  /** Strict structured output. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  /** Free-form JSON object output (prompt must mention JSON). */
  jsonObject?: boolean;
  tools?: any[];
  toolChoice?: any;
  previousResponseId?: string;
  /** Extra output to include, e.g. 'web_search_call.action.sources'. */
  include?: string[];
  store?: boolean;
  metadata?: Record<string, string>;
}

export function buildParams(opts: RespondOptions): Record<string, any> {
  const base = resolveTier(opts.tier);
  const effort = normalizeEffort(base.model, opts.effort ?? base.effort);
  const params: Record<string, any> = {
    model: base.model,
    input: opts.input,
    reasoning: { effort },
    store: opts.store ?? false,
  };
  if (opts.instructions) params.instructions = opts.instructions;
  if (opts.maxOutputTokens) params.max_output_tokens = opts.maxOutputTokens;
  if (effort === 'none' && typeof opts.temperature === 'number') params.temperature = opts.temperature;
  if (opts.tools?.length) params.tools = opts.tools;
  if (opts.toolChoice) params.tool_choice = opts.toolChoice;
  if (opts.previousResponseId) params.previous_response_id = opts.previousResponseId;
  if (opts.include?.length) params.include = opts.include;
  if (opts.metadata) params.metadata = opts.metadata;
  if (opts.jsonSchema) {
    params.text = {
      format: { type: 'json_schema', name: opts.jsonSchema.name, strict: true, schema: opts.jsonSchema.schema },
    };
  } else if (opts.jsonObject) {
    params.text = { format: { type: 'json_object' } };
  }
  return params;
}

export interface RespondResult {
  text: string;
  json?: any;
  model: string;
  id: string;
  usage?: any;
  output: any[];
  /** Web sources: url_citation annotations + every URL the web_search tool consulted. */
  citations: Array<{ url: string; title: string | null }>;
}

function parseJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fallthrough */
      }
    }
    return undefined;
  }
}

/** Collects url_citation annotations and web_search sources from a response's output items. */
export function extractCitations(output: any[]): Array<{ url: string; title: string | null }> {
  const seen = new Map<string, string | null>();
  for (const item of output ?? []) {
    if (item.type === 'message') {
      for (const part of item.content ?? []) {
        for (const a of part.annotations ?? []) {
          if (a.type === 'url_citation' && a.url) seen.set(a.url, a.title ?? seen.get(a.url) ?? null);
        }
      }
    } else if (item.type === 'web_search_call') {
      for (const src of item.action?.sources ?? []) {
        if (src.url && !seen.has(src.url)) seen.set(src.url, src.title ?? null);
      }
    }
  }
  return [...seen].map(([url, title]) => ({ url, title }));
}

/** Single Responses API call. */
export async function respond(opts: RespondOptions): Promise<RespondResult> {
  const res: any = await getClient().responses.create(buildParams(opts) as any);
  if (res.status === 'failed' || res.error) {
    throw new Error(res.error?.message || 'OpenAI response failed');
  }
  const text: string = res.output_text ?? '';
  const wantsJSON = Boolean(opts.jsonSchema || opts.jsonObject);
  return {
    text,
    json: wantsJSON ? parseJSON(text) : undefined,
    model: res.model,
    id: res.id,
    usage: res.usage,
    output: res.output ?? [],
    citations: extractCitations(res.output ?? []),
  };
}

/**
 * Streaming Responses call. Yields text deltas; resolves final text when done.
 * Branches on typed events (`response.output_text.delta`, `response.completed`, `error`).
 */
export async function* respondStream(opts: RespondOptions): AsyncGenerator<string, void, void> {
  const stream: any = await getClient().responses.create({ ...buildParams(opts), stream: true } as any);
  for await (const event of stream) {
    if (event.type === 'response.output_text.delta') {
      yield event.delta as string;
    } else if (event.type === 'error') {
      throw new Error(event.message || 'OpenAI stream error');
    } else if (event.type === 'response.failed') {
      throw new Error(event.response?.error?.message || 'OpenAI response failed');
    }
  }
}

export type ToolHandlers = Record<string, (args: any) => Promise<unknown> | unknown>;

/**
 * Tool loop for function calling. Tools use the flat Responses shape:
 * `{ type: 'function', name, description, parameters }`. Results go back as
 * `function_call_output` items linked by `call_id`; reasoning items are kept.
 */
export async function respondWithTools(
  opts: RespondOptions & { handlers: ToolHandlers; maxTurns?: number },
): Promise<RespondResult> {
  const { handlers, maxTurns = 6, ...base } = opts;
  let input: any[] = typeof base.input === 'string' ? [{ role: 'user', content: base.input }] : [...base.input];
  let last: RespondResult | undefined;

  for (let turn = 0; turn < maxTurns; turn++) {
    last = await respond({ ...base, input });
    const calls = last.output.filter((i: any) => i.type === 'function_call');
    if (!calls.length) return last;

    input = [...input, ...last.output];
    for (const call of calls) {
      let result: unknown;
      try {
        const fn = handlers[call.name];
        if (!fn) throw new Error(`Unknown tool: ${call.name}`);
        result = await fn(JSON.parse(call.arguments || '{}'));
      } catch (e: any) {
        result = { error: e?.message || String(e) };
      }
      input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
    }
  }
  if (!last) throw new Error('No response');
  return last;
}

// ---------------------------------------------------------------------------
// HTTP helpers shared by function handlers
// ---------------------------------------------------------------------------

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }, body: JSON.stringify(body) };
}

// --- auth: a valid Supabase user JWT, or the project's anon key (app supports anon access) ---
export async function authorize(header: string | undefined): Promise<boolean> {
  if (process.env.AI_GATEWAY_ALLOW_UNAUTHENTICATED === 'true') return true;
  const token = (header || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (anon && token === anon) return true;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || anon;
  if (!url || !key) return false;
  try {
    const { data, error } = await createClient(url, key).auth.getUser(token);
    return !error && Boolean(data.user);
  } catch {
    return false;
  }
}

/** uuid-shaped placeholder for unauthenticated demo / anon-key callers (calendar_events.created_by is a uuid column). */
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Who is calling? Resolves the verified Supabase user from the Authorization header ({ id } of the JWT's user).
 * The project's anon key (or AI_GATEWAY_ALLOW_UNAUTHENTICATED=true) maps to the shared demo user {@link DEMO_USER_ID}.
 * Returns null when the caller cannot be identified. Never trust a user id sent in a request body: use this instead.
 */
export async function authUser(header: string | undefined): Promise<{ id: string; demo?: boolean } | null> {
  const token = (header || '').replace(/^Bearer\s+/i, '').trim();
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (token && anon && token === anon) return { id: DEMO_USER_ID, demo: true };
  if (token) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || anon;
    if (url && key) {
      try {
        const { data, error } = await createClient(url, key).auth.getUser(token);
        if (!error && data.user?.id) return { id: data.user.id };
      } catch {
        /* fall through */
      }
    }
  }
  if (process.env.AI_GATEWAY_ALLOW_UNAUTHENTICATED === 'true') return { id: DEMO_USER_ID, demo: true };
  return null;
}

// --- tiny in-memory rate limit (per warm instance) ---
const hits = new Map<string, number[]>();
export function rateLimited(id: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(id) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(id, arr);
  return arr.length > limit;
}

