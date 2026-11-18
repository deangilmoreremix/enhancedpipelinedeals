/**
 * Manual trigger for the workflow runner: POST /api/workflow/run (authenticated; admin / manager role, or the service key).
 * Rate limit is per user and persistent (RPC check_rate_limit, service role); the in-memory limiter is only a fallback
 * for databases where that RPC has not been migrated yet.
 * Scheduled invocation lives in workflow-runner.ts.
 */
import { authUser, callerRole, rateLimited, CORS_HEADERS } from './_openai';
import { rerunExecution, resumeExecution, runWorkflowBatch, runWorkflowManually, serviceClient } from './workflow-runner';

const RUN_NOW_LIMIT = 6;
const RUN_NOW_WINDOW_SECONDS = 60;

/** true = allowed, false = limited, null = the limiter itself failed (caller decides). */
async function runNowAllowed(db: NonNullable<ReturnType<typeof serviceClient>>, userId: string): Promise<boolean | null> {
  const key = `run-now:${userId}`;
  const { data, error } = await (db as any).rpc('check_rate_limit', { p_key: key, p_limit: RUN_NOW_LIMIT, p_window_seconds: RUN_NOW_WINDOW_SECONDS });
  if (!error) return data === true;
  const missing = error.code === 'PGRST202' || error.code === '42883' || /could not find the function|function .* does not exist/i.test(error.message || '');
  if (missing) {
    console.warn('[workflow-run-now] check_rate_limit RPC not found; falling back to the in-memory limiter (apply the migration)');
    return !rateLimited(key, RUN_NOW_LIMIT, RUN_NOW_WINDOW_SECONDS * 1000);
  }
  console.error('[workflow-run-now] check_rate_limit failed:', error.message);
  return null;
}

const headers = { 'Content-Type': 'application/json', ...CORS_HEADERS };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'Method not allowed' });
  const authHeader = req.headers.get('authorization') || undefined;
  const user = await authUser(authHeader);
  if (!user) return reply(401, { ok: false, error: 'Unauthorized' });
  // runs every user's due workflows with the service role: only admins / managers (or server-to-server callers) may trigger it
  if (!user.service) {
    const role = await callerRole(authHeader);
    if (role !== 'admin' && role !== 'manager') return reply(403, { ok: false, error: 'Admin or manager role required' });
  }
  const db = serviceClient();
  if (!db) return reply(500, { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  const allowed = await runNowAllowed(db, user.id);
  if (allowed === null) return reply(503, { ok: false, error: 'Rate limit check unavailable' });
  if (!allowed) return reply(429, { ok: false, error: 'Rate limit exceeded' });
  // Optional body: { action: 'rerun' | 'resume', executionId } re-runs / resumes one recorded run.
  const body = (await req.json().catch(() => ({}))) as { action?: string; executionId?: string; workflowId?: string; dealId?: string };
  if (body.action === 'manual') {
    if (!body.workflowId || !body.dealId) return reply(400, { ok: false, error: 'workflowId and dealId are required' });
    try {
      const r = await runWorkflowManually({ db }, { workflowId: body.workflowId, dealId: body.dealId });
      return reply(r.ok ? 200 : 422, r);
    } catch (e) {
      return reply(500, { ok: false, error: e instanceof Error ? e.message : 'Run failed' });
    }
  }
  if (body.executionId && (body.action === 'rerun' || body.action === 'resume')) {
    try {
      const r = body.action === 'rerun'
        ? await rerunExecution({ db }, body.executionId)
        : await resumeExecution({ db }, body.executionId);
      return reply(r.ok ? 200 : 422, r);
    } catch (e) {
      return reply(500, { ok: false, error: e instanceof Error ? e.message : 'Run failed' });
    }
  }
  const summary = await runWorkflowBatch({ db });
  return reply(200, { ok: summary.errors.length === 0, ...summary });
};

export const config = { path: '/api/workflow/run' };
