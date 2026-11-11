/**
 * Helpers for recognising Row Level Security / authorisation denials coming back from
 * Supabase (PostgREST) and turning them into friendly messages.
 */

export type PermissionActionLabel =
  | 'view' | 'create' | 'edit' | 'delete' | 'bulk' | 'manage_stages' | 'manage_workflows'
  | 'manage_views' | 'import' | 'export' | 'assign' | 'move' | 'restore' | string;

const VERB: Record<string, string> = {
  view: 'view',
  create: 'create',
  edit: 'edit',
  delete: 'delete',
  bulk: 'bulk update',
  manage_stages: 'manage',
  manage_workflows: 'manage',
  manage_views: 'manage',
  import: 'import',
  export: 'export',
  assign: 'assign',
  move: 'move',
  restore: 'restore',
};

/** Error thrown/returned when an UPDATE or DELETE matched zero rows (RLS filtered it). */
export const ZERO_ROWS_CODE = 'RLS_ZERO_ROWS';

export class PermissionDeniedError extends Error {
  code = '42501';
  constructor(message = 'permission denied') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * True when `error` looks like an RLS / authorisation denial:
 * PostgREST 42501 (insufficient_privilege), PGRST301 (JWT/authz), PGRST116 (0 rows on a write),
 * a "row-level security" message, or HTTP 401/403.
 */
export function isPermissionDenied(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof PermissionDeniedError) return true;
  const e = error as { code?: unknown; status?: unknown; statusCode?: unknown; message?: unknown; details?: unknown };
  const code = typeof e.code === 'string' ? e.code : e.code != null ? String(e.code) : '';
  if (code === '42501' || code === 'PGRST301' || code === 'PGRST116' || code === ZERO_ROWS_CODE) return true;
  const status = Number(e.status ?? e.statusCode);
  if (status === 401 || status === 403) return true;
  const text = `${typeof e.message === 'string' ? e.message : ''} ${typeof e.details === 'string' ? e.details : ''}`;
  if (/row[- ]level security/i.test(text) || /permission denied/i.test(text)) return true;
  return false;
}

/** Friendly toast text: "You don't have permission to edit this deal". */
export function permissionMessage(action: PermissionActionLabel, kind: string = 'record'): string {
  const verb = VERB[action] ?? String(action).replace(/_/g, ' ');
  const plural = action === 'manage_stages' ? 'stages'
    : action === 'manage_workflows' ? 'workflows'
    : action === 'manage_views' ? 'views' : null;
  if (plural) return `You don't have permission to ${verb} ${plural}`;
  if (action === 'bulk') return `You don't have permission to bulk update these ${kind}s`;
  return `You don't have permission to ${verb} this ${kind}`;
}

/**
 * Supabase returns no error when RLS filters an UPDATE/DELETE: 0 rows come back.
 * Call after `.select()`; throws PermissionDeniedError when no rows were affected.
 */
export function assertRowsAffected(rows: unknown[] | null | undefined): void {
  if (!rows || rows.length === 0) throw new PermissionDeniedError('No rows affected (blocked by row-level security)');
}
