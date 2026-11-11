import { ViewFilter, ViewSort, Deal } from '../types';
import { Contact } from '../types/contact';
import { ownerLabel } from '../utils/ownerLabel';

/** A nested AND/OR group of conditions (conditions may themselves be groups). */
export interface FilterGroupNode {
  logic: 'AND' | 'OR';
  children: FilterNode[];
}
export type FilterNode = ViewFilter | FilterGroupNode;

export const isFilterGroup = (n: FilterNode): n is FilterGroupNode =>
  !!n && typeof n === 'object' && Array.isArray((n as FilterGroupNode).children);

/** Relative date tokens usable as the bounds of a `between` filter: value `{ relative: 'last_7_days' }`. */
export const RELATIVE_DATE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'last_30_days', label: 'Last 30 days' },
  { id: 'last_90_days', label: 'Last 90 days' },
  { id: 'next_7_days', label: 'Next 7 days' },
  { id: 'next_30_days', label: 'Next 30 days' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_quarter', label: 'This quarter' },
  { id: 'this_year', label: 'This year' },
  { id: 'overdue', label: 'Overdue (before today)' }
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Resolve a relative token to an inclusive [start, end] range (null when unknown). */
export function resolveRelativeRange(token: string, now: Date = new Date()): [Date, Date] | null {
  const today = startOfDay(now);
  switch (token) {
    case 'today': return [today, endOfDay(today)];
    case 'yesterday': return [addDays(today, -1), endOfDay(addDays(today, -1))];
    case 'tomorrow': return [addDays(today, 1), endOfDay(addDays(today, 1))];
    case 'last_7_days': return [addDays(today, -6), endOfDay(today)];
    case 'last_30_days': return [addDays(today, -29), endOfDay(today)];
    case 'last_90_days': return [addDays(today, -89), endOfDay(today)];
    case 'next_7_days': return [today, endOfDay(addDays(today, 6))];
    case 'next_30_days': return [today, endOfDay(addDays(today, 29))];
    case 'this_week': {
      const start = addDays(today, -today.getDay());
      return [start, endOfDay(addDays(start, 6))];
    }
    case 'last_week': {
      const start = addDays(today, -today.getDay() - 7);
      return [start, endOfDay(addDays(start, 6))];
    }
    case 'this_month': return [new Date(now.getFullYear(), now.getMonth(), 1), endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))];
    case 'last_month': return [new Date(now.getFullYear(), now.getMonth() - 1, 1), endOfDay(new Date(now.getFullYear(), now.getMonth(), 0))];
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return [new Date(now.getFullYear(), q, 1), endOfDay(new Date(now.getFullYear(), q + 3, 0))];
    }
    case 'this_year': return [new Date(now.getFullYear(), 0, 1), endOfDay(new Date(now.getFullYear(), 11, 31))];
    case 'overdue': return [new Date(1970, 0, 1), new Date(today.getTime() - 1)];
    default: return null;
  }
}

/** Token of a relative-date filter value (`{relative}` or `'rel:token'`), else null. */
export function getRelativeToken(value: unknown): string | null {
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof (value as any).relative === 'string') {
    return (value as any).relative;
  }
  if (typeof value === 'string' && value.startsWith('rel:')) return value.slice(4);
  return null;
}

/** Aliases so chips/saved views can use snake_case or friendly names. */
const FIELD_ALIASES: Record<string, string> = {
  owner: 'assignedTo',
  close_date: 'dueDate',
  due_date: 'dueDate',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  favorite: 'isFavorite',
  health: 'healthScore'
};

const isEmptyValue = (v: unknown) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

const PRIORITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

/**
 * Advanced Filtering Service
 * Handles complex filter operations with AND/OR logic and multiple conditions
 */
export class AdvancedFilteringService {
  /**
   * Apply advanced filters to deals
   */
  static filterDeals(deals: Deal[], filters: ViewFilter[]): Deal[] {
    if (!filters || filters.length === 0) return deals;

    return deals.filter(deal => this.evaluateFilters(deal, filters));
  }

  /**
   * Apply a nested AND/OR group tree to deals.
   */
  static filterDealsByGroup(deals: Deal[], group: FilterGroupNode | null | undefined): Deal[] {
    if (!group || group.children.length === 0) return deals;
    return deals.filter(deal => this.evaluateNode(deal, group));
  }

  /** Evaluate a filter node (condition or nested group) against a record. */
  static evaluateNode(record: any, node: FilterNode): boolean {
    if (!isFilterGroup(node)) return this.evaluateFilter(record, node);
    if (node.children.length === 0) return true;
    return node.logic === 'OR'
      ? node.children.some(c => this.evaluateNode(record, c))
      : node.children.every(c => this.evaluateNode(record, c));
  }

  /**
   * Multi-key sort (priority 0 first). Stable; nullish values go last; ties fall back to board position.
   */
  static sortDeals(deals: Deal[], sorting: ViewSort[]): Deal[] {
    const keys = [...sorting].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    const manual = (a: Deal, b: Deal) =>
      (a.position ?? 0) - (b.position ?? 0) || a.createdAt.getTime() - b.createdAt.getTime();
    const out = [...deals];
    if (keys.length === 0) return out.sort(manual);
    return out.sort((a, b) => {
      for (const k of keys) {
        const av = this.getNestedValue(a, k.field);
        const bv = this.getNestedValue(b, k.field);
        const aEmpty = isEmptyValue(av);
        const bEmpty = isEmptyValue(bv);
        if (aEmpty && bEmpty) continue;
        if (aEmpty) return 1;
        if (bEmpty) return -1;
        const c = this.compareForSort(k.field, av, bv);
        if (c !== 0) return k.direction === 'desc' ? -c : c;
      }
      return manual(a, b);
    });
  }

  private static compareForSort(field: string, a: any, b: any): number {
    if (field === 'priority') return (PRIORITY_RANK[String(a)] ?? 0) - (PRIORITY_RANK[String(b)] ?? 0);
    if (a instanceof Date || b instanceof Date) return new Date(a).getTime() - new Date(b).getTime();
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
    if (Array.isArray(a) || Array.isArray(b)) return String(a).localeCompare(String(b));
    return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
  }

  /**
   * Apply advanced filters to contacts
   */
  static filterContacts(contacts: Contact[], filters: ViewFilter[]): Contact[] {
    if (!filters || filters.length === 0) return contacts;

    return contacts.filter(contact => this.evaluateFilters(contact, filters));
  }

  /**
   * Evaluate filters against a record with support for AND/OR logic
   */
  private static evaluateFilters(record: any, filters: ViewFilter[]): boolean {
    if (filters.length === 0) return true;

    // Group filters by logical operator
    const andFilters = filters.filter(f => f.logicalOperator !== 'OR');
    const orFilters = filters.filter(f => f.logicalOperator === 'OR');

    // Evaluate AND filters first
    const andResult = andFilters.length === 0 || andFilters.every(filter =>
      this.evaluateFilter(record, filter)
    );

    // Evaluate OR filters
    const orResult = orFilters.length === 0 || orFilters.some(filter =>
      this.evaluateFilter(record, filter)
    );

    // If we have both AND and OR filters, AND takes precedence
    if (andFilters.length > 0 && orFilters.length > 0) {
      return andResult && orResult;
    } else if (andFilters.length > 0) {
      return andResult;
    } else if (orFilters.length > 0) {
      return orResult;
    }

    return true;
  }

  /**
   * Evaluate a single filter condition
   */
  static evaluateFilter(record: any, filter: ViewFilter): boolean {
    const value = this.getNestedValue(record, filter.field);
    const filterValue = filter.value;

    switch (filter.operator) {
      case 'equals':
        return this.equals(value, filterValue);

      case 'not_equals':
        return !this.equals(value, filterValue);

      case 'contains':
        return this.contains(value, filterValue);

      case 'not_contains':
        return !this.contains(value, filterValue);

      case 'greater_than':
        return !isEmptyValue(value) && this.compare(value, filterValue) > 0;

      case 'less_than':
        return !isEmptyValue(value) && this.compare(value, filterValue) < 0;

      case 'between':
        return this.between(value, filterValue);

      case 'in':
        return this.in(value, filterValue);

      case 'not_in':
        return !this.in(value, filterValue);

      case 'is_null':
        return isEmptyValue(value);

      case 'is_not_null':
        return !isEmptyValue(value);

      default:
        return true;
    }
  }

  /**
   * Get nested object value by dot notation path
   */
  static getNestedValue(obj: any, path: string): any {
    const resolved = FIELD_ALIASES[path] ?? path;
    const value = resolved.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
    // Owner: assignedTo text is the display fallback; ownerId (via the user directory) is canonical
    if (resolved === 'assignedTo' && (value === undefined || value === null || value === '') && obj && typeof obj === 'object') {
      return ownerLabel(obj) || value;
    }
    return value;
  }

  /**
   * Equality comparison with type coercion
   */
  private static equals(value: any, filterValue: any): boolean {
    if (value === filterValue) return true;
    if (typeof value === 'boolean') return String(value) === String(filterValue);
    if (Array.isArray(value) && !Array.isArray(filterValue)) {
      return value.some(v => String(v).toLowerCase() === String(filterValue).toLowerCase());
    }
    if (typeof value === 'string' && typeof filterValue === 'string') {
      if (value.trim().toLowerCase() === filterValue.trim().toLowerCase()) return true;
    }

    // Handle type coercion for common cases
    if (typeof value === 'string' && typeof filterValue === 'number') {
      return !isNaN(Number(value)) && Number(value) === filterValue;
    }
    if (typeof value === 'number' && typeof filterValue === 'string') {
      return !isNaN(Number(filterValue)) && value === Number(filterValue);
    }

    // Handle date comparisons
    if (value instanceof Date && typeof filterValue === 'string') {
      return !isNaN(value.getTime()) && value.toISOString().split('T')[0] === filterValue;
    }
    if (value instanceof Date && filterValue instanceof Date) {
      return value.getTime() === filterValue.getTime();
    }
    if (typeof value === 'string' && filterValue instanceof Date) {
      return value === filterValue.toISOString().split('T')[0];
    }

    // Handle array comparisons
    if (Array.isArray(value) && Array.isArray(filterValue)) {
      return JSON.stringify([...value].sort()) === JSON.stringify([...filterValue].sort());
    }

    return false;
  }

  /**
   * String contains check (case insensitive)
   */
  private static contains(value: any, filterValue: any): boolean {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) {
      const needle = String(filterValue).toLowerCase();
      return value.some(v => String(v).toLowerCase().includes(needle));
    }

    const strValue = String(value).toLowerCase();
    const strFilter = String(filterValue).toLowerCase();

    return strValue.includes(strFilter);
  }

  /**
   * Numeric/date comparison
   */
  private static compare(value: any, filterValue: any): number {
    // Handle numeric comparison
    const numValue = Number(value);
    const numFilter = Number(filterValue);

    if (!isNaN(numValue) && !isNaN(numFilter)) {
      return numValue - numFilter;
    }

    // Handle date comparison
    const dateValue = value instanceof Date ? value : new Date(value);
    const dateFilter = filterValue instanceof Date ? filterValue : new Date(filterValue);

    if (!isNaN(dateValue.getTime()) && !isNaN(dateFilter.getTime())) {
      return dateValue.getTime() - dateFilter.getTime();
    }

    // Handle string comparison
    const strValue = String(value);
    const strFilter = String(filterValue);

    return strValue.localeCompare(strFilter);
  }

  /**
   * Between comparison for ranges
   */
  private static between(value: any, filterValue: any): boolean {
    if (isEmptyValue(value)) return false;
    const token = getRelativeToken(filterValue);
    if (token) {
      const range = resolveRelativeRange(token);
      if (!range) return false;
      const t = (value instanceof Date ? value : new Date(value)).getTime();
      return !isNaN(t) && t >= range[0].getTime() && t <= range[1].getTime();
    }
    if (!Array.isArray(filterValue) || filterValue.length !== 2) return false;

    const [min, max] = filterValue;
    const comparison = this.compare(value, min);

    return comparison >= 0 && this.compare(value, max) <= 0;
  }

  /**
   * In array check
   */
  private static in(value: any, filterValue: any): boolean {
    if (!Array.isArray(filterValue)) return false;
    if (Array.isArray(value)) {
      return value.some(v => filterValue.some(item => this.equals(v, item)));
    }
    return filterValue.some(item => this.equals(value, item));
  }

  /**
   * Build filter query for database operations
   */
  static buildFilterQuery(filters: ViewFilter[]): any {
    const query: any = {};

    filters.forEach(filter => {
      const field = filter.field;
      const operator = filter.operator;
      const value = filter.value;

      switch (operator) {
        case 'equals':
          query[field] = value;
          break;
        case 'not_equals':
          query[field] = { $ne: value };
          break;
        case 'contains':
          query[field] = { $regex: value, $options: 'i' };
          break;
        case 'greater_than':
          query[field] = { $gt: value };
          break;
        case 'less_than':
          query[field] = { $lt: value };
          break;
        case 'between':
          if (Array.isArray(value) && value.length === 2) {
            query[field] = { $gte: value[0], $lte: value[1] };
          }
          break;
        case 'in':
          query[field] = { $in: value };
          break;
        case 'is_null':
          query[field] = { $in: [null, undefined, ''] };
          break;
        // Add more operators as needed
      }
    });

    return query;
  }

  /**
   * Validate filter configuration
   */
  static validateFilters(filters: ViewFilter[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    filters.forEach((filter, index) => {
      if (!filter.field) {
        errors.push(`Filter ${index + 1}: Field is required`);
      }

      if (!filter.operator) {
        errors.push(`Filter ${index + 1}: Operator is required`);
      }

      // Validate operator-specific requirements
      switch (filter.operator) {
        case 'between':
          if (!getRelativeToken(filter.value) && (!Array.isArray(filter.value) || filter.value.length !== 2)) {
            errors.push(`Filter ${index + 1}: Between operator requires an array with 2 values`);
          }
          break;
        case 'in':
        case 'not_in':
          if (!Array.isArray(filter.value)) {
            errors.push(`Filter ${index + 1}: ${filter.operator} operator requires an array value`);
          }
          break;
        case 'is_null':
        case 'is_not_null':
          // These operators don't need a value
          break;
        default:
          if (filter.value === undefined || filter.value === null) {
            errors.push(`Filter ${index + 1}: Value is required for ${filter.operator} operator`);
          }
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get available filter fields for a given entity type
   */
  static getAvailableFields(entityType: 'deals' | 'contacts'): Array<{ field: string; label: string; type: string }> {
    const dealFields = [
      { field: 'id', label: 'ID', type: 'string' },
      { field: 'title', label: 'Title', type: 'string' },
      { field: 'company', label: 'Company', type: 'string' },
      { field: 'contact', label: 'Contact', type: 'string' },
      { field: 'value', label: 'Value', type: 'number' },
      { field: 'stage', label: 'Stage', type: 'select' },
      { field: 'assignedTo', label: 'Owner', type: 'string' },
      { field: 'probability', label: 'Probability', type: 'number' },
      { field: 'priority', label: 'Priority', type: 'select' },
      { field: 'dueDate', label: 'Due Date', type: 'date' },
      { field: 'createdAt', label: 'Created Date', type: 'date' },
      { field: 'updatedAt', label: 'Updated Date', type: 'date' },
      { field: 'tags', label: 'Tags', type: 'array' },
      { field: 'isFavorite', label: 'Favorite', type: 'boolean' },
      { field: 'healthScore', label: 'Health Score', type: 'number' },
      { field: 'aiScore', label: 'AI Score', type: 'number' }
    ];

    const contactFields = [
      { field: 'id', label: 'ID', type: 'string' },
      { field: 'name', label: 'Name', type: 'string' },
      { field: 'firstName', label: 'First Name', type: 'string' },
      { field: 'lastName', label: 'Last Name', type: 'string' },
      { field: 'email', label: 'Email', type: 'string' },
      { field: 'phone', label: 'Phone', type: 'string' },
      { field: 'company', label: 'Company', type: 'string' },
      { field: 'title', label: 'Title', type: 'string' },
      { field: 'industry', label: 'Industry', type: 'string' },
      { field: 'status', label: 'Status', type: 'select' },
      { field: 'interestLevel', label: 'Interest Level', type: 'select' },
      { field: 'createdAt', label: 'Created Date', type: 'date' },
      { field: 'updatedAt', label: 'Updated Date', type: 'date' },
      { field: 'isFavorite', label: 'Favorite', type: 'boolean' },
      { field: 'aiScore', label: 'AI Score', type: 'number' }
    ];

    return entityType === 'deals' ? dealFields : contactFields;
  }

  /**
   * Get available operators for a field type
   */
  static getAvailableOperators(fieldType: string): Array<{ value: ViewFilter['operator']; label: string }> {
    const baseOperators = [
      { value: 'equals' as const, label: 'Equals' },
      { value: 'not_equals' as const, label: 'Not Equals' }
    ];

    const stringOperators = [
      { value: 'contains' as const, label: 'Contains' },
      { value: 'not_contains' as const, label: 'Does Not Contain' }
    ];

    const numberOperators = [
      { value: 'greater_than' as const, label: 'Greater Than' },
      { value: 'less_than' as const, label: 'Less Than' },
      { value: 'between' as const, label: 'Between' }
    ];

    const arrayOperators = [
      { value: 'in' as const, label: 'In' },
      { value: 'not_in' as const, label: 'Not In' }
    ];

    const nullOperators = [
      { value: 'is_null' as const, label: 'Is Empty' },
      { value: 'is_not_null' as const, label: 'Is Not Empty' }
    ];

    switch (fieldType) {
      case 'string':
        return [...baseOperators, ...stringOperators, ...nullOperators];
      case 'number':
      case 'date':
        return [...baseOperators, ...numberOperators, ...nullOperators];
      case 'boolean':
        return baseOperators;
      case 'select':
      case 'array':
        return [...baseOperators, ...arrayOperators, ...nullOperators];
      default:
        return [...baseOperators, ...stringOperators, ...nullOperators];
    }
  }
}

// Export convenience functions
export const filterDeals = AdvancedFilteringService.filterDeals;
export const filterDealsByGroup = AdvancedFilteringService.filterDealsByGroup;
export const sortDealsBy = AdvancedFilteringService.sortDeals;
export const filterContacts = AdvancedFilteringService.filterContacts;
export const buildFilterQuery = AdvancedFilteringService.buildFilterQuery;
export const validateFilters = AdvancedFilteringService.validateFilters;
export const getAvailableFields = AdvancedFilteringService.getAvailableFields;
export const getAvailableOperators = AdvancedFilteringService.getAvailableOperators;