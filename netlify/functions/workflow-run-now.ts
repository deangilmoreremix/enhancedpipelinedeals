/**
 * Manual trigger for the workflow runner: POST /api/workflow/run (authenticated; admin / manager role, or the service key).
 * Rate limit is per user and in-memory (per warm instance): no persistent counter table / RPC exists in the schema yet.
 * Scheduled invocation lives in workflow-runner.ts.
 */
import { authUser, callerRole, rateLimited, CORS_HEADERS } from './_openai';
import { rerunExecution, resumeExecution, runWorkflowBatch, serviceClient } from './workflow-runner';

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
  if (rateLimited(`run-now:${user.id}`, 6)) return reply(429, { ok: false, error: 'Rate limit exceeded' });
  const db = serviceClient();
  if (!db) return reply(500, { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  // Optional body: { action: 'rerun' | 'resume', executionId } re-runs / resumes one recorded run.
  const body = (await req.json().catch(() => ({}))) as { action?: string; executionId?: string };
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
