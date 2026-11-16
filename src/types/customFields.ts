/** Per-deal custom fields (definitions live in deal_field_definitions, values in deals.custom_fields). */
export const CUSTOM_FIELD_TYPES = ['text', 'number', 'select', 'multi_select', 'rating', 'link', 'email', 'phone', 'date'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export type CustomFieldValue = string | number | boolean | string[] | null;

export interface DealFieldDefinition {
  id: string;
  /** Stable key used inside deals.custom_fields. Immutable after creation. */
  key: string;
  label: string;
  type: CustomFieldType;
  /** Choices for select / multi_select (empty otherwise). */
  options: string[];
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
