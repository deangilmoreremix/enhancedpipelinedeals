import assert from 'node:assert/strict';

export { assert };

/** Collects PASS/FAIL/SKIP results grouped by handler. */
export class Results {
  rows = [];
  add(handler, check, status, note = '') { this.rows.push({ handler, check, status, note }); }
}

export function makeT(results, handler) {
  const t = async (check, fn) => {
    try { await fn(); results.add(handler, check, 'PASS'); }
    catch (e) { results.add(handler, check, 'FAIL', (e?.message ?? String(e)).split('\n').slice(0, 6).join(' / ')); }
  };
  t.skip = (check, reason) => results.add(handler, check, 'SKIP', reason);
  t.note = (check, note) => results.add(handler, check, 'INFO', note);
  return t;
}

let ipCounter = 0;
export const freshIp = () => `10.1.${(ipCounter >> 8) & 255}.${ipCounter++ & 255}`;

/** Invoke a Netlify v1 handler with a fake event. */
export async function callV1(handler, { method = 'POST', headers = {}, body, path = '/', qs, token = 'good-jwt', ip } = {}) {
  const h = { 'x-nf-client-connection-ip': ip ?? freshIp(), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers };
  const event = {
    httpMethod: method, headers: h, path, queryStringParameters: qs ?? null,
    body: body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body), isBase64Encoded: false,
  };
  const res = await handler(event, {});
  let json;
  try { json = JSON.parse(res?.body ?? ''); } catch { /* not json */ }
  return { ...res, json };
}

/** Invoke a Netlify v2 handler with a real Request. */
export async function callV2(fn, { method = 'POST', headers = {}, body, token = 'good-jwt', ip, url = 'http://localhost/api/x' } = {}) {
  const h = { 'x-nf-client-connection-ip': ip ?? freshIp(), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers };
  const init = { method, headers: h };
  if (body !== undefined && method !== 'GET') { init.body = typeof body === 'string' ? body : JSON.stringify(body); h['content-type'] ??= 'application/json'; }
  return fn(new Request(url, init));
}

export async function jsonOf(res) { const text = await res.text(); try { return JSON.parse(text); } catch { return { __text: text }; } }

/** Reads a Response body to the end and parses `data: ...` SSE frames. */
export async function readSSE(res) {
  const text = typeof res === 'string' ? res : await res.text();
  const frames = [];
  for (const block of text.split('\n\n')) {
    const line = block.split('\n').find((l) => l.startsWith('data: '));
    if (!line) continue;
    const d = line.slice(6);
    frames.push(d === '[DONE]' ? '[DONE]' : JSON.parse(d));
  }
  return { frames, text };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Runs `fn` with env vars temporarily set (value undefined/null deletes), restoring them afterwards. */
export async function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) { prev[k] = process.env[k]; if (v == null) delete process.env[k]; else process.env[k] = v; }
  try { return await fn(); } finally { for (const [k, v] of Object.entries(prev)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}
