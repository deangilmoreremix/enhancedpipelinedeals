/**
 * Server-safe workflow step executors + graph runner for the Netlify workflow-runner.
 * No browser-only imports. Side effects go through injected dependencies (`db`, `ai`, `fetchImpl`)
 * so everything here is unit-testable.
 */
import { compareValues, evaluateConditions, getPath, type MatchCondition } from '../../src/services/workflowTriggerMatch';
import { conditionTargets, iteratorTargets, type BranchLabel } from '../../src/services/workflowBranching';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal Supabase-like client (supabase-js satisfies this). */
export interface DbLike {
  from(table: string): any;
}

export interface StepContext {
  recordId?: string;
  recordType?: string;
  inputData: Record<string, any>;
  variables: Record<string, any>;
  /** Output of the previously executed step (used by filter/iterator). */
  lastOutput?: any;
  /** Outputs of executed steps by step id, addressable as `{{steps.<id>.output.<key>}}`. */
  stepOutputs?: Record<string, { output?: any }>;
  eventId?: string;
  workflowId?: string;
}

export interface ServerAction {
  type: string;
  name?: string;
  config?: Record<string, any>;
  conditions?: MatchCondition[];
  errorHandling?: { continueOnError?: boolean };
}

export interface ServerStep {
  id: string;
  name?: string;
  type: 'trigger' | 'action' | 'condition' | 'delay' | string;
  action?: ServerAction;
  condition?: MatchCondition;
  /** minutes, for type 'delay' */
  delay?: number;
  connections?: string[];
  /** Optional branch label per target step id. */
  connectionLabels?: Record<string, BranchLabel | string | undefined>;
  isActive?: boolean;
}

export interface StepResult {
  success: boolean;
  output?: any;
  error?: string;
  /** Stop following this branch (filter/condition not met). */
  halt?: boolean;
  /** Pause this branch and resume its connections after N minutes. */
  delayMinutes?: number;
}

export interface StepDeps {
  db: DbLike;
  /** AI completion; defaults to OpenAI Responses via ./_openai. */
  ai?: (prompt: string, opts: { model?: string; instructions?: string }) => Promise<string>;
  fetchImpl?: typeof fetch;
  /** Resolve a hostname to IP addresses (default: node dns). */
  resolveHost?: (host: string) => Promise<string[]>;
  now?: () => Date;
}

export interface ExecutedStep {
  id: string;
  stepId: string;
  status: 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt: string;
  duration: number;
  output?: any;
  error?: string;
}

export interface ResumePoint {
  stepIds: string[];
  delayMinutes: number;
  variables: Record<string, any>;
}

export interface GraphResult {
  status: 'completed' | 'failed' | 'waiting';
  steps: ExecutedStep[];
  error?: { message: string; stepId?: string };
  resumes: ResumePoint[];
}

// ---------------------------------------------------------------------------
// Variable interpolation
// ---------------------------------------------------------------------------

function scope(ctx: StepContext): Record<string, unknown> {
  return {
    ...ctx.inputData,
    ...ctx.variables,
    recordId: ctx.recordId,
    recordType: ctx.recordType,
    /** `{{trigger.<key>}}`: the event payload / record the workflow started from. */
    trigger: ctx.inputData,
    /** `{{steps.<stepId>.output.<key>}}`: output of an earlier step. */
    steps: ctx.stepOutputs ?? {}
  };
}

/**
 * Replaces `{{path.to.value}}` (unresolved placeholders are kept). Resolvable roots: record fields and
 * payload keys (`{{title}}`, `{{record.title}}`), `{{trigger.<key>}}`, `{{steps.<stepId>.output.<key>}}`,
 * `{{recordId}}`, run variables such as `{{aiResult}}` and the iterator item (`{{item.<key>}}`).
 */
export function interpolate<T>(value: T, ctx: StepContext): T {
  const s = scope(ctx);
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      return v.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path: string) => {
        const r = getPath(s, path);
        return r === undefined || r === null ? match : String(r);
      });
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return walk(value) as T;
}

// ---------------------------------------------------------------------------
// HTTP safety
// ---------------------------------------------------------------------------

export function isPrivateIp(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (v.includes(':')) {
    return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff');
  }
  return false;
}

async function defaultResolve(host: string): Promise<string[]> {
  const dns = await import('node:dns');
  const res = await dns.promises.lookup(host, { all: true });
  return res.map(r => r.address);
}

/** Throws unless `rawUrl` is https and does not point at a private/internal address. */
export async function assertSafeUrl(rawUrl: string, resolveHost: (h: string) => Promise<string[]> = defaultResolve): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'https:') throw new Error('Only https URLs are allowed');
  if (url.username || url.password) throw new Error('Credentials in URL are not allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new Error('Blocked host');
  }
  const literal = /^[\d.]+$/.test(host) || host.includes(':');
  const addrs = literal ? [host] : await resolveHost(host);
  if (!addrs.length) throw new Error('Host did not resolve');
  if (addrs.some(isPrivateIp)) throw new Error('Blocked: URL resolves to a private address');
  return url;
}

const HTTP_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_CHARS = 64 * 1024;

async function safeFetch(
  rawUrl: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown },
  deps: StepDeps
): Promise<{ status: number; data: unknown }> {
  const url = await assertSafeUrl(rawUrl, deps.resolveHost);
  const method = (init.method || 'GET').toUpperCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await (deps.fetchImpl ?? fetch)(url.toString(), {
      method,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      body: init.body !== undefined && method !== 'GET' ? JSON.stringify(init.body) : undefined,
      redirect: 'error',
      signal: controller.signal
    });
    const text = (await res.text()).slice(0, MAX_RESPONSE_CHARS);
    let data: unknown = text;
    try { data = JSON.parse(text); } catch { /* keep text */ }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { status: res.status, data };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('Request timed out after 10s');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Record helpers
// ---------------------------------------------------------------------------

const TABLES: Record<string, string> = { deal: 'deals', contact: 'contacts', company: 'companies', task: 'tasks' };

/** Columns a workflow may never write. */
const PROTECTED_COLUMNS = new Set(['id', 'created_at', 'created_by', 'user_id', 'deleted_at', 'tsv']);

export function sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([k]) => /^[a-z][a-z0-9_]*$/.test(k) && !PROTECTED_COLUMNS.has(k))
  );
}

const asString = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : v == null ? fallback : String(v));

function dealIdOf(ctx: StepContext): string | null {
  return ctx.recordType === 'deal' || !ctx.recordType ? ctx.recordId ?? null : null;
}

function fail(e: unknown, fallback: string): StepResult {
  return { success: false, error: e instanceof Error ? e.message : fallback };
}

// ---------------------------------------------------------------------------
// Executors
// ---------------------------------------------------------------------------

export async function executeCreateTask(action: ServerAction, ctx: StepContext, deps: StepDeps): Promise<StepResult> {
  try {
    const cfg = interpolate(action.config ?? {}, ctx);
    const f = (cfg.fields ?? {}) as Record<string, any>;
    const title = asString(f.title ?? cfg.title ?? action.name, 'Follow up');
    let due: string | null = null;
    if (f.due_date) due = new Date(f.due_date).toISOString();
    else if (typeof f.dueInDays === 'number') due = new Date((deps.now?.() ?? new Date()).getTime() + f.dueInDays * 86_400_000).toISOString();
    const row = {
      title,
      notes: f.notes ?? cfg.description ?? null,
      due_date: due,
      status: 'open',
      deal_id: dealIdOf(ctx),
      created_by_agent: true
    };
    const { data, error } = await deps.db.from('tasks').insert(row).select().single();
    if (error) throw new Error(error.message);
    return { success: true, output: { taskId: data?.id, task: data } };
  } catch (e) {
    return fail(e, 'Failed to create task');
  }
}

export async function executeCreateNote(action: ServerAction, ctx: StepContext, deps: StepDeps): Promise<StepResult> {
  try {
    const cfg = interpolate(action.config ?? {}, ctx);
    const dealId = dealIdOf(ctx);
    if (!dealId) throw new Error('create_note requires a deal record');
    const text = asString(cfg.body ?? cfg.notificationMessage ?? (cfg.fields as any)?.body, '');
    if (!text) throw new Error('Note body is empty');
    const { data, error } = await deps.db
      .from('notes')
      .insert({ deal_id: dealId, title: asString(cfg.subject ?? action.name, 'Workflow note'), body_text: text })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { success: true, output: { noteId: data?.id } };
  } catch (e) {
    return fail(e, 'Failed to create note');
  }
}

export async function executeUpdateRecord(action: ServerAction, ctx: StepContext, deps: StepDeps): Promise<StepResult> {
  try {
    const cfg = interpolate(action.config ?? {}, ctx);
    const recordType = asString(cfg.recordType ?? ctx.recordType ?? 'deal');
    const table = TABLES[recordType];
    if (!table) throw new Error(`Unsupported record type: ${recordType}`);
    if (!ctx.recordId) throw new Error('No record to update');

    let fields = sanitizeFields((cfg.fields ?? {}) as Record<string, unknown>);
    if (action.type === 'update_stage' && cfg.newStage) fields = { ...fields, stage: cfg.newStage };
    if (action.type === 'assign_owner' && cfg.newOwner) fields = { ...fields, owner_id: cfg.newOwner };
    if (Object.keys(fields).length === 0) throw new Error('No fields to update');

    const { data, error } = await deps.db
      .from(table)
      .update({ ...fields, updated_at: (deps.now?.() ?? new Date()).toISOString() })
      .eq('id', ctx.recordId)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { success: true, output: { updated: Boolean(data), fields } };
  } catch (e) {
    return fail(e, 'Failed to update record');
  }
}

export async function executeCreateRecord(action: ServerAction, ctx: StepContext, deps: StepDeps): Promise<StepResult> {
  try {
    const cfg = interpolate(action.config ?? {}, ctx);
    const table = TABLES[asString(cfg.recordType ?? 'deal')];
    if (!table) throw new Error('Unsupported record type');
    const fields = sanitizeFields((cfg.fields ?? {}) as Record<string, unknown>);
    const { data, error } = await deps.db.from(table).insert(fields).select().single();
    if (error) throw new Error(error.message);
    return { success: true, output: { id: data?.id, record: data } };
  } catch (e) {
    return fail(e, 'Failed to create record');
  }
}

export async function executeSearchRecords(action: ServerAction, ctx: StepContext, deps: StepDeps): Promise<StepResult> {
  try {
    const cfg = interpolate(action.config ?? {}, ctx);
    const table = TABLES[asString(cfg.recordType ?? 'deal')];
    if (!table) throw new Error('Unsupported record type');
    let q = deps.db.from(table).select('*').limit(50);
    for (const [k, v] of Object.entries(sanitizeFields((cfg.searchCriteria ?? {}) as Record<string, unknown>))) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { success: true, output: { records: data ?? [], count: (data ?? []).length } };
  } catch (e) {
    return fail(e, 'Search failed');
  }
}

export async function executeSendEmail(action: ServerAction, ctx: StepContext, deps: StepDeps): Promise<StepResult> {
  try {
    const cfg = interpolate(action.config ?? {}, ctx);
    let recipients: string[] = Array.isArray(cfg.recipients) ? cfg.recipients.map(String) : cfg.recipients ? [String(cfg.recipients)] : [];
    const dealId = dealIdOf(ctx);
    if (recipients.length === 0 && dealId) {
      const { data: deal } = await deps.db.from('deals').select('contact_id').eq('id', dealId).maybeSingle();
      if (deal?.contact_id) {
        const { data: c } = await deps.db.from('contacts').select('email').eq('id', deal.contact_id).maybeSingle();
        if (c?.email) recipients = [c.email];
      }
    }
    recipients = recipients.filter(r => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r));
    if (recipients.length === 0) throw new Error('No valid recipient for email');
    const rows = recipients.map(r => ({
      deal_id: dealId,
      channel: 'email',
      recipient: r,
      subject: asString(cfg.subject),
      body: asString(cfg.body),
      status: 'queued',
      created_by_agent: true
    }));
    const { error } = await deps.db.from('outbound_messages').insert(rows);
    if (error) throw new Error(error.message);
    return { success: true, output: { queued: rows.length, recipients } };
  } catch (e) {
    return fail(e, 'Failed to queue email');
  }
}

export async function executeNotification(action: ServerAction, ctx: StepContext, deps: StepDeps): Promise<StepResult> {
  try {
    const cfg = interpolate(action.config ?? {}, ctx);
    const message = asString(cfg.notificationMessage ?? cfg.body, '');
    if (!message) throw new Error('Notification message is empty');
    const { error } = await deps.db.from('notifications').insert({
      type: 'workflow',
      title: asString(action.name, 'Workflow notification'),
      message,
      metadata: { recordId: ctx.recordId, recordType: ctx.recordType, workflowId: ctx.workflowId }
    });
    if (error) throw new Error(error.message);
    return { success: true, output: { notified: true } };
  } catch (e) {
    return fail(e, 'Failed to create notification');
  }
}

export async function executeHttpRequest(action: ServerAction, ctx: StepContext, deps: StepDeps): Promise<StepResult> {
  try {
    const cfg = interpolate(action.config ?? {}, ctx);
    const isWebhook = action.type === 'webhook';
    const url = asString(isWebhook ? cfg.webhookUrl : cfg.httpUrl);
    const out = await safeFetch(
      url,
      {
        method: asString(isWebhook ? cfg.webhookMethod ?? 'POST' : cfg.httpMethod ?? 'GET'),
        headers: (isWebhook ? cfg.webhookHeaders : cfg.httpHeaders) as Record<string, string> | undefined,
        body: isWebhook ? cfg.webhookPayload ?? { recordId: ctx.recordId, recordType: ctx.recordType } : cfg.httpBody
      },
      deps
    );
    return { success: true, output: out };
  } catch (e) {
    return fail(e, 'HTTP request failed');
  }
}

export async function executeAiAgent(action: ServerAction, ctx: StepContext, deps: StepDeps): Promise<StepResult> {
  try {
    const cfg = interpolate(action.config ?? {}, ctx);
    const prompt = asString(cfg.aiAgentPrompt);
    if (!prompt) throw new Error('AI prompt is empty');
    const context = JSON.stringify({ recordId: ctx.recordId, recordType: ctx.recordType, data: ctx.inputData }).slice(0, 6000);
    const full = `${prompt}\n\nContext (JSON):\n${context}`;
    let text: string;
    if (deps.ai) {
      text = await deps.ai(full, { model: cfg.aiAgentModel });
    } else {
      const { respond } = await import('./_openai');
      const r = await respond({
        tier: asString(cfg.aiAgentModel) || 'fast',
        instructions: 'You are a CRM automation assistant. Be concise and factual.',
        input: full,
        maxOutputTokens: 800
      });
      text = r.text;
    }
    return { success: true, output: { text } };
  } catch (e) {
    return fail(e, 'AI agent failed');
  }
}

export async function executeDeleteRecord(action: ServerAction, ctx: StepContext, deps: StepDeps): Promise<StepResult> {
  try {
    const cfg = interpolate(action.config ?? {}, ctx);
    const table = TABLES[asString(cfg.recordType ?? ctx.recordType ?? 'deal')];
    if (!table) throw new Error('Unsupported record type');
    if (!ctx.recordId) throw new Error('No record to delete');
    const { error } = await deps.db.from(table).delete().eq('id', ctx.recordId);
    if (error) throw new Error(error.message);
    return { success: true, output: { recordId: ctx.recordId, deleted: true } };
  } catch (e) {
    return fail(e, 'Failed to delete record');
  }
}

export async function executeUpsertRecord(action: ServerAction, ctx: StepContext, deps: StepDeps): Promise<StepResult> {
  try {
    const cfg = interpolate(action.config ?? {}, ctx);
    const table = TABLES[asString(cfg.recordType ?? 'deal')];
    if (!table) throw new Error('Unsupported record type');
    const fields = sanitizeFields((cfg.fields ?? {}) as Record<string, unknown>);
    const key = asString(cfg.upsertKey);
    if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new Error('Upsert key is required');
    if (fields[key] === undefined) throw new Error(`Upsert key "${key}" is missing from fields`);
    const { data: existing, error: findError } = await deps.db.from(table).select('id').eq(key, fields[key]).limit(1).maybeSingle();
    if (findError) throw new Error(findError.message);
    if (existing?.id) {
      const { error } = await deps.db.from(table).update({ ...fields, updated_at: (deps.now?.() ?? new Date()).toISOString() }).eq('id', existing.id);
      if (error) throw new Error(error.message);
      return { success: true, output: { id: existing.id, created: false } };
    }
    const { data, error } = await deps.db.from(table).insert(fields).select().single();
    if (error) throw new Error(error.message);
    return { success: true, output: { id: data?.id, created: true, record: data } };
  } catch (e) {
    return fail(e, 'Failed to upsert record');
  }
}

export function executeFilter(action: ServerAction, ctx: StepContext): StepResult {
  try {
    const criteria = interpolate((action.config?.filterCriteria ?? {}) as Record<string, any>, ctx);
    const matches = (rec: Record<string, any>) =>
      Object.entries(criteria).every(([key, cond]) =>
        cond && typeof cond === 'object' && 'operator' in cond
          ? compareValues(getPath(rec, key), String(cond.operator), cond.value)
          : getPath(rec, key) === cond
      );
    const records: any[] | undefined = ctx.lastOutput?.records;
    if (Array.isArray(records)) {
      const filtered = records.filter(matches);
      return { success: true, output: { records: filtered, count: filtered.length }, halt: filtered.length === 0 };
    }
    // No record list upstream: gate on the triggering record itself.
    const passed = matches({ ...ctx.inputData, ...ctx.variables });
    return { success: true, output: { passed }, halt: !passed };
  } catch (e) {
    return fail(e, 'Filter failed');
  }
}

export function executeDelay(minutesRaw: unknown): StepResult {
  const minutes = Math.max(0, Number(minutesRaw) || 0);
  return { success: true, output: { delayMinutes: minutes }, delayMinutes: minutes };
}

/**
 * Action types `executeAction` can run. Kept next to the dispatcher and checked against
 * workflowActionRegistry (`engines.server`) by src/tests/workflowRegistry.test.ts.
 * (`code` is intentionally absent: it is client-only.)
 */
export const HANDLED_ACTION_KEYS: readonly string[] = [
  'create_task', 'create_note', 'add_comment', 'update_record', 'update_stage', 'assign_owner',
  'create_record', 'search_records', 'delete_record', 'upsert_record', 'send_email', 'notification',
  'http_request', 'webhook', 'ai_agent', 'filter', 'delay', 'iterator'
];

/** Dispatch a single action. Conditions on the action are honoured (unmet => skipped). */
export async function executeAction(action: ServerAction, ctx: StepContext, deps: StepDeps): Promise<StepResult> {
  if (action.conditions?.length && !evaluateConditions(action.conditions, scope(ctx))) {
    return { success: true, output: { skipped: true, reason: 'Conditions not met' } };
  }
  switch (action.type) {
    case 'create_task': return executeCreateTask(action, ctx, deps);
    case 'create_note':
    case 'add_comment': return executeCreateNote(action, ctx, deps);
    case 'update_record':
    case 'update_stage':
    case 'assign_owner': return executeUpdateRecord(action, ctx, deps);
    case 'create_record': return executeCreateRecord(action, ctx, deps);
    case 'search_records': return executeSearchRecords(action, ctx, deps);
    case 'delete_record': return executeDeleteRecord(action, ctx, deps);
    case 'upsert_record': return executeUpsertRecord(action, ctx, deps);
    case 'send_email': return executeSendEmail(action, ctx, deps);
    case 'notification': return executeNotification(action, ctx, deps);
    case 'http_request':
    case 'webhook': return executeHttpRequest(action, ctx, deps);
    case 'ai_agent': return executeAiAgent(action, ctx, deps);
    case 'filter': return executeFilter(action, ctx);
    case 'delay': return executeDelay(action.config?.delayMinutes);
    case 'iterator': return executeIteratorSource(action, ctx);
    case 'code':
      return { success: false, error: 'Code actions are not supported server-side' };
    default:
      return { success: false, error: `Unsupported action type: ${action.type}` };
  }
}

function executeIteratorSource(action: ServerAction, ctx: StepContext): StepResult {
  const cfg = action.config ?? {};
  let items: any[] = [];
  if (cfg.iteratorSource === 'array') items = ctx.variables[cfg.iteratorVariable || 'array'] ?? [];
  else if (cfg.iteratorSource === 'query_result') items = ctx.lastOutput?.records ?? [];
  else items = ctx.inputData.records ?? ctx.lastOutput?.records ?? [];
  if (!Array.isArray(items)) items = [];
  return { success: true, output: { items: items.slice(0, 100), count: items.length } };
}

// ---------------------------------------------------------------------------
// Graph runner
// ---------------------------------------------------------------------------

const MAX_STEP_EXECUTIONS = 200;
const nowIso = (deps: StepDeps) => (deps.now?.() ?? new Date()).toISOString();

/** Steps to start from: explicit trigger steps, else steps nothing connects to. */
export function entryStepIds(steps: ServerStep[]): string[] {
  const active = steps.filter(s => s.isActive !== false);
  const triggers = active.filter(s => s.type === 'trigger');
  if (triggers.length) return triggers.map(s => s.id);
  const targets = new Set(active.flatMap(s => s.connections ?? []));
  return active.filter(s => !targets.has(s.id)).map(s => s.id);
}

interface RunState { steps: ExecutedStep[]; resumes: ResumePoint[]; count: number; error?: { message: string; stepId?: string } }

async function runBranch(
  startIds: string[],
  stepMap: Map<string, ServerStep>,
  ctx: StepContext,
  deps: StepDeps,
  state: RunState
): Promise<void> {
  const queue = [...startIds];
  const visited = new Set<string>();

  while (queue.length && !state.error) {
    const id = queue.shift() as string;
    if (visited.has(id)) continue;
    visited.add(id);
    const step = stepMap.get(id);
    if (!step || step.isActive === false) continue;
    if (++state.count > MAX_STEP_EXECUTIONS) {
      state.error = { message: `Step limit (${MAX_STEP_EXECUTIONS}) exceeded`, stepId: id };
      return;
    }

    const started = Date.now();
    const startedAt = nowIso(deps);
    let result: StepResult;
    try {
      if (step.type === 'trigger') result = { success: true };
      else if (step.type === 'condition') {
        const ok = step.condition ? evaluateConditions([step.condition], scope(ctx)) : true;
        result = { success: true, output: { matched: ok } };
      } else if (step.type === 'delay') result = executeDelay(step.delay);
      else if (step.type === 'action' && step.action) result = await executeAction(step.action, ctx, deps);
      else result = { success: false, error: `Unknown step type: ${step.type}` };
    } catch (e) {
      result = fail(e, 'Step threw');
    }

    const skipped = Boolean(result.output && (result.output as any).skipped);
    state.steps.push({
      id: `${id}:${state.steps.length}`,
      stepId: id,
      status: result.success ? (skipped ? 'skipped' : 'completed') : 'failed',
      startedAt,
      completedAt: nowIso(deps),
      duration: Date.now() - started,
      output: result.output,
      error: result.error
    });

    if (!result.success) {
      if (step.action?.errorHandling?.continueOnError) {
        queue.push(...(step.connections ?? []));
        continue;
      }
      state.error = { message: result.error || 'Step failed', stepId: id };
      return;
    }

    if (result.output !== undefined) {
      ctx.lastOutput = result.output;
      ctx.stepOutputs = { ...(ctx.stepOutputs ?? {}), [id]: { output: result.output } };
    }
    if (step.action?.type === 'ai_agent' && result.output) ctx.variables = { ...ctx.variables, aiResult: (result.output as any).text };
    if (result.halt) continue;

    let next = step.connections ?? [];
    if (step.type === 'condition') {
      next = conditionTargets(step, Boolean((result.output as any)?.matched));
      if (next.length === 0) continue;
    }
    if (typeof result.delayMinutes === 'number' && result.delayMinutes > 0) {
      if (next.length) state.resumes.push({ stepIds: next, delayMinutes: result.delayMinutes, variables: ctx.variables });
      continue;
    }

    const isIterator = step.type === 'action' && step.action?.type === 'iterator';
    if (isIterator) {
      const items: any[] = (result.output as any)?.items ?? [];
      const varName = step.action?.config?.iteratorVariable || 'currentItem';
      const { item: perItem, done } = iteratorTargets(step);
      for (const item of items) {
        const sub: StepContext = { ...ctx, variables: { ...ctx.variables, [varName]: item, ...(typeof item === 'object' && item ? { item } : {}) }, lastOutput: { item } };
        await runBranch(perItem, stepMap, sub, deps, state);
        if (state.error) return;
      }
      queue.push(...done);
      continue;
    }

    queue.push(...next);
  }
}

/** Runs a workflow's step graph. `startIds` resumes from specific steps (after a delay). */
export async function runWorkflowGraph(
  steps: ServerStep[],
  ctx: StepContext,
  deps: StepDeps,
  startIds?: string[]
): Promise<GraphResult> {
  const stepMap = new Map(steps.map(s => [s.id, s]));
  const state: RunState = { steps: [], resumes: [], count: 0 };
  await runBranch(startIds ?? entryStepIds(steps), stepMap, { ...ctx, variables: { ...ctx.variables } }, deps, state);
  return {
    status: state.error ? 'failed' : state.resumes.length ? 'waiting' : 'completed',
    steps: state.steps,
    error: state.error,
    resumes: state.resumes
  };
}
