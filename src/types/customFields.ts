/**
 * Custom fields for deals, contacts and companies (definitions live in deal_field_definitions with an
 * entity_type; values in deals / contacts / companies .custom_fields).
 */
export const STORED_FIELD_TYPES = ['text', 'number', 'select', 'multi_select', 'rating', 'link', 'email', 'phone', 'date'] as const;
/** Computed (never stored) types: `formula` over the record's other fields, `rollup` of a company's deals/contacts. */
export const COMPUTED_FIELD_TYPES = ['formula', 'rollup'] as const;
export const CUSTOM_FIELD_TYPES = [...STORED_FIELD_TYPES, ...COMPUTED_FIELD_TYPES] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];
export const isComputedType = (t: CustomFieldType | string | undefined): boolean => t === 'formula' || t === 'rollup';

export const CUSTOM_FIELD_ENTITY_TYPES = ['deal', 'contact', 'company'] as const;
export type CustomFieldEntityType = (typeof CUSTOM_FIELD_ENTITY_TYPES)[number];

export const ROLLUP_METRICS = ['open_deal_count', 'open_deal_value', 'won_deal_value', 'contact_count', 'last_activity'] as const;
export type RollupMetric = (typeof ROLLUP_METRICS)[number];

/** Type-specific configuration persisted in the definition's `options` jsonb (object form). */
export interface FieldConfig {
  /** formula: the expression, e.g. `{value} * {probability} / 100`. */
  formula?: string;
  /** rollup: which company_rollups metric to show. */
  metric?: RollupMetric;
}

export type CustomFieldValue = string | number | boolean | string[] | null;

export interface DealFieldDefinition {
  id: string;
  /** Stable key used inside deals.custom_fields. Immutable after creation. */
  key: string;
  label: string;
  type: CustomFieldType;
  /** Choices for select / multi_select (empty otherwise). */
  options: string[];
  /** formula expression / rollup metric (computed types only). */
  config?: FieldConfig;
  /** Which record kind the field belongs to (default 'deal'). */
  entityType?: CustomFieldEntityType;
  position: number;
  groupName: string | null;
  isActive: boolean;
  createdBy?: string | null;
}

/** One logged field edit (deal_activities.type = 'field_changed', metadata {field,from,to}). */
export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}
