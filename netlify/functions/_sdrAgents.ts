/**
 * SmartCRM SDR agents built on the OpenAI Agents SDK (@openai/agents).
 *
 * - 14 specialist agents (cold email, follow-up, bump, objection handling, ...)
 * - an orchestrator (triage) agent that hands off to the specialists and calls
 *   the data-enrichment specialist as a tool
 * - shared function tools (CRM context, tasks, pipeline stage, meetings, state)
 * - hosted web_search tool for research
 * - guardrails: opt-out detection on input, moderation (omni-moderation-latest) on output
 * - human approval (`needsApproval`) before anything is queued for sending
 * - durable per-lead memory through the OpenAI Conversations API (OpenAIConversationsSession)
 *
 * Runs only on the server; OPENAI_API_KEY never reaches the browser.
 */
import {
  Agent,
  OpenAIConversationsSession,
  run,
  setDefaultOpenAIKey,
  tool,
  webSearchTool,
} from '@openai/agents';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { getClient, resolveTier } from './_openai';

// ---------------------------------------------------------------------------
// setup
// ---------------------------------------------------------------------------

if (process.env.OPENAI_API_KEY) setDefaultOpenAIKey(process.env.OPENAI_API_KEY);

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

const model = (tier: 'fast' | 'default' | 'deep' = 'default') => resolveTier(tier).model;

// ---------------------------------------------------------------------------
// tools
// ---------------------------------------------------------------------------

export const getLeadContext = tool({
  name: 'get_lead_context',
  description: 'Load the CRM record for a lead: contact details, open deals and recent activity. ALWAYS call this before planning outreach.',
  parameters: z.object({ lead_id: z.string().describe('SmartCRM contact id') }),
  async execute({ lead_id }) {
    const { data: contact, error } = await db().from('contacts').select('*').eq('id', lead_id).maybeSingle();
    if (error) return { error: error.message };
    if (!contact) return { error: 'Lead not found' };
    const [{ data: deals }, { data: activities }] = await Promise.all([
      db().from('deals').select('id,title,value,stage,probability,due_date,notes')
        .eq('contact_id', lead_id).not('stage', 'in', '(closed-won,closed-lost)'),
      db().from('activities').select('type,description,created_at')
        .eq('contact_id', lead_id).order('created_at', { ascending: false }).limit(10),
    ]);
    return { contact, open_deals: deals ?? [], recent_activity: activities ?? [] };
  },
});

export const createFollowupTask = tool({
  name: 'create_followup_task',
  description: 'Create a follow-up task in SmartCRM for a lead.',
  parameters: z.object({
    lead_id: z.string(),
    title: z.string(),
    due_date: z.string().nullable().describe('ISO date, or null'),
    notes: z.string().nullable(),
  }),
  async execute({ lead_id, title, due_date, notes }) {
    const { data, error } = await db().from('tasks')
      .insert({ contact_id: lead_id, title, due_date, notes, status: 'open', created_by_agent: true })
      .select('id').single();
    return error ? { error: error.message } : { success: true, task_id: (data as any).id };
  },
});

export const updatePipelineStage = tool({
  name: 'update_pipeline_stage',
  description: 'Move a deal to a new pipeline stage.',
  parameters: z.object({
    deal_id: z.string(),
    stage: z.enum(['qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost']),
  }),
  needsApproval: async (_ctx, { stage }) => stage === 'closed-won' || stage === 'closed-lost',
  async execute({ deal_id, stage }) {
    const { error } = await db().from('deals').update({ stage, updated_at: new Date().toISOString() }).eq('id', deal_id);
    return error ? { error: error.message } : { success: true, deal_id, stage };
  },
});

export const scheduleMeeting = tool({
  name: 'schedule_meeting',
  description: 'Schedule a meeting with a lead on the CRM calendar.',
  parameters: z.object({
    lead_id: z.string(),
    start_iso: z.string().describe('ISO 8601 start time'),
    duration_minutes: z.number().int().min(5).max(240),
    title: z.string(),
  }),
  async execute({ lead_id, start_iso, duration_minutes, title }) {
    const start = new Date(start_iso);
    if (Number.isNaN(start.getTime())) return { error: `Invalid start time: ${start_iso}` };
    const end = new Date(start.getTime() + duration_minutes * 60_000);
    const { data, error } = await db().from('calendar_events')
      .insert({ contact_id: lead_id, title, start_time: start.toISOString(), end_time: end.toISOString() })
      .select('id').single();
    return error ? { error: error.message } : { success: true, event_id: (data as any).id };
  },
});

export const logAutopilotState = tool({
  name: 'log_autopilot_state',
  description: 'Persist the current autopilot plan/state for a lead. Call after you update a plan.',
  parameters: z.object({ lead_id: z.string(), state_json: z.string().describe('JSON string of the plan/state') }),
  async execute({ lead_id, state_json }) {
    let state: unknown;
    try { state = JSON.parse(state_json); } catch { return { error: 'state_json is not valid JSON' }; }
    const { error } = await db().from('autopilot_state')
      .upsert({ lead_id, state, updated_at: new Date().toISOString() }, { onConflict: 'lead_id' });
    return error ? { error: error.message } : { success: true, saved_at: new Date().toISOString() };
  },
});

export const saveActivity = tool({
  name: 'save_activity',
  description: 'Record an SDR activity (what was done and why) on the lead timeline.',
  parameters: z.object({ lead_id: z.string(), type: z.string(), description: z.string() }),
  async execute({ lead_id, type, description }) {
    const { error } = await db().from('activities')
      .insert({ contact_id: lead_id, type, description, metadata: { source: 'sdr-agent' }, created_at: new Date().toISOString() });
    return error ? { error: error.message } : { success: true };
  },
});

/**
 * Outbound messages are never sent silently: the run pauses for human approval
 * (`needsApproval: true`). On approval the message is queued in `outbound_messages`
 * for the configured delivery integration; there is no email provider wired in here.
 */
export const queueOutboundMessage = tool({
  name: 'send_sdr_message',
  description: 'Queue an outbound message (email, LinkedIn or WhatsApp) to a lead. Requires human approval.',
  parameters: z.object({
    lead_id: z.string(),
    channel: z.enum(['email', 'linkedin', 'whatsapp']),
    subject: z.string().nullable(),
    body: z.string(),
  }),
  needsApproval: true,
  async execute({ lead_id, channel, subject, body }) {
    const { data, error } = await db().from('outbound_messages')
      .insert({ contact_id: lead_id, channel, subject, body, status: 'queued', created_by_agent: true })
      .select('id').single();
    return error ? { error: error.message } : { success: true, message_id: (data as any).id, status: 'queued' };
  },
});

const CRM_TOOLS = [getLeadContext, saveActivity, createFollowupTask, scheduleMeeting, logAutopilotState];

// ---------------------------------------------------------------------------
// guardrails
// ---------------------------------------------------------------------------

const OPT_OUT = /\b(stop|unsubscribe|opt[\s-]?out|remove me|do not contact|don'?t contact)\b/i;

/** Input guardrail: never start an outreach run when the lead's latest message is an opt-out. */
export const optOutGuardrail = {
  name: 'respect_opt_out',
  runInParallel: false,
  async execute({ input }: { input: unknown }) {
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    const hit = OPT_OUT.test(text);
    return { outputInfo: { optOut: hit }, tripwireTriggered: hit };
  },
};

/** Output guardrail: run the draft through the Moderation API (omni-moderation-latest). */
export const moderationGuardrail = {
  name: 'moderate_outreach',
  async execute({ agentOutput }: { agentOutput: any }) {
    const text = [agentOutput?.outreach?.subject, agentOutput?.outreach?.body].filter(Boolean).join('\n');
    if (!text) return { outputInfo: { skipped: true }, tripwireTriggered: false };
    const res = await getClient().moderations.create({ model: 'omni-moderation-latest', input: text });
    const r = res.results[0];
    return { outputInfo: { flagged: r.flagged, categories: r.categories }, tripwireTriggered: r.flagged };
  },
};

// ---------------------------------------------------------------------------
// specialist agents
// ---------------------------------------------------------------------------

const Outreach = z.object({
  channel: z.enum(['email', 'linkedin', 'whatsapp']),
  subject: z.string().nullable().describe('Subject line (email only)'),
  body: z.string(),
  call_to_action: z.string(),
});

export const SdrOutput = z.object({
  strategy: z.string().describe('2-3 sentence rationale for the approach'),
  outreach: Outreach,
  key_points: z.array(z.string()),
  crm_updates: z.array(z.object({ field: z.string(), value: z.string() })),
  confidence: z.number().describe('0-100'),
});
export type SdrOutputT = z.infer<typeof SdrOutput>;

const BASE_RULES = `You are an SDR agent inside SmartCRM.
Rules:
- ALWAYS call get_lead_context first; never invent CRM data, company facts or customer names.
- Use web_search only for current, verifiable facts about the lead/company.
- Keep copy human, specific and concise. No placeholders like [Name].
- Do not claim product capabilities beyond CRM, AI automations, AI SDR and pipeline intelligence.
- Draft the message in the final output. Only call send_sdr_message when explicitly asked to send; it requires human approval.
- If the lead asked to stop, do not contact them.`;

interface SpecialistDef {
  id: string;
  name: string;
  tier: 'fast' | 'default' | 'deep';
  description: string; // used as handoff description (short, concrete)
  task: string;
}

export const SPECIALISTS: SpecialistDef[] = [
  { id: 'sdr-cold-email', name: 'Cold Email SDR', tier: 'default',
    description: 'First-touch cold outreach to prospects who have not engaged yet.',
    task: 'Write a personalized cold email: compelling hook, relevance/value, light social proof only if supplied by data, one specific call-to-action, under 150 words.' },
  { id: 'sdr-follow-up', name: 'Follow-Up SDR', tier: 'default',
    description: 'Follow-up after a previous interaction or email.',
    task: 'Write a strategic follow-up: reference the previous interaction, add new value, propose a clear next step, stay concise.' },
  { id: 'sdr-bump-message', name: 'Bump Message SDR', tier: 'fast',
    description: 'Short polite nudge for unresponsive prospects.',
    task: 'Write a brief, polite, value-driven bump that references the earlier conversation without pressure and offers a new insight.' },
  { id: 'sdr-objection-handling', name: 'Objection Handling SDR', tier: 'default',
    description: 'Respond to a stated objection (price, timing, competitor, authority).',
    task: 'Acknowledge the objection with empathy, answer with evidence, offer an alternative/compromise, end with a clear next step.' },
  { id: 'sdr-linkedin', name: 'LinkedIn SDR', tier: 'fast',
    description: 'LinkedIn-based outreach and email follow-up to connections.',
    task: 'Craft a LinkedIn-appropriate message (channel "linkedin", under 300 characters) that references the connection/activity and adds value.' },
  { id: 'sdr-whatsapp', name: 'WhatsApp SDR', tier: 'fast',
    description: 'Short conversational WhatsApp outreach for high-touch prospects.',
    task: 'Write a personal, conversational WhatsApp message (channel "whatsapp", under 160 characters) coordinated with any email follow-up.' },
  { id: 'sdr-winback', name: 'Winback SDR', tier: 'default',
    description: 'Win back deals that were closed-lost.',
    task: 'Acknowledge the loss professionally, highlight what changed, offer compelling new value and a reason to reconsider now.' },
  { id: 'sdr-reactivation', name: 'Reactivation SDR', tier: 'default',
    description: 'Re-engage dormant prospects with no recent activity.',
    task: 'Infer why the lead went dormant from the data, then write a thoughtful reactivation message with a soft re-engagement ask.' },
  { id: 'sdr-competitor-aware', name: 'Competitor Aware SDR', tier: 'deep',
    description: 'Outreach when a competitor is involved in the deal.',
    task: 'Analyze the competitive context (use web_search for verifiable facts only), position respectfully against the competitor and address likely concerns.' },
  { id: 'sdr-high-intent', name: 'High-Intent SDR', tier: 'default',
    description: 'Fast, priority response to leads showing strong buying signals.',
    task: 'Validate the intent signal, accelerate the process, provide immediate value and a concrete priority next step without pressure.' },
  { id: 'sdr-event-based', name: 'Event-Based SDR', tier: 'default',
    description: 'Timely outreach triggered by a company event (funding, hire, launch).',
    task: 'Reference the specific event (verify with web_search), connect it to value, and propose a timely, relevant next step.' },
  { id: 'sdr-referral', name: 'Referral SDR', tier: 'fast',
    description: 'Ask satisfied customers/contacts for referrals.',
    task: 'Acknowledge their success, make a specific low-effort referral request, and describe the mutual benefit.' },
  { id: 'sdr-newsletter-lead-in', name: 'Newsletter Lead-In SDR', tier: 'fast',
    description: 'Convert newsletter subscribers into qualified prospects.',
    task: 'Reference their newsletter engagement, identify a likely pain point and transition from education to a solution conversation.' },
  { id: 'sdr-data-enrichment', name: 'Data-Enrichment SDR', tier: 'default',
    description: 'Enrich a lead/deal record with inferred or researched data and draft a targeted intro.',
    task: 'Research the lead and company (web_search), list enrichment fields to store back in crm_updates (industry, company size, role focus, pain points), and draft a targeted intro email.' },
];

function buildSpecialist(def: SpecialistDef) {
  return new Agent({
    name: def.name,
    handoffDescription: def.description,
    instructions: `${BASE_RULES}\n\nYour specialty: ${def.name}.\nTask: ${def.task}`,
    model: model(def.tier),
    modelSettings: { reasoning: { effort: def.tier === 'fast' ? 'low' : def.tier === 'deep' ? 'high' : 'medium' } } as any,
    tools: [...CRM_TOOLS, webSearchTool(), queueOutboundMessage],
    outputType: SdrOutput,
    inputGuardrails: [optOutGuardrail as any],
    outputGuardrails: [moderationGuardrail as any],
  });
}

export function buildAgents() {
  const specialists = Object.fromEntries(SPECIALISTS.map((d) => [d.id, buildSpecialist(d)])) as Record<string, Agent<any, any>>;
  const enrichment = specialists['sdr-data-enrichment'];

  // Orchestrator: owns routing. Hands off to a specialist who then owns the reply; may enrich first as a tool.
  const orchestrator = Agent.create({
    name: 'SDR Orchestrator',
    instructions: `${BASE_RULES}

You are the SDR triage agent. Call get_lead_context, then decide which specialist should own the reply based on the lead's status, deal stage, recent activity and the stated goal:
- no prior contact -> Cold Email SDR; previous email without reply -> Follow-Up SDR or Bump Message SDR
- stated objection -> Objection Handling SDR; competitor named -> Competitor Aware SDR
- strong buying signals -> High-Intent SDR; dormant -> Reactivation SDR; closed-lost -> Winback SDR
- company event -> Event-Based SDR; newsletter subscriber -> Newsletter Lead-In SDR; happy customer -> Referral SDR
- LinkedIn / WhatsApp preferred channels -> LinkedIn SDR / WhatsApp SDR
If key lead data is missing, call enrich_lead first. Then hand off.`,
    model: model('default'),
    modelSettings: { reasoning: { effort: 'low' } } as any,
    tools: [
      getLeadContext,
      enrichment.asTool({
        toolName: 'enrich_lead',
        toolDescription: 'Research and enrich a lead/company record; returns inferred fields and a draft intro.',
      }),
    ],
    handoffs: SPECIALISTS.filter((d) => d.id !== 'sdr-data-enrichment').map((d) => specialists[d.id]),
    inputGuardrails: [optOutGuardrail as any],
  } as any);

  return { orchestrator, specialists };
}

/** Durable per-lead memory via the OpenAI Conversations API. */
export async function sessionForLead(leadId: string) {
  const { data } = await db().from('agent_threads').select('openai_conversation_id').eq('lead_id', leadId).maybeSingle();
  const existing = (data as any)?.openai_conversation_id as string | undefined;
  const session = new OpenAIConversationsSession(existing ? { conversationId: existing } : undefined);
  const id = await session.getSessionId();
  if (id !== existing) {
    await db().from('agent_threads').upsert(
      { lead_id: leadId, openai_conversation_id: id, updated_at: new Date().toISOString() },
      { onConflict: 'lead_id' },
    );
  }
  return session;
}

/** Non-streaming run of one specialist (or the orchestrator for agentId "auto"). Returns the structured draft or a pending approval. */
export async function runSpecialistOnce(agentId: string, leadId: string, goal?: string) {
  const { orchestrator, specialists } = buildAgents();
  const agent = agentId === 'auto' ? orchestrator : specialists[agentId];
  if (!agent) throw new Error(`Unknown SDR agent: ${agentId}`);
  const session = await sessionForLead(leadId);
  const result: any = await run(agent as any, `Lead id: ${leadId}\nGoal: ${goal || 'Advance this lead toward a meeting.'}`, {
    session,
    maxTurns: 12,
  } as any);
  if (result.interruptions?.length) {
    return {
      status: 'approval_required' as const,
      state: result.state.toString(),
      approvals: result.interruptions.map((i: any) => ({
        callId: i.rawItem?.callId ?? i.rawItem?.id,
        tool: i.name,
        arguments: (() => { try { return JSON.parse(i.arguments || '{}'); } catch { return i.arguments; } })(),
      })),
    };
  }
  return { status: 'final' as const, agent: result.lastAgent?.name as string | undefined, output: result.finalOutput as SdrOutputT | string | null };
}
