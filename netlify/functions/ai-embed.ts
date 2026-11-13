/**
 * OpenAI embeddings gateway — Netlify Functions v2. POST /api/ai/embed
 *   { action: 'index_contact', contactId }        -> embeds the contact profile, upserts contact_embeddings
 *   { action: 'search_contacts', query, limit? }  -> semantic search via the match_contacts() SQL function
 * Model: text-embedding-3-small (1536 dims). Override with OPENAI_EMBEDDING_MODEL (must stay 1536-dim).
 */
import { createClient } from '@supabase/supabase-js';
import { authorize, userClient, rateLimited, getClient, CORS_HEADERS } from './_openai';

const MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });

function db() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials are not configured on the server');
  return createClient(url, key);
}

const embed = async (input: string) => {
  const r = await getClient().embeddings.create({ model: MODEL, input: input.slice(0, 8000), encoding_format: 'float' });
  return r.data[0].embedding;
};

function profileText(c: any): string {
  return [
    c.name || [c.first_name, c.last_name].filter(Boolean).join(' '),
    c.title && `Title: ${c.title}`,
    c.company && `Company: ${c.company}`,
    c.industry && `Industry: ${c.industry}`,
    c.location && `Location: ${c.location}`,
    c.status && `Status: ${c.status}`,
    Array.isArray(c.tags) && c.tags.length && `Tags: ${c.tags.join(', ')}`,
    c.notes && `Notes: ${c.notes}`,
  ].filter(Boolean).join('\n');
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'Method not allowed' });
  const authHeader = req.headers.get('authorization') || undefined;
  if (!(await authorize(authHeader))) return reply(401, { ok: false, error: 'Unauthorized' });
  if (rateLimited(req.headers.get('x-nf-client-connection-ip') || 'anon', 60)) return reply(429, { ok: false, error: 'Rate limit exceeded' });

  let body: any;
  try { body = await req.json(); } catch { return reply(400, { ok: false, error: 'Invalid JSON body' }); }

  try {
    // Reads run AS THE CALLER (RLS applies); the service role is only used for the embeddings write after the check.
    const asUser = userClient(authHeader);
    if (!asUser) return reply(500, { ok: false, error: 'SUPABASE_URL / SUPABASE_ANON_KEY are not configured on the server' });

    if (body.action === 'index_contact') {
      if (!body.contactId) return reply(400, { ok: false, error: 'contactId is required' });
      const { data: contact } = await asUser.from('contacts').select('*').eq('id', body.contactId).maybeSingle();
      if (!contact) return reply(404, { ok: false, error: 'Contact not found' });
      const content = profileText(contact);
      const embedding = await embed(content);
      const { error } = await db().from('contact_embeddings').upsert(
        { contact_id: body.contactId, content, embedding: JSON.stringify(embedding), model: MODEL, updated_at: new Date().toISOString() },
        { onConflict: 'contact_id' },
      );
      if (error) return reply(500, { ok: false, error: error.message });
      return reply(200, { ok: true, model: MODEL });
    }

    if (body.action === 'search_contacts') {
      const query = String(body.query || '').trim();
      if (!query) return reply(400, { ok: false, error: 'query is required' });
      const embedding = await embed(query);
      const { data, error } = await asUser.rpc('match_contacts', {
        query_embedding: JSON.stringify(embedding),
        match_count: Math.min(Number(body.limit) || 10, 50),
        min_similarity: Number(body.minSimilarity) || 0.2,
      });
      if (error) return reply(500, { ok: false, error: error.message });
      // contact_embeddings is readable by every signed-in user: keep only hits whose contact the caller can actually see.
      const hits = (data ?? []) as Array<{ contact_id: string }>;
      let results = hits;
      if (hits.length) {
        const { data: visible, error: vErr } = await asUser.from('contacts').select('id').in('id', hits.map((h) => h.contact_id));
        if (vErr) return reply(500, { ok: false, error: vErr.message });
        const ok = new Set(((visible ?? []) as Array<{ id: string }>).map((c) => c.id));
        results = hits.filter((h) => ok.has(h.contact_id));
      }
      return reply(200, { ok: true, results, model: MODEL });
    }

    return reply(400, { ok: false, error: 'Unknown action' });
  } catch (e: any) {
    const status = typeof e?.status === 'number' && e.status >= 400 && e.status < 600 ? e.status : 500;
    return reply(status, { ok: false, error: e?.message || 'Embedding request failed' });
  }
};

export const config = { path: '/api/ai/embed' };
