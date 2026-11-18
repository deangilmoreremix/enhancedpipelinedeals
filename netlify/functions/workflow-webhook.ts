/**
 * Inbound workflow webhook (Netlify Functions v2): POST /api/workflow/hook/:token
 * The token (workflow_webhooks.token, a service-role-only table minted by the RPC rotate_workflow_webhook_token) IS the credential, so every
 * failure to resolve it (unknown token, webhook disabled, workflow inactive) answers the same 404.
 * Body (optional JSON object): { deal_id?: string, ...anything }. The whole body is kept as the run's payload.
 * Reply 202 { ok, executionId, status }. Rate limited per token (RPC check_rate_limit).
 */
import { jsonResponse, rateAllowed, serviceDb, sha256Hex } from './_platform';
import { runWorkflowFromWebhook, type WorkflowRow } from './workflow-runner';
import type { DbLike } from './_workflowSteps';

const RATE_LIMIT = 30;
const RATE_WINDOW_S = 60;
const MAX_BODY_BYTES = 100_000;
const NOT_FOUND = { ok: false, error: 'Not found' };

export default async (req: Request, context?: { params?: Record<string, string> }): Promise<Response> => {
  if (req.method !== 'POST') return jsonResponse(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });

  const fromPath = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? '';
  const token = decodeURIComponent(context?.params?.token || fromPath);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return jsonResponse(404, NOT_FOUND);

  const db = serviceDb();
  if (!db) return jsonResponse(500, { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });

  const allowed = await rateAllowed(db, `wf-hook:${sha256Hex(token).slice(0, 32)}`, RATE_LIMIT, RATE_WINDOW_S, 'workflow-webhook');
  if (allowed === null) return jsonResponse(503, { ok: false, error: 'Rate limit check unavailable' });
  if (!allowed) return jsonResponse(429, { ok: false, error: 'Rate limit exceeded' }, { 'Retry-After': String(RATE_WINDOW_S) });

  const { data: hook, error: hookErr } = await db
    .from('workflow_webhooks')
    .select('workflow_id')
    .eq('token', token)
    .eq('enabled', true)
    .maybeSingle();
  if (hookErr || !hook) return jsonResponse(404, NOT_FOUND);
  const { data: wf, error } = await db
    .from('deal_workflows')
    .select('*')
    .eq('id', (hook as { workflow_id: string }).workflow_id)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !wf) return jsonResponse(404, NOT_FOUND);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return jsonResponse(413, { ok: false, error: 'Request body too large' });
  let payload: Record<string, unknown> = {};
  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return jsonResponse(400, { ok: false, error: 'Body must be a JSON object' });
      payload = parsed as Record<string, unknown>;
    } catch {
      return jsonResponse(400, { ok: false, error: 'Body must be valid JSON' });
    }
  }
  const dealId = typeof payload.deal_id === 'string' && payload.deal_id ? payload.deal_id : null;

  try {
    const r = await runWorkflowFromWebhook({ db: db as unknown as DbLike }, { workflow: wf as WorkflowRow, payload, dealId });
    if (!r.executionId) return jsonResponse(422, { ok: false, error: r.error || 'Run failed' });
    return jsonResponse(202, { ok: r.ok, executionId: r.executionId, status: r.status });
  } catch (e) {
    console.error('[workflow-webhook]', e instanceof Error ? e.message : e);
    return jsonResponse(500, { ok: false, error: 'Run failed' });
  }
};

export const config = { path: '/api/workflow/hook/:token' };
