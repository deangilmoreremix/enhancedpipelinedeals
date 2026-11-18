import { Handler } from '@netlify/functions';
import { authUser, userClient, json } from './_openai';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { ...json(204, {}), body: '' };
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!(await authUser(authHeader))) return json(401, { error: 'Unauthorized' });
  // acts as the caller (anon key + their JWT) so RLS applies; never the service role
  const supabase = userClient(authHeader);
  if (!supabase) return json(500, { error: 'SUPABASE_URL / SUPABASE_ANON_KEY are not configured on the server' });

  let parsed: { agent_id?: string; persona_id?: string };
  try {
    parsed = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  try {
    const { agent_id, persona_id } = parsed;

    if (!agent_id || !persona_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing agent_id or persona_id' })
      };
    }

    const { error } = await supabase
      .from('agent_persona_selection')
      .upsert({
        agent_id,
        persona_id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'agent_id'
      });

    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: `Could not save persona selection: ${error.message}` }) };
    }

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