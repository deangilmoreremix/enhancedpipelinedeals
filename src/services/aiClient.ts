/**
 * Browser client for the server-side Responses API gateway
 * (netlify/functions/ai-gateway.ts). No OpenAI key ever reaches the browser.
 */
import { supabase } from '../lib/core/supabaseClient';
import { isDemoMode } from '../config/demoMode';

export type AITask =
  | 'chat'
  | 'contact_analyze'
  | 'lead_score'
  | 'email_compose'
  | 'web_research'
  | 'enrichment'
  | 'contact_public_enrichment'
  | 'company_public_enrichment'
  | 'social_discovery'
  | 'deal_analyze'
  | 'deal_automation'
  | 'contact_automation'
  | 'sales_coach'
  | 'transform_email'
  | 'case_study'
  | 'cta'
  | 'deal_risk'
  | 'playbooks'
  | 'video_script';

export interface AIToolCall {
  call_id: string;
  name: string;
  arguments: any;
}

export interface AICallOptions {
  input?: string | any[];
  messages?: Array<{ role: string; content: string }>;
  instructions?: string;
  context?: unknown;
  /** The gateway loads these rows from Supabase and adds them to the prompt context. */
  contactId?: string;
  dealId?: string;
  /** Web search bias: { country: 'US', city?, region?, timezone? } */
  userLocation?: { country?: string; city?: string; region?: string; timezone?: string };
  tier?: 'fast' | 'default' | 'deep' | string;
  effort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxOutputTokens?: number;
  temperature?: number;
  /** `chat` only: request a JSON object (instructions must mention JSON). */
  json?: boolean;
  /** Flat Responses function tools: { type:'function', name, description, parameters }. Executed by the caller. */
  tools?: any[];
  toolChoice?: any;
  /** Continue a stored response (send `function_call_output` items as `input`). */
  previousResponseId?: string;
  store?: boolean;
  signal?: AbortSignal;
}

export interface AIResult<T = any> {
  ok: boolean;
  task: string;
  model: string;
  id: string;
  /** Final text (`output_text`). */
  text: string;
  /** Parsed JSON for structured / json_object tasks. */
  data: T | null;
  usage: unknown;
  /** Function calls the model requested (execute, then continue with function_call_output). */
  tool_calls: AIToolCall[];
  /** Web sources used (url_citation annotations + consulted URLs) for search-backed tasks. */
  citations: Array<{ url: string; title: string | null }>;
}

export const AI_GATEWAY_URL: string =
  (import.meta as any).env?.VITE_AI_GATEWAY_URL || '/.netlify/functions/ai-gateway';

/** fetch() with the Supabase bearer token attached (for Netlify function calls). */
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const auth = await authHeader();
  if (auth.Authorization && !headers.has('Authorization')) headers.set('Authorization', auth.Authorization);
  return fetch(input, { ...init, headers });
}

export async function authHeader(): Promise<Record<string, string>> {
  let token: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  } catch {
    /* not signed in */
  }
  // Connected mode: functions require a real user JWT. The anon key is only a demo/unconfigured fallback.
  if (!token && isDemoMode()) token = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class AIGatewayError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'AIGatewayError';
  }
}

export async function callAI<T = any>(task: AITask | string, opts: AICallOptions = {}): Promise<AIResult<T>> {
  const { signal, ...payload } = opts;
  const res = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ task, ...payload }),
    signal,
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new AIGatewayError(body.error || res.statusText || 'AI request failed', res.status);
  }
  return body as AIResult<T>;
}

/** Streams `chat` output. The gateway sends SSE `data: {"delta": "..."}` frames. */
export async function streamAI(
  opts: AICallOptions,
  onDelta: (delta: string) => void,
): Promise<string> {
  const { signal, ...payload } = opts;
  const res = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ task: 'chat', stream: true, ...payload }),
    signal,
  });
  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}));
    throw new AIGatewayError(body.error || res.statusText, res.status);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new AIGatewayError('Streaming not supported by this browser');
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const line = frame.replace(/^data:\s*/, '').trim();
      if (!line || line === '[DONE]') continue;
      try {
        const { delta } = JSON.parse(line);
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        /* ignore malformed frame */
      }
    }
  }
  return full;
}
