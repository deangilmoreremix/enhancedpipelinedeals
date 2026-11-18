import { supabase, isSupabaseConfigured } from './supabaseService';
import { isDemoMode } from '../config/demoMode';

/**
 * Workflow versioning. `deal_workflows` is the LIVE row: the runner always executes it, whatever the Published
 * badge says. Publishing snapshots the live row into `workflow_versions` (publish_workflow_version) and records
 * `published_version`; "Restore as draft" copies a snapshot back onto the live row (restore_workflow_version),
 * so after a restore the live row differs from the published snapshot until it is published again.
 */
export type VersionStatus = 'draft' | 'published' | 'archived';

export interface WorkflowSnapshot {
  name?: string;
  description?: string | null;
  stages?: any[];
  triggers?: any[];
  settings?: Record<string, unknown>;
  category?: string | null;
}

export interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version: number;
  status: VersionStatus;
  snapshot: WorkflowSnapshot;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export const canUseRemoteVersions = (): boolean => isSupabaseConfigured && !isDemoMode();

// In-memory fallback (demo mode has no workflow store at all; this keeps the UI functional and never crashes).
const localVersions: Record<string, WorkflowVersion[]> = {};
export const __resetLocalVersions = (): void => { Object.keys(localVersions).forEach(k => delete localVersions[k]); };

export async function listVersions(workflowId: string): Promise<WorkflowVersion[]> {
  if (!canUseRemoteVersions()) return [...(localVersions[workflowId] ?? [])].sort((a, b) => b.version - a.version);
  const { data, error } = await supabase.from('workflow_versions').select('*').eq('workflow_id', workflowId).order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkflowVersion[];
}

/** Snapshot of the live workflow as the SQL function stores it. */
export function snapshotOf(w: { name: string; description?: string; steps: any[]; triggers?: any[]; settings?: any; category?: string }): WorkflowSnapshot {
  return { name: w.name, description: w.description ?? null, stages: w.steps, triggers: w.triggers ?? [], settings: w.settings ?? {}, category: w.category ?? null };
}

/** Publishes the live row. Returns the new version number. `live` is only used by the local fallback. */
export async function publishVersion(workflowId: string, note: string, live?: WorkflowSnapshot): Promise<number> {
  if (!canUseRemoteVersions()) {
    const list = localVersions[workflowId] ?? [];
    const v = (list.reduce((m, x) => Math.max(m, x.version), 0)) + 1;
    localVersions[workflowId] = [
      ...list.map(x => (x.status === 'published' ? { ...x, status: 'archived' as const } : x)),
      { id: `local-${workflowId}-${v}`, workflow_id: workflowId, version: v, status: 'published', snapshot: live ?? {}, note: note.trim() || null, created_by: null, created_at: new Date().toISOString() },
    ];
    return v;
  }
  const { data, error } = await supabase.rpc('publish_workflow_version', { p_workflow_id: workflowId, p_note: note.trim() || null });
  if (error) throw error;
  const v = Number(Array.isArray(data) ? data[0] : data);
  if (!Number.isFinite(v)) throw new Error('Publish did not return a version number');
  return v;
}

export async function restoreVersion(workflowId: string, version: number): Promise<void> {
  if (!canUseRemoteVersions()) {
    if (!(localVersions[workflowId] ?? []).some(v => v.version === version)) throw new Error('workflow version not found');
    return;
  }
  const { error } = await supabase.rpc('restore_workflow_version', { p_workflow_id: workflowId, p_version: version });
  if (error) throw error;
}

/** Published version number + webhook settings of the live row. */
export interface WorkflowLiveMeta { published_version: number | null; webhook_enabled: boolean; webhook_token: string | null; snapshot: WorkflowSnapshot | null }

export async function getLiveMeta(workflowId: string): Promise<WorkflowLiveMeta> {
  if (!canUseRemoteVersions()) {
    const pub = (localVersions[workflowId] ?? []).find(v => v.status === 'published');
    return { published_version: pub?.version ?? null, webhook_enabled: localWebhook[workflowId]?.enabled ?? false, webhook_token: localWebhook[workflowId]?.token ?? null, snapshot: null };
  }
  const { data, error } = await supabase.from('deal_workflows').select('name,description,stages,triggers,settings,category,published_version,webhook_enabled,webhook_token').eq('id', workflowId).maybeSingle();
  if (error) throw error;
  return {
    published_version: data?.published_version ?? null, webhook_enabled: !!data?.webhook_enabled, webhook_token: data?.webhook_token ?? null,
    snapshot: data ? { name: data.name, description: data.description ?? null, stages: data.stages ?? [], triggers: data.triggers ?? [], settings: data.settings ?? {}, category: data.category ?? null } : null,
  };
}

// ---- inbound webhook trigger --------------------------------------------------------------------------------
const localWebhook: Record<string, { enabled: boolean; token: string | null }> = {};
const newToken = () => Array.from({ length: 48 }, () => 'abcdef0123456789'[Math.floor(Math.random() * 16)]).join('');

/** Enable (and mint a token) / rotate (new token) / disable the inbound webhook. Returns the new token or null when disabled. */
export async function setWebhook(workflowId: string, enable: boolean): Promise<string | null> {
  if (!canUseRemoteVersions()) {
    const tok = enable ? newToken() : null;
    localWebhook[workflowId] = { enabled: enable, token: enable ? tok : localWebhook[workflowId]?.token ?? null };
    return tok;
  }
  const { data, error } = await supabase.rpc('rotate_workflow_webhook_token', { p_workflow_id: workflowId, p_enable: enable });
  if (error) throw error;
  return enable ? String(data) : null;
}

/** Inbound URL for a token. */
export const webhookUrl = (origin: string, token: string): string => `${origin}/api/workflow/hook/${token}`;

export function webhookCurl(url: string): string {
  return `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"deal_id":"OPTIONAL_DEAL_ID","data":{"source":"my-system"}}'`;
}

// ---- diff ----------------------------------------------------------------------------------------------------
export interface VersionDiff {
  added: string[];
  removed: string[];
  changed: string[];
  nameChanged: boolean;
  triggersChanged: boolean;
  settingsChanged: boolean;
  /** True when nothing differs. */
  identical: boolean;
}

/** Stable JSON (sorted keys) for comparisons; canvas position is ignored so dragging a node is not a "change". */
export function stableStringify(v: unknown): string {
  const norm = (x: any): any => {
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === 'object') {
      return Object.keys(x).filter(k => k !== 'position').sort().reduce((o: any, k) => { o[k] = norm(x[k]); return o; }, {});
    }
    return x;
  };
  return JSON.stringify(norm(v));
}

const stepLabel = (s: any): string => String(s?.name || s?.action?.name || s?.type || s?.id || 'Step');

/** Steps added / removed / changed between two snapshots (matched by step id). `a` = older, `b` = newer. */
export function diffSnapshots(a: WorkflowSnapshot | null | undefined, b: WorkflowSnapshot | null | undefined): VersionDiff {
  const sa = new Map((a?.stages ?? []).map((s: any, i: number) => [String(s?.id ?? `i${i}`), s]));
  const sb = new Map((b?.stages ?? []).map((s: any, i: number) => [String(s?.id ?? `i${i}`), s]));
  const added: string[] = []; const removed: string[] = []; const changed: string[] = [];
  sb.forEach((s, id) => { if (!sa.has(id)) added.push(stepLabel(s)); else if (stableStringify(sa.get(id)) !== stableStringify(s)) changed.push(stepLabel(s)); });
  sa.forEach((s, id) => { if (!sb.has(id)) removed.push(stepLabel(s)); });
  const nameChanged = (a?.name ?? '') !== (b?.name ?? '');
  const triggersChanged = stableStringify(a?.triggers ?? []) !== stableStringify(b?.triggers ?? []);
  const settingsChanged = stableStringify(a?.settings ?? {}) !== stableStringify(b?.settings ?? {});
  return { added, removed, changed, nameChanged, triggersChanged, settingsChanged, identical: !added.length && !removed.length && !changed.length && !nameChanged && !triggersChanged && !settingsChanged };
}

/** One-line summary, e.g. "2 steps added, 1 removed, 3 changed". */
export function summarizeDiff(d: VersionDiff): string {
  if (d.identical) return 'No changes';
  const parts: string[] = [];
  const n = (c: number, w: string) => `${c} step${c === 1 ? '' : 's'} ${w}`;
  if (d.added.length) parts.push(n(d.added.length, 'added'));
  if (d.removed.length) parts.push(`${d.removed.length} removed`);
  if (d.changed.length) parts.push(`${d.changed.length} changed`);
  if (d.nameChanged) parts.push('renamed');
  if (d.triggersChanged) parts.push('triggers changed');
  if (d.settingsChanged) parts.push('settings changed');
  return parts.join(', ');
}

/** Badge text: "Draft" when never published or live differs from the published snapshot, else "Published vN". */
export function badgeFor(publishedVersion: number | null, liveSnapshot: WorkflowSnapshot | null, publishedSnapshot: WorkflowSnapshot | null, dirty: boolean): { label: string; kind: 'draft' | 'published' } {
  if (publishedVersion == null) return { label: 'Draft', kind: 'draft' };
  if (dirty || (liveSnapshot && publishedSnapshot && !diffSnapshots(publishedSnapshot, liveSnapshot).identical)) return { label: `Draft (published v${publishedVersion})`, kind: 'draft' };
  return { label: `Published v${publishedVersion}`, kind: 'published' };
}

export const WorkflowVersionService = { listVersions, publishVersion, restoreVersion, getLiveMeta, setWebhook, diffSnapshots, summarizeDiff };

export interface WorkflowWebhookRow { id: string; name: string; webhook_enabled: boolean; webhook_token: string | null }

/** All workflows with their inbound webhook state (Settings > Webhooks). Empty in demo mode (no workflow store). */
export async function listWorkflowWebhooks(): Promise<WorkflowWebhookRow[]> {
  if (!canUseRemoteVersions()) return [];
  const { data, error } = await supabase.from('deal_workflows').select('id,name,webhook_enabled,webhook_token').order('name');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, webhook_enabled: !!r.webhook_enabled, webhook_token: r.webhook_token ?? null }));
}
