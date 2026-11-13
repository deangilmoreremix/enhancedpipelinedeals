/**
 * Single source of truth for workflow triggers and actions.
 *
 * Pure TypeScript (no imports): safe to import from the browser (StepPicker / StepConfigForm /
 * validation) and from Netlify functions (relative import). The parity test in
 * src/tests/workflowRegistry.test.ts asserts every `engines.server` action is handled by
 * `executeAction` in netlify/functions/_workflowSteps.ts and vice versa.
 *
 * Config keys may be dotted (`fields.title`) and are written into the nested config object.
 */

export type ConfigFieldType =
  | 'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'json' | 'record-field' | 'stage' | 'user' | 'template';

export interface ConfigFieldOption { value: string; label: string }

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  options?: ConfigFieldOption[];
  required?: boolean;
  placeholder?: string;
  help?: string;
  defaultValue?: unknown;
  /** Show a `{{variable}}` picker next to the input. */
  supportsVariables?: boolean;
  /** Only render when another config key has one of these values. */
  showWhen?: { key: string; in: string[] };
}

export type RegistryCategory =
  | 'Triggers' | 'Records' | 'Communication' | 'Integrations' | 'AI' | 'Flow control' | 'Advanced';

export interface EngineSupport { server: boolean; client: boolean }

export interface RegistryEntry {
  key: string;
  label: string;
  /** lucide-react icon name */
  icon: string;
  category: RegistryCategory;
  description: string;
  fields: ConfigField[];
  engines: EngineSupport;
}

export type TriggerKey =
  | 'record_created' | 'record_updated' | 'record_deleted' | 'stage_changed' | 'field_changed'
  | 'scheduled' | 'manual' | 'webhook' | 'sla_breach' | 'milestone_reached';

const RECORD_TYPES: ConfigFieldOption[] = [
  { value: 'deal', label: 'Deal' },
  { value: 'contact', label: 'Contact' },
  { value: 'company', label: 'Company' },
  { value: 'task', label: 'Task' }
];

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => ({ value: m, label: m }));

const recordTypeField = (required = false): ConfigField => ({
  key: 'recordType', label: 'Record type', type: 'select', options: RECORD_TYPES, required, defaultValue: 'deal'
});

export const TRIGGER_ENTRIES: RegistryEntry[] = [
  {
    key: 'record_created', label: 'Record created', icon: 'PlusCircle', category: 'Triggers',
    description: 'Runs when a new record is created.', fields: [recordTypeField()],
    engines: { server: true, client: true }
  },
  {
    key: 'record_updated', label: 'Record updated', icon: 'Pencil', category: 'Triggers',
    description: 'Runs when a record is updated.', fields: [recordTypeField()],
    engines: { server: true, client: true }
  },
  {
    key: 'record_deleted', label: 'Record deleted', icon: 'Trash2', category: 'Triggers',
    description: 'Runs when a record is deleted.', fields: [recordTypeField()],
    engines: { server: false, client: true }
  },
  {
    key: 'stage_changed', label: 'Stage changed', icon: 'ArrowRightLeft', category: 'Triggers',
    description: 'Runs when a deal moves between stages. Leave a stage empty to match any.',
    fields: [
      { key: 'fromStage', label: 'From stage', type: 'stage', placeholder: 'Any stage' },
      { key: 'toStage', label: 'To stage', type: 'stage', placeholder: 'Any stage' }
    ],
    engines: { server: true, client: true }
  },
  {
    key: 'field_changed', label: 'Field changed', icon: 'TextCursorInput', category: 'Triggers',
    description: 'Runs when a specific field changes (optionally to a value).',
    fields: [
      recordTypeField(),
      { key: 'fieldName', label: 'Field', type: 'record-field', required: true },
      { key: 'fieldValue', label: 'New value', type: 'text', placeholder: 'Any value' }
    ],
    engines: { server: false, client: true }
  },
  {
    key: 'scheduled', label: 'Scheduled', icon: 'CalendarClock', category: 'Triggers',
    description: 'Runs on a schedule.',
    fields: [
      {
        key: 'schedule.frequency', label: 'Frequency', type: 'select', required: true, defaultValue: 'daily',
        options: [
          { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' }, { value: 'custom', label: 'Custom (cron)' }
        ]
      },
      { key: 'schedule.time', label: 'Time (HH:MM)', type: 'text', placeholder: '09:00', showWhen: { key: 'schedule.frequency', in: ['daily', 'weekly', 'monthly'] } },
      { key: 'schedule.cronExpression', label: 'Cron expression', type: 'text', placeholder: '0 9 * * 1-5', showWhen: { key: 'schedule.frequency', in: ['custom'] } }
    ],
    engines: { server: false, client: true }
  },
  {
    key: 'manual', label: 'Manual', icon: 'MousePointerClick', category: 'Triggers',
    description: 'Runs when you press Execute.', fields: [],
    engines: { server: false, client: true }
  },
  {
    key: 'webhook', label: 'Incoming webhook', icon: 'Webhook', category: 'Triggers',
    description: 'Runs when an external system calls the webhook.',
    fields: [{ key: 'webhookSecret', label: 'Shared secret', type: 'text', placeholder: 'Optional' }],
    engines: { server: false, client: true }
  },
  {
    key: 'sla_breach', label: 'SLA breach', icon: 'AlarmClock', category: 'Triggers',
    description: 'Runs when an SLA is breached or a deal goes stale.',
    fields: [
      {
        key: 'slaType', label: 'SLA type', type: 'select', placeholder: 'Any',
        options: [
          { value: 'response_time', label: 'Response time' },
          { value: 'stage_duration', label: 'Stage duration' },
          { value: 'milestone_deadline', label: 'Milestone deadline' }
        ]
      },
      { key: 'threshold', label: 'Threshold (minutes)', type: 'number' }
    ],
    engines: { server: true, client: true }
  },
  {
    key: 'milestone_reached', label: 'Milestone reached', icon: 'Flag', category: 'Triggers',
    description: 'Runs when a record reaches a milestone.',
    fields: [{ key: 'fieldName', label: 'Milestone field', type: 'record-field' }, { key: 'fieldValue', label: 'Value', type: 'text' }],
    engines: { server: false, client: true }
  }
];

const stdAction = (e: Omit<RegistryEntry, 'engines'> & { engines?: EngineSupport }): RegistryEntry => ({
  engines: { server: true, client: true }, ...e
});

export const ACTION_ENTRIES: RegistryEntry[] = [
  stdAction({
    key: 'create_task', label: 'Create task', icon: 'CheckSquare', category: 'Records',
    description: 'Create a follow-up task for the record.',
    fields: [
      { key: 'fields.title', label: 'Title', type: 'text', required: true, supportsVariables: true, placeholder: 'Follow up with {{record.company}}' },
      { key: 'fields.notes', label: 'Notes', type: 'textarea', supportsVariables: true },
      { key: 'fields.dueInDays', label: 'Due in (days)', type: 'number' }
    ]
  }),
  stdAction({
    key: 'create_note', label: 'Create note', icon: 'StickyNote', category: 'Records',
    description: 'Add a note to the deal.',
    fields: [
      { key: 'subject', label: 'Title', type: 'text', supportsVariables: true },
      { key: 'body', label: 'Note', type: 'textarea', required: true, supportsVariables: true }
    ]
  }),
  stdAction({
    key: 'add_comment', label: 'Add comment', icon: 'MessageSquare', category: 'Records',
    description: 'Add a comment (stored as a note) on the deal.',
    fields: [{ key: 'body', label: 'Comment', type: 'textarea', required: true, supportsVariables: true }]
  }),
  stdAction({
    key: 'update_record', label: 'Update record', icon: 'Pencil', category: 'Records',
    description: 'Update fields on the triggering record.',
    fields: [
      recordTypeField(),
      { key: 'fields', label: 'Fields (JSON)', type: 'json', required: true, supportsVariables: true, placeholder: '{"priority": "high"}' }
    ]
  }),
  stdAction({
    key: 'update_stage', label: 'Move to stage', icon: 'ArrowRightLeft', category: 'Records',
    description: 'Move the deal to another stage.',
    fields: [{ key: 'newStage', label: 'New stage', type: 'stage', required: true }]
  }),
  stdAction({
    key: 'assign_owner', label: 'Assign owner', icon: 'UserCheck', category: 'Records',
    description: 'Assign the record to a user.',
    fields: [{ key: 'newOwner', label: 'New owner', type: 'user', required: true, supportsVariables: true }]
  }),
  stdAction({
    key: 'create_record', label: 'Create record', icon: 'FilePlus', category: 'Records',
    description: 'Create a new record.',
    fields: [recordTypeField(true), { key: 'fields', label: 'Fields (JSON)', type: 'json', required: true, supportsVariables: true }]
  }),
  stdAction({
    key: 'search_records', label: 'Search records', icon: 'Search', category: 'Records',
    description: 'Find records matching criteria; output feeds filter/iterator.',
    fields: [recordTypeField(true), { key: 'searchCriteria', label: 'Criteria (JSON)', type: 'json', supportsVariables: true, placeholder: '{"stage": "proposal"}' }]
  }),
  stdAction({
    key: 'delete_record', label: 'Delete record', icon: 'Trash2', category: 'Records',
    description: 'Delete the triggering record.',
    fields: [recordTypeField()]
  }),
  stdAction({
    key: 'upsert_record', label: 'Upsert record', icon: 'DatabaseZap', category: 'Records',
    description: 'Update the record matching a key, or create it.',
    fields: [
      recordTypeField(true),
      { key: 'upsertKey', label: 'Match on field', type: 'record-field', required: true },
      { key: 'fields', label: 'Fields (JSON)', type: 'json', required: true, supportsVariables: true }
    ]
  }),
  stdAction({
    key: 'send_email', label: 'Send email', icon: 'Mail', category: 'Communication',
    description: 'Queue an email in outbound messages (defaults to the deal contact).',
    fields: [
      { key: 'recipients', label: 'To', type: 'text', supportsVariables: true, placeholder: 'Defaults to the deal contact', help: 'Comma-separated addresses.' },
      { key: 'subject', label: 'Subject', type: 'text', required: true, supportsVariables: true },
      { key: 'body', label: 'Body', type: 'textarea', required: true, supportsVariables: true }
    ]
  }),
  stdAction({
    key: 'notification', label: 'Notification', icon: 'Bell', category: 'Communication',
    description: 'Create an in-app notification.',
    fields: [{ key: 'notificationMessage', label: 'Message', type: 'textarea', required: true, supportsVariables: true }]
  }),
  stdAction({
    key: 'http_request', label: 'HTTP request', icon: 'Globe', category: 'Integrations',
    description: 'Call an external HTTPS API.',
    fields: [
      { key: 'httpMethod', label: 'Method', type: 'select', options: HTTP_METHODS, defaultValue: 'GET' },
      { key: 'httpUrl', label: 'URL', type: 'text', required: true, supportsVariables: true, placeholder: 'https://api.example.com/hook' },
      { key: 'httpHeaders', label: 'Headers (JSON)', type: 'json', supportsVariables: true, placeholder: '{"Authorization": "Bearer ..."}' },
      { key: 'httpBody', label: 'Body (JSON)', type: 'json', supportsVariables: true, showWhen: { key: 'httpMethod', in: ['POST', 'PUT', 'PATCH', 'DELETE'] } }
    ]
  }),
  stdAction({
    key: 'webhook', label: 'Send webhook', icon: 'Webhook', category: 'Integrations',
    description: 'POST a payload to a webhook URL.',
    fields: [
      { key: 'webhookUrl', label: 'URL', type: 'text', required: true, supportsVariables: true },
      { key: 'webhookMethod', label: 'Method', type: 'select', options: ['POST', 'PUT', 'GET'].map(m => ({ value: m, label: m })), defaultValue: 'POST' },
      { key: 'webhookHeaders', label: 'Headers (JSON)', type: 'json', supportsVariables: true },
      { key: 'webhookPayload', label: 'Payload (JSON)', type: 'json', supportsVariables: true }
    ]
  }),
  stdAction({
    key: 'ai_agent', label: 'AI agent', icon: 'Bot', category: 'AI',
    description: 'Run an AI prompt with the record as context; output is available as {{aiResult}}.',
    fields: [
      { key: 'aiAgentPrompt', label: 'Prompt', type: 'textarea', required: true, supportsVariables: true },
      {
        key: 'aiAgentModel', label: 'Model tier', type: 'select', defaultValue: 'fast',
        options: [{ value: 'fast', label: 'Fast' }, { value: 'default', label: 'Balanced' }, { value: 'deep', label: 'Deep reasoning' }]
      }
    ]
  }),
  stdAction({
    key: 'filter', label: 'Filter', icon: 'Filter', category: 'Flow control',
    description: 'Continue only when criteria match (filters search results or gates the record).',
    fields: [{ key: 'filterCriteria', label: 'Criteria (JSON)', type: 'json', required: true, supportsVariables: true, placeholder: '{"value": {"operator": "greater_than", "value": 1000}}' }]
  }),
  stdAction({
    key: 'delay', label: 'Delay', icon: 'Timer', category: 'Flow control',
    description: 'Wait before running the next steps.',
    fields: [{ key: 'delayMinutes', label: 'Minutes', type: 'number', required: true, defaultValue: 60 }]
  }),
  stdAction({
    key: 'iterator', label: 'Iterator', icon: 'Repeat', category: 'Flow control',
    description: 'Run the Item branch for every item, then the Done branch once.',
    fields: [
      {
        key: 'iteratorSource', label: 'Items from', type: 'select', defaultValue: 'query_result', required: true,
        options: [
          { value: 'query_result', label: 'Previous step records' },
          { value: 'records', label: 'Trigger records' },
          { value: 'array', label: 'Variable (array)' }
        ]
      },
      { key: 'iteratorVariable', label: 'Item variable / array path', type: 'text', placeholder: 'currentItem' }
    ]
  }),
  stdAction({
    key: 'code', label: 'Run code', icon: 'Code', category: 'Advanced',
    description: 'Run a JavaScript snippet in the browser (not available to the server runner).',
    fields: [{ key: 'codeSnippet', label: 'JavaScript', type: 'textarea', required: true }],
    engines: { server: false, client: true }
  })
];

/** The condition node (a step type, not an action). */
export const CONDITION_ENTRY: RegistryEntry = {
  key: 'condition', label: 'Condition', icon: 'GitBranch', category: 'Flow control',
  description: 'Branch on a field value: True / False outputs.', fields: [],
  engines: { server: true, client: true }
};

export const ALL_ENTRIES: RegistryEntry[] = [...TRIGGER_ENTRIES, CONDITION_ENTRY, ...ACTION_ENTRIES];

export const CATEGORY_ORDER: RegistryCategory[] = ['Triggers', 'Flow control', 'Records', 'Communication', 'Integrations', 'AI', 'Advanced'];

export const CONDITION_OPERATORS: ConfigFieldOption[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'less_than', label: 'is less than' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'matches_regex', label: 'matches regex' }
];

/** Trigger and action keys can collide (`webhook`), so catalog entries are addressed by `kind:key`. */
export const entryRef = (e: RegistryEntry): string => `${e.category === 'Triggers' ? 'trigger' : 'action'}:${e.key}`;
export const findEntryByRef = (ref: string): RegistryEntry | undefined => ALL_ENTRIES.find(e => entryRef(e) === ref);

export const getTriggerEntry = (key: string | undefined): RegistryEntry | undefined =>
  TRIGGER_ENTRIES.find(e => e.key === key);
export const getActionEntry = (key: string | undefined): RegistryEntry | undefined =>
  ACTION_ENTRIES.find(e => e.key === key);

/** Action keys the server executor implements, per the registry. */
export const serverActionKeys = (): string[] => ACTION_ENTRIES.filter(e => e.engines.server).map(e => e.key);

// ---- config helpers (dotted keys) -----------------------------------------------------------

export function getConfigValue(config: Record<string, any> | undefined, key: string): unknown {
  let cur: any = config;
  for (const part of key.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

/** Returns a new config object with `key` set (empty string/undefined removes it). */
export function setConfigValue(config: Record<string, any> | undefined, key: string, value: unknown): Record<string, any> {
  const parts = key.split('.');
  const root: Record<string, any> = { ...(config ?? {}) };
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = { ...(cur[parts[i]] ?? {}) };
    cur = cur[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (value === undefined || value === '') delete cur[last];
  else cur[last] = value;
  return root;
}

export const isEmptyConfigValue = (v: unknown): boolean =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v as object).length === 0);

/** Config fields currently visible given the config (honours `showWhen`). */
export function visibleFields(entry: RegistryEntry | undefined, config: Record<string, any> | undefined): ConfigField[] {
  if (!entry) return [];
  return entry.fields.filter(f => {
    if (!f.showWhen) return true;
    const cur = getConfigValue(config, f.showWhen.key) ?? entry.fields.find(x => x.key === f.showWhen!.key)?.defaultValue;
    return f.showWhen.in.includes(String(cur));
  });
}

/** Required fields missing from the config. */
export function missingRequired(entry: RegistryEntry | undefined, config: Record<string, any> | undefined): ConfigField[] {
  return visibleFields(entry, config).filter(f => f.required && isEmptyConfigValue(getConfigValue(config, f.key) ?? undefined) && isEmptyConfigValue(f.defaultValue));
}

// ---- variable tokens (must match interpolate() in netlify/functions/_workflowSteps.ts) --------

/** Common deal columns offered by the variable picker (resolved as `{{record.<field>}}`). */
export const DEAL_VARIABLE_FIELDS: ConfigFieldOption[] = [
  { value: 'id', label: 'ID' },
  { value: 'title', label: 'Title' },
  { value: 'company', label: 'Company' },
  { value: 'contact', label: 'Contact' },
  { value: 'value', label: 'Value' },
  { value: 'stage', label: 'Stage' },
  { value: 'probability', label: 'Probability' },
  { value: 'priority', label: 'Priority' },
  { value: 'owner_id', label: 'Owner ID' },
  { value: 'expected_close_date', label: 'Expected close date' },
  { value: 'notes', label: 'Notes' }
];

export const TRIGGER_PAYLOAD_VARIABLES: ConfigFieldOption[] = [
  { value: 'from', label: 'Previous stage (stage change)' },
  { value: 'to', label: 'New stage (stage change)' },
  { value: 'eventType', label: 'Event type' },
  { value: 'recordId', label: 'Record ID' }
];

export const variableToken = (path: string): string => `{{${path}}}`;
