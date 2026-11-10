/**
 * AI gateway (Netlify function) — the single server-side entry point to OpenAI.
 * Replaces the deleted Supabase edge functions (ai-gateway, contact-analyzer,
 * email-generator, deal-analyzer, contact-automation, ai-enrichment,
 * social-discovery, deal-automation, sales-coach).
 *
 * POST /.netlify/functions/ai-gateway   (also /api/ai/gateway)
 * Body: { task, input?, instructions?, context?, tier?, effort?, stream? }
 * Reply: { ok, task, model, text, data, usage, id }
 *        or (stream: true) buffered text/event-stream of output_text deltas.
 */
import type { Handler } from '@netlify/functions';
import { CORS_HEADERS, json, respond, respondStream, RespondOptions, authorize, rateLimited } from './_openai';

type Obj = Record<string, unknown>;
const str = { type: 'string' };
const num = { type: 'number' };
const strArr = { type: 'array', items: str };
const obj = (properties: Obj) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

interface TaskDef {
  tier: 'fast' | 'default' | 'deep';
  system: string;
  schema?: { name: string; schema: Obj };
  jsonObject?: boolean;
  webSearch?: boolean;
}

const BASE = 'You are the AI engine of SmartCRM, a sales CRM. Be concrete, concise and factual. Never invent data that is not in the provided context; say "unknown" instead.';

export const TASKS: Record<string, TaskDef> = {
  chat: { tier: 'default', system: BASE },
  contact_analyze: {
    tier: 'default',
    system: `${BASE} Analyze the contact and return an overall engagement score (0-100), a short summary, the single best next action and key risks.`,
    schema: {
      name: 'contact_analysis',
      schema: obj({ summary: str, score: num, next_action: str, risks: strArr }),
    },
  },
  lead_score: {
    tier: 'default',
    system: `${BASE} Score the lead 0-100 using the requested qualification mode (SQL, PQL or MQL) and give the level, reasons and next steps.`,
    schema: {
      name: 'lead_score',
      schema: obj({
        score: num,
        level: { type: 'string', enum: ['SQL', 'PQL', 'MQL'] },
        reasons: strArr,
        next_steps: strArr,
      }),
    },
  },
  email_compose: {
    tier: 'default',
    system: `${BASE} Write a personalized, concise sales email in the requested tone for the stated goal. No placeholders like [Name].`,
    schema: { name: 'email', schema: obj({ subject: str, body: str }) },
  },
  web_research: {
    tier: 'default',
    webSearch: true,
    system: `${BASE} Research the person/company using web search. Cite sources.`,
    schema: {
      name: 'web_research',
      schema: obj({
        findings: strArr,
        citations: { type: 'array', items: obj({ url: str, title: str }) },
        recommendations: strArr,
      }),
    },
  },
  enrichment: {
    tier: 'default',
    jsonObject: true,
    system: `${BASE} Enrich the provided contact/company record. Return a JSON object containing only fields you can infer with reasonable confidence (e.g. title, company, industry, companySize, location, website, linkedin, twitter, tags, notes, confidence 0-100, insights[]).`,
  },
  social_discovery: {
    tier: 'fast',
    jsonObject: true,
    system: `${BASE} Return JSON: {"discoveredChannels": {"<platform>": {"url","handle","confidence","verified"}}, "brandedHashtags": []} for the company. Only include channels you are reasonably sure exist.`,
  },
  deal_analyze: {
    tier: 'default',
    jsonObject: true,
    system: `${BASE} Analyze the deal. Return JSON with: insights[], risks[], recommendations[], suggestedNextSteps[], probability (0-100), confidence (0-100), notes.`,
  },
  deal_automation: {
    tier: 'default',
    jsonObject: true,
    system: `${BASE} Design one automation sequence that progresses the deal. Return a single JSON object: {"name": string, "description": string, "trigger": string, "action": string, "steps": [{"type": "email"|"call"|"task"|"linkedin"|"wait", "name": string, "details": string, "waitDays": number}]}. Keep 5-7 concrete steps.`,
  },
  contact_automation: {
    tier: 'default',
    jsonObject: true,
    system: `${BASE} Design one lead-nurturing automation sequence for the contact. Return a single JSON object: {"name": string, "description": string, "trigger": string, "action": string, "steps": [{"type": "email"|"call"|"task"|"linkedin"|"wait", "name": string, "details": string, "waitDays": number}]}. Keep 5-7 concrete steps.`,
  },
  sales_coach: {
    tier: 'default',
    jsonObject: true,
    system: `${BASE} Act as a sales coach. Return JSON with: advice[], talkTracks[], objections[{objection,response}], summary.`,
  },
};

// Accept friendly aliases used by older callers.
const ALIASES: Record<string, string> = {
  'contact-analyze': 'contact_analyze',
  'contact-analyzer': 'contact_analyze',
  'lead-score': 'lead_score',
  'email-compose': 'email_compose',
  'email-generator': 'email_compose',
  'web-research': 'web_research',
  enrich: 'enrichment',
  'ai-enrichment': 'enrichment',
  data_enrichment: 'enrichment',
  'social-discovery': 'social_discovery',
  'discover-channels': 'social_discovery',
  'deal-analyze': 'deal_analyze',
  'deal-analyzer': 'deal_analyze',
  'deal-automation': 'deal_automation',
  'contact-automation': 'contact_automation',
  'generate-automation': 'contact_automation',
  'sales-coach': 'sales_coach',
};

// Client-defined tools: flat Responses function tools only (+ hosted web_search). The client executes them.
function clientTools(tools: unknown): any[] | undefined {
  if (!Array.isArray(tools) || !tools.length) return undefined;
  return tools
    .filter((t: any) => t && (t.type === 'web_search' || (t.type === 'function' && typeof t.name === 'string')))
    .slice(0, 64);
}

function buildInput(body: Obj): string | any[] {
  if (Array.isArray(body.messages)) return body.messages as any[];
  if (Array.isArray(body.input)) return body.input as any[]; // Responses input items (e.g. function_call_output)
  const parts: string[] = [];
  if (body.input) parts.push(typeof body.input === 'string' ? body.input : JSON.stringify(body.input));
  if (body.context) parts.push(`CONTEXT (JSON):\n${JSON.stringify(body.context, null, 2)}`);
  return parts.join('\n\n') || 'Proceed.';
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  if (!(await authorize(event.headers.authorization || event.headers.Authorization))) {
    return json(401, { ok: false, error: 'Unauthorized' });
  }
  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'anon';
  if (rateLimited(String(ip))) return json(429, { ok: false, error: 'Rate limit exceeded' });

  let body: Obj;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' });
  }

  const requested = String(body.task || body.taskType || 'chat');
  const task = ALIASES[requested] || requested;
  const def = TASKS[task];
  if (!def) return json(400, { ok: false, error: `Unknown task: ${requested}`, tasks: Object.keys(TASKS) });

  const opts: RespondOptions = {
    tier: (body.tier as string) || def.tier,
    effort: body.effort as any,
    instructions: [def.system, body.instructions].filter(Boolean).join('\n\n'),
    input: buildInput(body),
    maxOutputTokens: Number(body.maxOutputTokens) || 4000,
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    jsonSchema: def.schema,
    jsonObject: def.jsonObject || (task === 'chat' && body.json === true),
    tools: def.webSearch ? [{ type: 'web_search' }] : clientTools(body.tools),
    toolChoice: body.toolChoice as any,
    previousResponseId: typeof body.previousResponseId === 'string' ? body.previousResponseId : undefined,
    store: body.store === true || typeof body.previousResponseId === 'string',
  };
  // json_object mode requires the word "JSON" in the input/instructions (instructions mention it).

  try {
    if (body.stream === true && !def.schema && !def.jsonObject) {
      // Netlify v1 functions buffer responses, so this is a buffered SSE stream.
      let out = '';
      for await (const delta of respondStream(opts)) out += `data: ${JSON.stringify({ delta })}\n\n`;
      out += 'data: [DONE]\n\n';
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', ...CORS_HEADERS },
        body: out,
      };
    }
    const r = await respond(opts);
    return json(200, {
      ok: true,
      task,
      model: r.model,
      id: r.id,
      text: r.text,
      data: r.json ?? null,
      usage: r.usage ?? null,
      tool_calls: r.output
        .filter((i: any) => i.type === 'function_call')
        .map((i: any) => {
          let args: unknown = {};
          try { args = JSON.parse(i.arguments || '{}'); } catch { /* keep {} */ }
          return { call_id: i.call_id, name: i.name, arguments: args };
        }),
    });
  } catch (e: any) {
    const status = typeof e?.status === 'number' && e.status >= 400 && e.status < 600 ? e.status : 500;
    return json(status, { ok: false, error: e?.message || 'AI request failed' });
  }
};
