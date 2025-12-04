import { Handler } from '@netlify/functions';
import { runSDR } from '../../src/lib/orchestrator/sdrOrchestrator';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { inbox, from, text, subject, message_id } = body;

    console.log('📧 AgentMail webhook received:', { from, subject, message_id });

    // 1. Find CRM contact by email
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('email', from)
      .single();

    if (contactError || !contact) {
      console.log('👤 Unknown sender, creating contact:', from);

      // Create new contact
      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert({
          email: from,
          name: from.split('@')[0].replace(/[._-]/g, ' '), // Basic name extraction
          status: 'new',
          autopilot_enabled: true
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create contact:', createError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to create contact' })
        };
      }

      // Return early - let the system process this new contact separately
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'New contact created, SDR will respond shortly',
          contactId: newContact.id
        })
      };
    }

    // 2. Load assigned SDR agent for this contact
    const { data: assignment } = await supabase
      .from('contact_agent_assignment')
      .select('agent_id')
      .eq('contact_id', contact.id)
      .single();

    const agentId = assignment?.agent_id || 'sdr_email_primary';

    console.log('🤖 Using SDR agent:', agentId, 'for contact:', contact.id);

    // 3. Prepare the incoming message
    const incomingMessage = `${subject || ''}\n\n${text || ''}`.trim();

    // 4. Run SDR logic
    const result = await runSDR({
      contactId: contact.id,
      incomingMessage,
      agentId
    });

    console.log('✅ SDR response generated and sent');

    // 5. Log the webhook processing
    await supabase
      .from('activities')
      .insert({
        contact_id: contact.id,
        type: 'email_received',
        message: `Email received: "${subject}" - SDR responded automatically`
      });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        result,
        contactId: contact.id,
        agentId,
        message: 'SDR response sent successfully'
      })
    };

  } catch (error) {
    console.error('❌ AgentMail webhook error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};