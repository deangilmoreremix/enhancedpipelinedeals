/**
 * Pure trigger-matching shared by the browser (enhancedWorkflowService) and the server
 * (netlify/functions/workflow-runner). No imports: must stay runtime-agnostic.
 */

export interface MatchCondition {
  field: string;
  operator: string;
  value?: unknown;
  logicalOperator?: 'AND' | 'OR';
}

export interface MatchTrigger {
  id?: string;
  type: string;
  isActive?: boolean;
  config?: {
    recordType?: string;
    fromStage?: string;
    toStage?: string;
    fieldName?: string;
    slaType?: string;
  };
  conditions?: MatchCondition[];
}

export interface MatchWorkflow {
  id: string;
  is_active?: boolean | null;
  settings?: { isActive?: boolean } | null;
  triggers?: MatchTrigger[] | null;
}

/** Maps `workflow_events.event_type` to the TriggerType used by workflow definitions. */
export const EVENT_TO_TRIGGER: Record<string, string> = {
  'deal.created': 'record_created',
  'deal.updated': 'record_updated',
  'deal.stage_changed': 'stage_changed',
  'deal.sla_breached': 'sla_breach',
  'deal.stale': 'sla_breach'
};

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function compareValues(fieldValue: unknown, operator: string, value: unknown): boolean {
  switch (operator) {
    case 'equals': return fieldValue === value || String(fieldValue) === String(value);
    case 'not_equals': return !(fieldValue === value || String(fieldValue) === String(value));
    case 'contains': return String(fieldValue ?? '').includes(String(value));
    case 'not_contains': return !String(fieldValue ?? '').includes(String(value));
    case 'greater_than': return Number(fieldValue) > Number(value);
    case 'less_than': return Number(fieldValue) < Number(value);
    case 'is_empty': return fieldValue === null || fieldValue === undefined || fieldValue === '';
    case 'is_not_empty': return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    case 'matches_regex':
      try { return new RegExp(String(value)).test(String(fieldValue ?? '')); } catch { return false; }
    default: return false;
  }
}

/** Evaluates a condition list left to right using each condition's logicalOperator (default AND). */
export function evaluateConditions(conditions: MatchCondition[] | undefined, data: Record<string, unknown>): boolean {
  if (!conditions || conditions.length === 0) return true;
  let result = true;
  let op: 'AND' | 'OR' = 'AND';
  for (const c of conditions) {
    const r = compareValues(getPath(data, c.field), c.operator, c.value);
    result = op === 'AND' ? result && r : result || r;
    op = c.logicalOperator || 'AND';
  }
  return result;
}

export function isWorkflowActive(w: MatchWorkflow): boolean {
  return w.is_active !== false && w.settings?.isActive !== false;
}

export interface TriggerEventLike {
  triggerType: string;
  entityType: string;
  payload: Record<string, unknown>;
  /** Extra record fields (e.g. the deal row) available to conditions. */
  record?: Record<string, unknown>;
}

/** Returns the first active trigger of `workflow` that matches the event, or null. */
export function findMatchingTrigger(workflow: MatchWorkflow, event: TriggerEventLike): MatchTrigger | null {
  if (!isWorkflowActive(workflow)) return null;
  const data = { ...(event.record ?? {}), ...event.payload };
  for (const t of workflow.triggers ?? []) {
    if (t.isActive === false || t.type !== event.triggerType) continue;
    const cfg = t.config ?? {};
    if (cfg.recordType && cfg.recordType !== event.entityType) continue;
    if (cfg.fromStage && cfg.fromStage !== event.payload.from) continue;
    if (cfg.toStage && cfg.toStage !== event.payload.to) continue;
    if (cfg.slaType && cfg.slaType !== event.payload.slaType) continue;
    if (!evaluateConditions(t.conditions, data)) continue;
    return t;
  }
  return null;
}
