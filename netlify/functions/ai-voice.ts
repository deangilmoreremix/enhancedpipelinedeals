/**
 * OpenAI audio gateway — Netlify Functions v2. POST /api/ai/voice
 *   { action: 'speak', text, voice?, instructions?, contactId? }  -> { url }  (mp3 in Supabase Storage)
 *   { action: 'transcribe', audioBase64, mimeType?, fileName? }      -> { text, languages }
 *   { action: 'realtime_token' }                                      -> { value, expires_at, model }
 *
 * Models (override via env): speech gpt-4o-mini-tts (Speech API; OpenAI lists it as deprecated with a
 * 2027 shutdown — migrate to Realtime when convenient), transcription gpt-transcribe,
 * realtime gpt-realtime-2.1 (browser connects over WebRTC with the ephemeral key).
 */
import { toFile } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { authorize, rateLimited, getClient, CORS_HEADERS } from './_openai';

const TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-transcribe';
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1';
const BUCKET = 'ai-audio';
const VOICES = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar']);

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });

function db() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials are not configured on the server');
  return createClient(url, key);
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'Method not allowed' });
  if (!(await authorize(req.headers.get('authorization') || undefined))) return reply(401, { ok: false, error: 'Unauthorized' });
  if (rateLimited(req.headers.get('x-nf-client-connection-ip') || 'anon', 20)) return reply(429, { ok: false, error: 'Rate limit exceeded' });

  let body: any;
  try { body = await req.json(); } catch { return reply(400, { ok: false, error: 'Invalid JSON body' }); }

  try {
    const openai = getClient();

    if (body.action === 'speak') {
      const text = String(body.text || '').slice(0, 4000);
      if (!text) return reply(400, { ok: false, error: 'text is required' });
      const mod = await openai.moderations.create({ model: 'omni-moderation-latest', input: text });
      if (mod.results[0].flagged) return reply(422, { ok: false, error: 'Text was flagged by content moderation' });

      const audio = await openai.audio.speech.create({
        model: TTS_MODEL,
        voice: VOICES.has(body.voice) ? body.voice : 'marin',
        input: text,
        ...(body.instructions ? { instructions: String(body.instructions).slice(0, 500) } : {}),
        response_format: 'mp3',
      } as any);
      const buf = Buffer.from(await audio.arrayBuffer());

      const supabase = db();
      const { data: bucket } = await supabase.storage.getBucket(BUCKET);
      if (!bucket) await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 25 * 1024 * 1024, allowedMimeTypes: ['audio/mpeg'] });
      const path = `${String(body.contactId || 'misc').replace(/[^a-zA-Z0-9_-]/g, '')}/${Date.now()}.mp3`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: 'audio/mpeg' });
      if (error) return reply(500, { ok: false, error: `Storage upload failed: ${error.message}` });
      return reply(200, { ok: true, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, path, model: TTS_MODEL });
    }

    if (body.action === 'transcribe') {
      if (!body.audioBase64) return reply(400, { ok: false, error: 'audioBase64 is required' });
      const bytes = Buffer.from(body.audioBase64, 'base64');
      if (bytes.length > 25 * 1024 * 1024) return reply(413, { ok: false, error: 'Audio must be 25 MB or smaller' });
      const file = await toFile(bytes, body.fileName || 'audio.webm', { type: body.mimeType || 'audio/webm' });
      const t: any = await openai.audio.transcriptions.create({ file, model: TRANSCRIBE_MODEL } as any);
      return reply(200, { ok: true, text: t.text, languages: t.languages ?? null, model: TRANSCRIBE_MODEL });
    }

    if (body.action === 'realtime_token') {
      // Mint an ephemeral client secret; the browser connects to OpenAI over WebRTC with it.
      const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const r = await fetch(`${base}/realtime/client_secrets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: {
            type: 'realtime',
            model: REALTIME_MODEL,
            instructions: String(body.instructions || 'You are a helpful sales assistant inside SmartCRM. Be concise.').slice(0, 4000),
            audio: { output: { voice: VOICES.has(body.voice) ? body.voice : 'marin' } },
          },
        }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) return reply(r.status, { ok: false, error: j.error?.message || 'Could not create realtime session' });
      return reply(200, { ok: true, value: j.value, expires_at: j.expires_at, model: REALTIME_MODEL });
    }

    return reply(400, { ok: false, error: 'Unknown action' });
  } catch (e: any) {
    const status = typeof e?.status === 'number' && e.status >= 400 && e.status < 600 ? e.status : 500;
    return reply(status, { ok: false, error: e?.message || 'Audio request failed' });
  }
};

export const config = { path: '/api/ai/voice' };
