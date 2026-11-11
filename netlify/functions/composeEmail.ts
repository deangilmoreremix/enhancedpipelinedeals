/**
 * Streaming email composer (Netlify Functions v2). POST /api/ai/compose-email
 * Body: { contactId, dealId?, input?, personaId? } -> SSE `data: {"content": "..."}` frames.
 */
import { createClient } from '@supabase/supabase-js';
import { authorize, rateLimited, respondStream, CORS_HEADERS } from './_openai';
import { describeContact } from './_prompts';

let _supabase: ReturnType<typeof createClient> | null = null;
function db() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('Supabase service credentials are not configured on the server');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

const err = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'Method not allowed');
  if (!(await authorize(req.headers.get('authorization') || undefined))) return err(401, 'Unauthorized');
  if (rateLimited(req.headers.get('x-nf-client-connection-ip') || 'anon')) return err(429, 'Rate limit exceeded');

  let payload: any;
  try { payload = await req.json(); } catch { return err(400, 'Invalid JSON body'); }
  const { contactId, dealId, input, personaId } = payload ?? {};
  if (!contactId) return err(400, 'contactId is required');

  try {
    const supabase = db();
    // Fetch contact and deal context
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .maybeSingle<any>();

    let dealContext = '';
    if (dealId) {
      const { data: deal } = await supabase
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .maybeSingle<any>();
      dealContext = deal ? `Deal: ${deal.title} (${deal.value} value, ${deal.stage} stage)` : '';
    }

    // Get persona if specified
    let personaPrompt = '';
    if (personaId) {
      const { data: persona } = await supabase
        .from('sdr_personas')
        .select('persona_prompt')
        .eq('id', personaId)
        .maybeSingle<any>();
      personaPrompt = persona?.persona_prompt || '';
    }

    const systemPrompt = `You are an expert email composer for SmartCRM.

${personaPrompt}

${describeContact(contact)}
${dealContext}

Guidelines:
- Write professional, personalized emails
- Keep it concise but comprehensive
- Include clear call-to-action
- Use the contact's name and company context
- Match the persona's communication style
- Focus on building relationships and driving action

${input ? `Improve and complete this draft: ${input}` : 'Write a compelling email based on the context provided.'}`;

    // Stream via the Responses API (typed events -> output_text deltas)
    const deltas = respondStream({
      tier: 'default',
      instructions: systemPrompt,
      input: input || 'Write a professional email for this contact and deal.',
      maxOutputTokens: 1500
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const content of deltas) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String((err as Error).message) })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...CORS_HEADERS
      }
    });

  } catch (error) {
    console.error('Compose email error:', error);
    return err(500, 'Failed to compose email');
  }
};

export const config = { path: '/api/ai/compose-email' };