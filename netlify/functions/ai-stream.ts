/**
 * Streaming chat over the Responses API (Netlify Functions v2 — real streaming, not buffered).
 * POST /api/ai/stream   Body: { messages|input, instructions?, tier?, effort?, maxOutputTokens? }
 * Emits SSE frames: data: {"delta": "..."}  ...  data: [DONE]
 */
import { authorize, rateLimited, respondStream, CORS_HEADERS } from './_openai';

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  if (!(await authorize(req.headers.get('authorization') || undefined))) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  }
  if (rateLimited(req.headers.get('x-nf-client-connection-ip') || 'anon')) {
    return new Response(JSON.stringify({ ok: false, error: 'Rate limit exceeded' }), { status: 429, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS }); }

  const enc = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const deltas = respondStream({
          tier: body.tier || 'default',
          effort: body.effort,
          instructions: body.instructions,
          input: Array.isArray(body.messages) ? body.messages : body.input || 'Proceed.',
          maxOutputTokens: Number(body.maxOutputTokens) || 2000,
        });
        for await (const delta of deltas) controller.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`));
      } catch (e: any) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ error: e?.message || 'stream failed' })}\n\n`));
      }
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', ...CORS_HEADERS },
  });
};

export const config = { path: '/api/ai/stream' };
