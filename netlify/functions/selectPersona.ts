import { Handler } from '@netlify/functions';
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
    const { agent_id, persona_id } = JSON.parse(event.body);

    if (!agent_id || !persona_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing agent_id or persona_id' })
      };
    }

    await supabase
      .from('agent_persona_selection')
      .upsert({
        agent_id,
        persona_id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'agent_id'
      });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Persona selection saved successfully'
      })
    };
  } catch {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};