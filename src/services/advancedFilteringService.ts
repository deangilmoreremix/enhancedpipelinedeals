import { ViewFilter, Deal, Contact } from '../types';

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
  private static evaluateFilter(record: any, filter: ViewFilter): boolean {
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
        return this.compare(value, filterValue) > 0;

      case 'less_than':
        return this.compare(value, filterValue) < 0;

      case 'between':
        return this.between(value, filterValue);

      case 'in':
        return this.in(value, filterValue);

      case 'not_in':
        return !this.in(value, filterValue);

      case 'is_null':
        return value === null || value === undefined || value === '';

      case 'is_not_null':
        return value !== null && value !== undefined && value !== '';

      default:
        return true;
    }
  }

  /**
   * Get nested object value by dot notation path
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Equality comparison with type coercion
   */
  private static equals(value: any, filterValue: any): boolean {
    if (value === filterValue) return true;

    // Handle type coercion for common cases
    if (typeof value === 'string' && typeof filterValue === 'number') {
      return !isNaN(Number(value)) && Number(value) === filterValue;
    }
    if (typeof value === 'number' && typeof filterValue === 'string') {
      return !isNaN(Number(filterValue)) && value === Number(filterValue);
    }

    // Handle date comparisons
    if (value instanceof Date && typeof filterValue === 'string') {
      return value.toISOString().split('T')[0] === filterValue;
    }
    if (typeof value === 'string' && filterValue instanceof Date) {
      return value === filterValue.toISOString().split('T')[0];
    }

    // Handle array comparisons
    if (Array.isArray(value) && Array.isArray(filterValue)) {
      return JSON.stringify(value.sort()) === JSON.stringify(filterValue.sort());
    }

    return false;
  }

  /**
   * String contains check (case insensitive)
   */
  private static contains(value: any, filterValue: any): boolean {
    if (value === null || value === undefined) return false;

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
          if (!Array.isArray(filter.value) || filter.value.length !== 2) {
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
export const filterContacts = AdvancedFilteringService.filterContacts;
export const buildFilterQuery = AdvancedFilteringService.buildFilterQuery;
export const validateFilters = AdvancedFilteringService.validateFilters;
export const getAvailableFields = AdvancedFilteringService.getAvailableFields;
export const getAvailableOperators = AdvancedFilteringService.getAvailableOperators;