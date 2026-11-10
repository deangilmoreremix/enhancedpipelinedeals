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
