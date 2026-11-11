/**
 * Non-streaming SDR runner (Netlify Functions v1). Runs the OpenAI Agents SDK specialists
 * defined in _sdrAgents.ts. For streaming + human approval use POST /api/sdr/run (sdr-agent.ts).
 *
 * POST body: { action: 'run' | 'batch' | 'metadata', agentId?, agentIds?, contactId, goal? }
 */
import type { Handler } from '@netlify/functions';
import { authUser, rateLimited, json, CORS_HEADERS } from './_openai';
import { SPECIALISTS, runSpecialistOnce, checkLeadAccess } from './_sdrAgents';
import { InputGuardrailTripwireTriggered, OutputGuardrailTripwireTriggered } from '@openai/agents';

const explain = (e: any) =>
  e instanceof InputGuardrailTripwireTriggered ? 'Blocked: the lead opted out of contact.'
  : e instanceof OutputGuardrailTripwireTriggered ? 'Blocked: the draft failed content moderation.'
  : e?.message || 'Internal Server Error';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const user = await authUser(authHeader);
  if (!user) return json(401, { error: 'Unauthorized' });
  if (rateLimited(String(event.headers['x-nf-client-connection-ip'] || 'anon'), 30)) return json(429, { error: 'Rate limit exceeded' });

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const action = body.action || 'run';

    if (action === 'metadata') {
      const agents = SPECIALISTS.map(({ id, name, description, tier }) => ({ id, name, description, tier }));
      return json(200, { agents, total: agents.length });
    }

    const contactId = body.contactId as string | undefined;
    if (!contactId) return json(400, { error: 'contactId is required' });
    // tools run with the service role: the caller must be able to see the lead / deal under RLS first
    const denied = await checkLeadAccess(authHeader, contactId, typeof body.dealId === 'string' && body.dealId ? body.dealId : null);
    if (denied) return json(denied.endsWith('not found') ? 404 : 500, { error: denied });

    if (action === 'run') {
      const agentId = body.agentId as string | undefined;
      if (!agentId) return json(400, { error: 'agentId is required' });
      if (agentId !== 'auto' && !SPECIALISTS.some((s) => s.id === agentId)) return json(404, { error: `Unknown SDR agent: ${agentId}` });
      try {
        const dealId = typeof body.dealId === 'string' && body.dealId ? body.dealId : null;
        const result = await runSpecialistOnce(agentId, contactId, body.goal, dealId, { userId: user.id });
        return json(200, { agentId, contactId, dealId, result, timestamp: new Date().toISOString() });
      } catch (e) {
        return json(422, { agentId, contactId, error: explain(e) });
      }
    }

    if (action === 'batch') {
      const agentIds = body.agentIds as string[] | undefined;
      if (!Array.isArray(agentIds) || agentIds.length === 0) return json(400, { error: 'agentIds array is required and must not be empty' });
      const results: unknown[] = [];
      const errors: unknown[] = [];
      for (const agentId of agentIds.slice(0, 5)) {
        try {
          results.push({ agentId, contactId, result: await runSpecialistOnce(agentId, contactId, body.goal, typeof body.dealId === 'string' ? body.dealId : null, { userId: user.id }), success: true });
        } catch (e) {
          errors.push({ agentId, error: explain(e) });
        }
      }
      return json(200, { results, errors, summary: { total: agentIds.length, successful: results.length, failed: errors.length } });
    }

    return json(400, { error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error('[sdr-run] Error:', error);
    return json(500, { error: error.message || 'Internal Server Error' });
  }
};
