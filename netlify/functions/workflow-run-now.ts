/**
 * Manual trigger for the workflow runner: POST /api/workflow/run (authenticated).
 * Scheduled invocation lives in workflow-runner.ts.
 */
import { authorize, rateLimited, CORS_HEADERS } from './_openai';
import { runWorkflowBatch, serviceClient } from './workflow-runner';

const headers = { 'Content-Type': 'application/json', ...CORS_HEADERS };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'Method not allowed' });
  if (!(await authorize(req.headers.get('authorization') || undefined))) return reply(401, { ok: false, error: 'Unauthorized' });
  if (rateLimited(req.headers.get('x-nf-client-connection-ip') || 'anon', 6)) return reply(429, { ok: false, error: 'Rate limit exceeded' });
  const db = serviceClient();
  if (!db) return reply(500, { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  const summary = await runWorkflowBatch({ db });
  return reply(200, { ok: summary.errors.length === 0, ...summary });
};

export const config = { path: '/api/workflow/run' };
