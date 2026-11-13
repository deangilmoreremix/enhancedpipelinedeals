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
import { assertSafeUrl } from './_workflowSteps';
import { storageFolder } from './_storagePath';

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

const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;

class BadImageUrl extends Error {}

/**
 * Fetches the image to edit. Only the project's own Supabase origin or a public https URL is allowed: the gateway is
 * reachable with the (public) anon key, so an unchecked server-side fetch would be an SSRF primitive.
 */
async function fetchSourceImage(raw: string): Promise<{ bytes: Buffer; type: string }> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new BadImageUrl('imageUrl is not a valid URL'); }
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let own = false;
  try { own = Boolean(supabaseUrl) && new URL(supabaseUrl as string).origin === url.origin; } catch { /* ignore */ }
  if (!own) {
    try { await assertSafeUrl(url.toString()); } catch (e) { throw new BadImageUrl(`imageUrl rejected: ${(e as Error).message}`); }
  }
  const src = await fetch(url, { redirect: own ? 'follow' : 'error' }).catch(() => null);
  if (!src || !src.ok) throw new BadImageUrl('Could not fetch imageUrl');
  const type = (src.headers.get('content-type') || 'image/png').split(';')[0].trim();
  if (!/^image\/(png|jpe?g|webp)$/.test(type)) throw new BadImageUrl('imageUrl must be a png, jpeg or webp image');
  const bytes = Buffer.from(await src.arrayBuffer());
  if (bytes.length > MAX_SOURCE_IMAGE_BYTES) throw new BadImageUrl('imageUrl image is larger than 20 MB');
  return { bytes, type };
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
      const source = await fetchSourceImage(String(body.imageUrl));
      const image = await toFile(source.bytes, 'source.png', { type: source.type });
      const mask = body.mask ? await toFile(Buffer.from(body.mask, 'base64'), 'mask.png', { type: 'image/png' }) : undefined;
      result = await (openai.images as any).edit({ model, image, prompt, size, quality, ...(mask ? { mask } : {}) });
    } else {
      result = await (openai.images as any).generate({ model, prompt, size, quality, background, n: 1 });
    }

    const item = result.data?.[0];
    if (!item?.b64_json) return reply(502, { ok: false, error: 'Image API returned no image' });

    await ensureBucket();
    // sanitise per segment so the returned path is exactly the stored path (no empty segments)
    const path = `${storageFolder(body.entityType, body.entityId)}/${Date.now()}.png`;
    const { error: upErr } = await db().storage.from(BUCKET).upload(path, Buffer.from(item.b64_json, 'base64'), {
      contentType: 'image/png',
      upsert: false,
    });
    if (upErr) return reply(500, { ok: false, error: `Storage upload failed: ${upErr.message}` });

    const { data: pub } = db().storage.from(BUCKET).getPublicUrl(path);
    return reply(200, { ok: true, url: pub.publicUrl, path, model, revised_prompt: item.revised_prompt ?? null });
  } catch (e: any) {
    if (e instanceof BadImageUrl) return reply(400, { ok: false, error: e.message });
    const status = typeof e?.status === 'number' && e.status >= 400 && e.status < 600 ? e.status : 500;
    return reply(status, { ok: false, error: e?.message || 'Image request failed' });
  }
};

export const config = { path: '/api/ai/image' };
