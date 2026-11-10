import { Handler } from '@netlify/functions';
import { respondStream } from './_openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { contactId, dealId, input, personaId } = JSON.parse(event.body);

    // Fetch contact and deal context
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    let dealContext = '';
    if (dealId) {
      const { data: deal } = await supabase
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .single();
      dealContext = deal ? `Deal: ${deal.title} (${deal.value} value, ${deal.stage} stage)` : '';
    }

    // Get persona if specified
    let personaPrompt = '';
    if (personaId) {
      const { data: persona } = await supabase
        .from('sdr_personas')
        .select('persona_prompt')
        .eq('id', personaId)
        .single();
      personaPrompt = persona?.persona_prompt || '';
    }

    const systemPrompt = `You are an expert email composer for SmartCRM.

${personaPrompt}

Contact: ${contact?.name} at ${contact?.company}
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
        controller.close();
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Compose email error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to compose email' })
    };
  }
};