/**
 * OpenAI Images (GPT Image 2.6) gateway — Netlify Functions v2.
 * POST /api/ai/image
 * Body: { action: 'generate' | 'edit', prompt, entityType?, entityId?,
 *         size?, quality?, background?, imageUrl? (edit), mask? (edit, base64 PNG) }
 * Generated images are stored in Supabase Storage (public bucket `ai-images`)
 * and the public URL is returned: { ok, url, path, model, revised_prompt }.
 *
 * Models: gpt-image-2.6-flare (fast generation, default) and gpt-image-2.6-sunburst
 * (precision edits, default for `edit`). Override with OPENAI_IMAGE_MODEL / OPENAI_IMAGE_EDIT_MODEL.
 */
import { toFile } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { authorize, rateLimited, getClient, CORS_HEADERS } from './_openai';

const BUCKET = 'ai-images';
const GENERATE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.6-flare';
const EDIT_MODEL = process.env.OPENAI_IMAGE_EDIT_MODEL || 'gpt-image-2.6-sunburst';

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });

let _db: any = null;
function db() {
  if (!_db) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('Supabase service credentials are not configured on the server');
    _db = createClient(url, key);
  }
  return _db;
}

async function ensureBucket() {
  const { data } = await db().storage.getBucket(BUCKET);
  if (!data) {
    await db().storage.createBucket(BUCKET, { public: true, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'] });
  }
}

const SIZES = new Set(['1024x1024', '1536x1024', '1024x1536', 'auto']);
const QUALITIES = new Set(['low', 'medium', 'high', 'auto']);

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'Method not allowed' });
  if (!(await authorize(req.headers.get('authorization') || undefined))) return reply(401, { ok: false, error: 'Unauthorized' });
  if (rateLimited(req.headers.get('x-nf-client-connection-ip') || 'anon', 10)) return reply(429, { ok: false, error: 'Rate limit exceeded' });

  let body: any;
  try { body = await req.json(); } catch { return reply(400, { ok: false, error: 'Invalid JSON body' }); }

  const action = body.action === 'edit' ? 'edit' : 'generate';
  const prompt = String(body.prompt || '').slice(0, 4000);
  if (!prompt) return reply(400, { ok: false, error: 'prompt is required' });

  const size = SIZES.has(body.size) ? body.size : '1024x1024';
  const quality = QUALITIES.has(body.quality) ? body.quality : 'medium';
  const background = ['transparent', 'opaque', 'auto'].includes(body.background) ? body.background : 'auto';

  try {
    // Prompts are moderated before spending image credits.
    const mod = await getClient().moderations.create({ model: 'omni-moderation-latest', input: prompt });
    if (mod.results[0].flagged) return reply(422, { ok: false, error: 'Prompt was flagged by content moderation' });

    const openai = getClient();
    let result: any;
    let model = GENERATE_MODEL;

    if (action === 'edit') {
      model = EDIT_MODEL;
      if (!body.imageUrl) return reply(400, { ok: false, error: 'imageUrl is required for edit' });
      const src = await fetch(body.imageUrl);
      if (!src.ok) return reply(400, { ok: false, error: 'Could not fetch imageUrl' });
      const type = src.headers.get('content-type') || 'image/png';
      const image = await toFile(Buffer.from(await src.arrayBuffer()), 'source.png', { type });
      const mask = body.mask ? await toFile(Buffer.from(body.mask, 'base64'), 'mask.png', { type: 'image/png' }) : undefined;
      result = await (openai.images as any).edit({ model, image, prompt, size, quality, ...(mask ? { mask } : {}) });
    } else {
      result = await (openai.images as any).generate({ model, prompt, size, quality, background, n: 1 });
    }

    const item = result.data?.[0];
    if (!item?.b64_json) return reply(502, { ok: false, error: 'Image API returned no image' });

    await ensureBucket();
    const folder = [body.entityType, body.entityId].filter(Boolean).join('/') || 'misc';
    const path = `${folder.replace(/[^a-zA-Z0-9/_-]/g, '')}/${Date.now()}.png`;
    const { error: upErr } = await db().storage.from(BUCKET).upload(path, Buffer.from(item.b64_json, 'base64'), {
      contentType: 'image/png',
      upsert: false,
    });
    if (upErr) return reply(500, { ok: false, error: `Storage upload failed: ${upErr.message}` });

    const { data: pub } = db().storage.from(BUCKET).getPublicUrl(path);
    return reply(200, { ok: true, url: pub.publicUrl, path, model, revised_prompt: item.revised_prompt ?? null });
  } catch (e: any) {
    const status = typeof e?.status === 'number' && e.status >= 400 && e.status < 600 ? e.status : 500;
    return reply(status, { ok: false, error: e?.message || 'Image request failed' });
  }
};

export const config = { path: '/api/ai/image' };
