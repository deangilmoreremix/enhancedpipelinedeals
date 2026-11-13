/**
 * Stub OpenAI HTTP server (node:http) speaking just enough of the REST API for the Netlify functions:
 *   POST /v1/responses          non-stream JSON + stream:true SSE (typed events), function_call / web_search_call / annotations
 *   POST /v1/moderations        flagged iff input contains FLAG_ME
 *   POST /v1/embeddings         deterministic 1536-d vector
 *   POST /v1/images/generations, /v1/images/edits   1x1 PNG b64_json
 *   POST /v1/audio/speech       mp3-ish bytes;  POST /v1/audio/transcriptions  { text, languages }
 *   POST /v1/realtime/client_secrets   { value, expires_at }
 *   POST /v1/conversations, POST|GET /v1/conversations/:id/items   enough for OpenAIConversationsSession
 *
 * Like the real API it REJECTS (400) requests that would be rejected upstream so handlers get exercised against the
 * same rules: invalid strict json_schema, `temperature` with reasoning.effort != none, effort `none` on
 * gpt-6-astra / gpt-6.1-sol, a json_object format without the word "JSON" in the input, non-flat function tools.
 *
 * Scenarios steer behaviour with:
 *   stub.script(fn)           fn(body, call) -> undefined | spec     (first matching script wins; one-shot unless sticky)
 *   spec = { text } | { output: [...items] } | { toolCall:{name,arguments} } | { http:{status,message} } | { streamError:'msg' }
 *   stub.requests('/v1/responses')  -> logged bodies for assertions
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { lintStrictSchema } from './schemaLint.mjs';

const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const NO_NONE = (m) => /^gpt-6(\.\d+)?-(astra|sol)/.test(m);

/** Build a value that satisfies a (strict) JSON schema so structured-output parsing can be exercised. */
export function sampleFromSchema(s, key = 'value') {
  if (!s) return null;
  if (s.anyOf) return sampleFromSchema(s.anyOf.find((x) => x.type !== 'null') ?? s.anyOf[0], key);
  const t = Array.isArray(s.type) ? s.type.find((x) => x !== 'null') ?? 'null' : s.type;
  if (s.enum) return s.enum[0];
  switch (t) {
    case 'object': return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, sampleFromSchema(v, k)]));
    case 'array': return [sampleFromSchema(s.items, key)];
    case 'string': return `stub ${key}`;
    case 'number': case 'integer': return 42;
    case 'boolean': return true;
    default: return null;
  }
}

export function createStubOpenAI({ port = 54401 } = {}) {
  const calls = [];
  const scripts = [];
  const conversations = new Map();
  const stub = {
    port,
    baseURL: `http://127.0.0.1:${port}/v1`,
    calls,
    script(fn, { sticky = false } = {}) { scripts.push({ fn, sticky }); return stub; },
    clearScripts() { scripts.length = 0; },
    reset() { calls.length = 0; scripts.length = 0; conversations.clear(); },
    requests(path) { return calls.filter((c) => !path || c.path === path); },
    last(path) { const r = stub.requests(path); return r[r.length - 1]; },
    async start() { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); },
    async stop() { await new Promise((r) => server.close(r)); },
  };

  const sendJSON = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'x-should-retry': 'false', ...headers });
    res.end(JSON.stringify(body));
  };
  const apiError = (res, status, message, param = null, code = null) =>
    sendJSON(res, status, { error: { message, type: status === 429 ? 'rate_limit_error' : status >= 500 ? 'server_error' : 'invalid_request_error', param, code } });

  const textOf = (v) => (typeof v === 'string' ? v : JSON.stringify(v ?? ''));

  function validateResponses(body) {
    const m = String(body.model || '');
    if (!m) return ['Missing required parameter: model'];
    const errs = [];
    const effort = body.reasoning?.effort;
    if (effort === 'none' && NO_NONE(m)) errs.push(`Unsupported value: 'reasoning.effort' does not support 'none' with model '${m}'.`);
    if (body.temperature !== undefined && /^gpt-6/.test(m) && effort && effort !== 'none') errs.push("Unsupported parameter: 'temperature' is not supported with this model when reasoning is enabled.");
    if (body.top_p !== undefined && /^gpt-6/.test(m) && effort && effort !== 'none') errs.push("Unsupported parameter: 'top_p' is not supported with this model when reasoning is enabled.");
    for (const t of body.tools ?? []) {
      if (t.type === 'function' && (!t.name || t.function)) errs.push(`Missing required parameter: 'tools[].name' (function tools must use the flat Responses shape, not {function:{...}})`);
    }
    const fmt = body.text?.format;
    if (fmt?.type === 'json_schema') {
      if (!fmt.name) errs.push("Missing required parameter: 'text.format.name'.");
      const problems = lintStrictSchema(fmt.schema);
      if (fmt.strict && problems.length) errs.push(`Invalid schema for response_format '${fmt.name}': ${problems.join('; ')}`);
    }
    if (fmt?.type === 'json_object' && !/json/i.test(JSON.stringify(body.input ?? '') + String(body.instructions ?? ''))) {
      errs.push("Response input messages must contain the word 'json' in some form to use 'text.format' of type 'json_object'.");
    }
    return errs;
  }

  /** Default behaviour when no script matches. */
  function defaultSpec(body) {
    const fmt = body.text?.format;
    const hasSearch = (body.tools ?? []).some((t) => t.type === 'web_search');
    let text;
    if (fmt?.type === 'json_schema') text = JSON.stringify(sampleFromSchema(fmt.schema));
    else if (fmt?.type === 'json_object') text = JSON.stringify({ ok: true, note: 'stub json object' });
    else text = 'Stub reply.';
    const output = [];
    if (hasSearch && body.tool_choice === 'required') {
      output.push({
        id: 'ws_1', type: 'web_search_call', status: 'completed',
        action: { type: 'search', query: 'stub query', sources: [{ type: 'url', url: 'https://example.com/profile' }, { type: 'url', url: 'https://example.org/news' }] },
      });
    }
    return { text, output, annotations: hasSearch ? [{ type: 'url_citation', url: 'https://example.com/profile', title: 'Profile', start_index: 0, end_index: 4 }] : [] };
  }

  function toOutput(spec, body) {
    if (spec.output) return spec.output;
    const items = [...(spec.output0 ?? [])];
    if (spec.toolCall) {
      const calls = Array.isArray(spec.toolCall) ? spec.toolCall : [spec.toolCall];
      for (const c of calls) {
        items.push({ id: `fc_${randomUUID().slice(0, 8)}`, type: 'function_call', status: 'completed', call_id: c.call_id ?? `call_${randomUUID().slice(0, 8)}`, name: c.name, arguments: typeof c.arguments === 'string' ? c.arguments : JSON.stringify(c.arguments ?? {}) });
      }
      return items;
    }
    const d = spec.text !== undefined ? { text: spec.text, output: spec.pre ?? [], annotations: spec.annotations ?? [] } : defaultSpec(body);
    return [
      ...d.output,
      { id: `msg_${randomUUID().slice(0, 8)}`, type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: d.text, annotations: d.annotations ?? [], logprobs: [] }] },
    ];
  }

  const responseObject = (body, output, status = 'completed') => ({
    id: `resp_${randomUUID().slice(0, 12)}`,
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    status,
    error: null,
    incomplete_details: null,
    model: body.model,
    output,
    output_text: output.filter((i) => i.type === 'message').flatMap((i) => i.content).filter((c) => c.type === 'output_text').map((c) => c.text).join(''),
    parallel_tool_calls: true,
    previous_response_id: body.previous_response_id ?? null,
    reasoning: { effort: body.reasoning?.effort ?? null, summary: null },
    store: body.store ?? true,
    temperature: body.temperature ?? 1,
    text: body.text ?? { format: { type: 'text' } },
    tool_choice: body.tool_choice ?? 'auto',
    tools: body.tools ?? [],
    top_p: 1,
    truncation: 'disabled',
    usage: { input_tokens: 11, input_tokens_details: { cached_tokens: 0 }, output_tokens: 7, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 18 },
    user: null,
    metadata: body.metadata ?? {},
  });

  function streamResponse(res, body, output, spec) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    let seq = 0;
    const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, sequence_number: seq++, ...data })}\n\n`);
    const resp = responseObject(body, [], 'in_progress');
    ev('response.created', { response: resp });
    ev('response.in_progress', { response: resp });
    if (spec.streamError) {
      ev('error', { code: 'server_error', message: spec.streamError, param: null });
      return res.end();
    }
    output.forEach((item, oi) => {
      if (item.type === 'message') {
        ev('response.output_item.added', { output_index: oi, item: { ...item, content: [], status: 'in_progress' } });
        item.content.forEach((part, ci) => {
          ev('response.content_part.added', { item_id: item.id, output_index: oi, content_index: ci, part: { ...part, text: '' } });
          const t = part.text;
          const n = Math.max(1, Math.ceil(t.length / 3));
          const chunks = [t.slice(0, n), t.slice(n, 2 * n), t.slice(2 * n)].filter(Boolean);
          for (const c of chunks) ev('response.output_text.delta', { item_id: item.id, output_index: oi, content_index: ci, delta: c, logprobs: [] });
          ev('response.output_text.done', { item_id: item.id, output_index: oi, content_index: ci, text: t, logprobs: [] });
          ev('response.content_part.done', { item_id: item.id, output_index: oi, content_index: ci, part });
        });
        ev('response.output_item.done', { output_index: oi, item });
      } else if (item.type === 'function_call') {
        ev('response.output_item.added', { output_index: oi, item: { ...item, arguments: '', status: 'in_progress' } });
        ev('response.function_call_arguments.delta', { item_id: item.id, output_index: oi, delta: item.arguments });
        ev('response.function_call_arguments.done', { item_id: item.id, output_index: oi, name: item.name, arguments: item.arguments });
        ev('response.output_item.done', { output_index: oi, item });
      } else {
        ev('response.output_item.added', { output_index: oi, item });
        ev('response.output_item.done', { output_index: oi, item });
      }
    });
    ev('response.completed', { response: responseObject(body, output) });
    res.end();
  }

  function multipartInfo(buf, ctype) {
    const b = /boundary=(.+)$/.exec(ctype)?.[1];
    if (!b) return {};
    const fields = {}, files = [];
    for (const part of buf.toString('latin1').split(`--${b}`)) {
      const m = /name="([^"]+)"(?:; filename="([^"]*)")?[\s\S]*?\r\n\r\n([\s\S]*?)\r\n$/.exec(part);
      if (!m) continue;
      if (m[2] !== undefined) files.push({ field: m[1], filename: m[2], size: Buffer.byteLength(m[3], 'latin1') });
      else fields[m[1]] = m[3];
    }
    return { fields, files };
  }

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const ctype = req.headers['content-type'] || '';
    const u = new URL(req.url, stub.baseURL);
    let body;
    let multipart;
    if (ctype.includes('json') && raw.length) { try { body = JSON.parse(raw.toString('utf8')); } catch { /* ignore */ } }
    if (ctype.startsWith('multipart/')) multipart = multipartInfo(raw, ctype);
    const call = { method: req.method, path: u.pathname, body, multipart, headers: req.headers, at: Date.now() };
    calls.push(call);

    try {
      if (!(req.headers.authorization || '').startsWith('Bearer ')) return apiError(res, 401, 'Missing bearer authentication', null, 'invalid_api_key');
      const p = u.pathname;

      if (req.method === 'POST' && p === '/v1/responses') {
        const errs = validateResponses(body ?? {});
        if (errs.length) return apiError(res, 400, errs.join(' | '));
        let spec;
        for (let i = 0; i < scripts.length; i++) {
          const r = scripts[i].fn(body, call);
          if (r !== undefined) { spec = r; if (!scripts[i].sticky) scripts.splice(i, 1); break; }
        }
        spec ??= {};
        if (spec.http) return apiError(res, spec.http.status, spec.http.message ?? 'stub error');
        const output = toOutput(spec, body);
        if (body.stream) return streamResponse(res, body, output, spec);
        return sendJSON(res, 200, responseObject(body, output));
      }

      if (req.method === 'POST' && p === '/v1/moderations') {
        const inputs = Array.isArray(body.input) ? body.input : [body.input];
        const results = inputs.map((i) => {
          const flagged = JSON.stringify(i).includes('FLAG_ME');
          return { flagged, categories: { harassment: flagged }, category_scores: { harassment: flagged ? 0.99 : 0.001 } };
        });
        return sendJSON(res, 200, { id: `modr_${randomUUID().slice(0, 8)}`, model: body.model, results });
      }

      if (req.method === 'POST' && p === '/v1/embeddings') {
        const text = textOf(body.input);
        let h = 2166136261;
        for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
        const vec = Array.from({ length: 1536 }, (_, i) => Math.sin(h * 0.000001 + i) * 0.05);
        return sendJSON(res, 200, { object: 'list', model: body.model, data: [{ object: 'embedding', index: 0, embedding: vec }], usage: { prompt_tokens: 5, total_tokens: 5 } });
      }

      if (req.method === 'POST' && (p === '/v1/images/generations' || p === '/v1/images/edits')) {
        return sendJSON(res, 200, { created: Math.floor(Date.now() / 1000), data: [{ b64_json: PNG_1X1, revised_prompt: 'stub revised prompt' }] });
      }

      if (req.method === 'POST' && p === '/v1/audio/speech') {
        res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
        return res.end(Buffer.from('ID3-stub-mp3-bytes'));
      }

      if (req.method === 'POST' && p === '/v1/audio/transcriptions') {
        return sendJSON(res, 200, { text: 'hello from stub transcription', languages: ['en'] });
      }

      if (req.method === 'POST' && p === '/v1/realtime/client_secrets') {
        return sendJSON(res, 200, { value: 'ek_stub_secret', expires_at: Math.floor(Date.now() / 1000) + 60, session: body?.session });
      }

      if (req.method === 'POST' && p === '/v1/conversations') {
        const id = `conv_${randomUUID().slice(0, 8)}`;
        conversations.set(id, (body?.items ?? []).map((it) => ({ id: `item_${randomUUID().slice(0, 8)}`, ...it })));
        return sendJSON(res, 200, { id, object: 'conversation', created_at: Math.floor(Date.now() / 1000), metadata: {} });
      }
      const mi = /^\/v1\/conversations\/([^/]+)\/items$/.exec(p);
      if (mi) {
        const items = conversations.get(mi[1]);
        if (!items) return apiError(res, 404, `Conversation ${mi[1]} not found`);
        if (req.method === 'POST') {
          const added = (body.items ?? []).map((it) => ({ id: `item_${randomUUID().slice(0, 8)}`, ...it }));
          items.push(...added);
          return sendJSON(res, 200, { object: 'list', data: added, first_id: added[0]?.id ?? null, last_id: added.at(-1)?.id ?? null, has_more: false });
        }
        if (req.method === 'GET') {
          const desc = u.searchParams.get('order') !== 'asc';
          const limit = Number(u.searchParams.get('limit') || 100);
          const data = (desc ? [...items].reverse() : [...items]).slice(0, limit);
          return sendJSON(res, 200, { object: 'list', data, first_id: data[0]?.id ?? null, last_id: data.at(-1)?.id ?? null, has_more: false });
        }
      }
      return apiError(res, 404, `stubOpenAI: route not implemented: ${req.method} ${p}`);
    } catch (e) {
      return apiError(res, 500, `stubOpenAI internal error: ${e.message}`);
    }
  });

  return stub;
}
