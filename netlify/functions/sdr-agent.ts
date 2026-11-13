/**
 * SDR agent runner (Netlify Functions v2, streaming).
 *
 * POST /api/sdr/run
 * Body:
 *   { agentId: 'auto' | 'sdr-cold-email' | ..., leadId, goal?, message?, stream?: boolean,
 *     resume?: { state: string, decisions: Array<{ callId: string, approve: boolean }> } }
 *
 * Streams server-sent events built from the Agents SDK stream:
 *   {type:'agent', name} {type:'delta', delta} {type:'tool_called', name} {type:'tool_output', name}
 *   {type:'handoff', from, to} {type:'approval_required', state, approvals:[...]}
 *   {type:'final', agent, output} {type:'error', error}
 * With stream:false the same data is returned as one JSON object.
 */
import { run, RunState, InputGuardrailTripwireTriggered, OutputGuardrailTripwireTriggered } from '@openai/agents';
import { authUser, rateLimited, CORS_HEADERS } from './_openai';
import { buildAgents, sessionForLead, checkLeadAccess, signSdrState, verifySdrState } from './_sdrAgents';

const JSON_HEADERS = { 'Content-Type': 'application/json', ...CORS_HEADERS };

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

function approvalsOf(items: any[]) {
  return items.map((i) => ({
    callId: i.rawItem?.callId ?? i.rawItem?.id,
    tool: i.name,
    arguments: (() => { try { return JSON.parse(i.arguments || '{}'); } catch { return i.arguments; } })(),
  }));
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'Method not allowed' });
  const authHeader = req.headers.get('authorization') || undefined;
  const user = await authUser(authHeader);
  if (!user) return reply(401, { ok: false, error: 'Unauthorized' });
  if (rateLimited(req.headers.get('x-nf-client-connection-ip') || 'anon', 30)) return reply(429, { ok: false, error: 'Rate limit exceeded' });

  let body: any;
  try { body = await req.json(); } catch { return reply(400, { ok: false, error: 'Invalid JSON body' }); }

  const agentId: string = body.agentId || 'auto';
  const leadId: string | undefined = body.leadId;
  if (!leadId) return reply(400, { ok: false, error: 'leadId is required' });

  const { orchestrator, specialists } = buildAgents();
  const agent = agentId === 'auto' ? orchestrator : specialists[agentId];
  if (!agent) return reply(400, { ok: false, error: `Unknown agent: ${agentId}`, agents: Object.keys(specialists) });

  // tools run with the service role: the caller must be able to see the lead under RLS first
  const denied = await checkLeadAccess(authHeader, leadId);
  if (denied) return reply(denied.endsWith('not found') ? 404 : 500, { ok: false, error: denied });

  // resume state must be the signed blob we issued to THIS user for THIS lead + agent (a forged state could self-approve sends)
  const binding = { userId: user.id, leadId, agentId };
  let resumeState: string | null = null;
  if (body.resume?.state !== undefined) {
    resumeState = verifySdrState(body.resume.state, binding);
    if (!resumeState) return reply(400, { ok: false, error: 'Invalid, expired or modified resume state' });
  }

  const wantsStream = body.stream !== false;
  const enc = new TextEncoder();

  const execute = async (emit: (e: Record<string, unknown>) => void) => {
    const session = await sessionForLead(leadId);
    let input: any;
    if (resumeState) {
      // Resume a run that paused for human approval
      const state: any = await RunState.fromString(agent as any, resumeState);
      const decisions: Array<{ callId: string; approve: boolean }> = body.resume.decisions || [];
      for (const item of state.getInterruptions()) {
        const d = decisions.find((x) => x.callId === (item.rawItem?.callId ?? item.rawItem?.id));
        if (d?.approve) state.approve(item); else state.reject(item);
      }
      input = state;
    } else {
      input = body.message || `Lead id: ${leadId}\nGoal: ${body.goal || 'Advance this lead toward a meeting.'}`;
    }

    const stream: any = await run(agent as any, input, { stream: true, session, maxTurns: 12 } as any);

    for await (const ev of stream) {
      if (ev.type === 'raw_model_stream_event' && ev.data?.type === 'output_text_delta') {
        emit({ type: 'delta', delta: ev.data.delta });
      } else if (ev.type === 'agent_updated_stream_event') {
        emit({ type: 'agent', name: ev.agent?.name });
      } else if (ev.type === 'run_item_stream_event') {
        const raw = ev.item?.rawItem;
        if (ev.name === 'tool_called') emit({ type: 'tool_called', name: raw?.name ?? raw?.type });
        else if (ev.name === 'tool_output') emit({ type: 'tool_output', name: raw?.name });
        else if (ev.name === 'handoff_occurred') emit({ type: 'handoff', from: ev.item?.sourceAgent?.name, to: ev.item?.targetAgent?.name });
      }
    }
    await stream.completed;

    if (stream.interruptions?.length) {
      emit({ type: 'approval_required', state: signSdrState(stream.state.toString(), binding), approvals: approvalsOf(stream.interruptions) });
    } else {
      emit({ type: 'final', agent: stream.lastAgent?.name, output: stream.finalOutput ?? null });
    }
  };

  const errorEvent = (e: any) => ({
    type: 'error',
    blocked: e instanceof InputGuardrailTripwireTriggered || e instanceof OutputGuardrailTripwireTriggered,
    error:
      e instanceof InputGuardrailTripwireTriggered ? 'Blocked: the lead opted out of contact.'
      : e instanceof OutputGuardrailTripwireTriggered ? 'Blocked: the drafted message failed content moderation.'
      : e?.message || 'SDR agent failed',
  });

  if (!wantsStream) {
    const events: Record<string, unknown>[] = [];
    try { await execute((e) => events.push(e)); } catch (e) { events.push(errorEvent(e)); }
    const last = events[events.length - 1];
    return reply(last?.type === 'error' ? 400 : 200, { ok: last?.type !== 'error', events, result: last });
  }

  const readable = new ReadableStream({
    async start(controller) {
      const emit = (e: Record<string, unknown>) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      try { await execute(emit); } catch (e) { emit(errorEvent(e)); }
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', ...CORS_HEADERS },
  });
};

export const config = { path: '/api/sdr/run' };
