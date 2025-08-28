/**
 * Comprehensive validation utilities for forms and data integrity
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
  message?: string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule | ValidationRule[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  firstError?: string;
}

/**
 * Contact validation schema
 */
export const contactValidationSchema: ValidationSchema = {
  firstName: {
    required: true,
    minLength: 1,
    maxLength: 50,
    pattern: /^[a-zA-Z\s'-]+$/,
    message: 'First name must contain only letters, spaces, hyphens, and apostrophes'
  },
  lastName: {
    required: true,
    minLength: 1,
    maxLength: 50,
    pattern: /^[a-zA-Z\s'-]+$/,
    message: 'Last name must contain only letters, spaces, hyphens, and apostrophes'
  },
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address'
  },
  phone: {
    pattern: /^[\+]?[1-9][\d]{0,15}$/,
    message: 'Please enter a valid phone number'
  },
  company: {
    required: true,
    minLength: 1,
    maxLength: 100,
    message: 'Company name is required'
  },
  title: {
    required: true,
    minLength: 1,
    maxLength: 100,
    message: 'Job title is required'
  },
  industry: {
    maxLength: 50,
    message: 'Industry must be less than 50 characters'
  },
  status: {
    custom: (value) => ['lead', 'prospect', 'customer', 'churned'].includes(value),
    message: 'Status must be one of: lead, prospect, customer, churned'
  },
  interestLevel: {
    custom: (value) => ['hot', 'medium', 'low', 'cold'].includes(value),
    message: 'Interest level must be one of: hot, medium, low, cold'
  },
  notes: {
    maxLength: 1000,
    message: 'Notes must be less than 1000 characters'
  }
};

/**
 * Deal validation schema
 */
export const dealValidationSchema: ValidationSchema = {
  title: {
    required: true,
    minLength: 1,
    maxLength: 200,
    message: 'Deal title is required and must be less than 200 characters'
  },
  company: {
    required: true,
    minLength: 1,
    maxLength: 100,
    message: 'Company name is required'
  },
  value: {
    required: true,
    custom: (value) => {
      const num = Number(value);
      return !isNaN(num) && num >= 0 && num <= 100000000;
    },
    message: 'Deal value must be a valid number between 0 and 100,000,000'
  },
  stage: {
    required: true,
    custom: (value) => ['qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost'].includes(value),
    message: 'Stage must be one of: qualification, proposal, negotiation, closed-won, closed-lost'
  },
  probability: {
    custom: (value) => {
      const num = Number(value);
      return !isNaN(num) && num >= 0 && num <= 100;
    },
    message: 'Probability must be a number between 0 and 100'
  },
  priority: {
    required: true,
    custom: (value) => ['high', 'medium', 'low'].includes(value),
    message: 'Priority must be one of: high, medium, low'
  },
  contact: {
    minLength: 1,
    maxLength: 100,
    message: 'Contact name must be less than 100 characters'
  },
  notes: {
    maxLength: 2000,
    message: 'Notes must be less than 2000 characters'
  }
};

/**
 * Validate a single field against its validation rules
 */
export function validateField(value: any, rules: ValidationRule | ValidationRule[]): string[] {
  const errors: string[] = [];
  const rulesArray = Array.isArray(rules) ? rules : [rules];

  for (const rule of rulesArray) {
    // Required validation
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(rule.message || 'This field is required');
      continue; // Skip other validations if required field is empty
    }

    // Skip other validations if field is empty and not required
    if (!rule.required && (value === undefined || value === null || value === '')) {
      continue;
    }

    // String-specific validations
    if (typeof value === 'string') {
      // Min length validation
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        errors.push(rule.message || `Must be at least ${rule.minLength} characters`);
      }

      // Max length validation
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        errors.push(rule.message || `Must be no more than ${rule.maxLength} characters`);
      }

      // Pattern validation
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(rule.message || 'Invalid format');
      }
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(value);
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : (rule.message || 'Invalid value'));
      }
    }
  }

  return errors;
}

/**
 * Validate an entire object against a schema
 */
export function validateSchema(data: Record<string, any>, schema: ValidationSchema): ValidationResult {
  const errors: Record<string, string[]> = {};
  let isValid = true;

  // Validate each field in the schema
  Object.entries(schema).forEach(([fieldName, rules]) => {
    const fieldErrors = validateField(data[fieldName], rules);
    if (fieldErrors.length > 0) {
      errors[fieldName] = fieldErrors;
      isValid = false;
    }
  });

  // Get first error for quick display
  const firstError = Object.values(errors).flat()[0];

  return {
    isValid,
    errors,
    firstError
  };
}

/**
 * Sanitize input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Clean and normalize email addresses
 */
export function normalizeEmail(email: string): string {
  return sanitizeInput(email).toLowerCase().trim();
}

/**
 * Clean and normalize phone numbers
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except + at the beginning
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Ensure + is only at the beginning
  if (cleaned.includes('+')) {
    const parts = cleaned.split('+');
    return '+' + parts.join('');
  }
  
  return cleaned;
}

/**
 * Validate and sanitize URL
 */
export function validateAndSanitizeUrl(url: string): { isValid: boolean; sanitized: string; error?: string } {
  try {
    const sanitized = sanitizeInput(url);
    
    // Basic URL validation
    if (!sanitized.match(/^https?:\/\/.+/)) {
      return {
        isValid: false,
        sanitized: '',
        error: 'URL must start with http:// or https://'
      };
    }

    // Try to parse URL
    new URL(sanitized);
    
    return {
      isValid: true,
      sanitized
    };
  } catch (error) {
    return {
      isValid: false,
      sanitized: '',
      error: 'Invalid URL format'
    };
  }
}

/**
 * Validate bulk import data
 */
export function validateImportData(data: any[], schema: ValidationSchema): {
  validRows: any[];
  invalidRows: Array<{ row: number; data: any; errors: string[] }>;
  summary: { total: number; valid: number; invalid: number };
} {
  const validRows: any[] = [];
  const invalidRows: Array<{ row: number; data: any; errors: string[] }> = [];

  data.forEach((rowData, index) => {
    const validation = validateSchema(rowData, schema);
    
    if (validation.isValid) {
      // Sanitize the valid data
      const sanitizedData: any = {};
      Object.entries(rowData).forEach(([key, value]) => {
        if (typeof value === 'string') {
          if (key === 'email') {
            sanitizedData[key] = normalizeEmail(value);
          } else if (key === 'phone') {
            sanitizedData[key] = normalizePhoneNumber(value);
          } else {
            sanitizedData[key] = sanitizeInput(value);
          }
        } else {
          sanitizedData[key] = value;
        }
      });
      
      validRows.push(sanitizedData);
    } else {
      invalidRows.push({
        row: index + 1,
        data: rowData,
        errors: Object.values(validation.errors).flat()
      });
    }
  });

  return {
    validRows,
    invalidRows,
    summary: {
      total: data.length,
      valid: validRows.length,
      invalid: invalidRows.length
    }
  };
}

/**
 * Rate limiting utility
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(private maxRequests: number = 10, private windowMs: number = 60000) {}
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Get or create request history for this key
    let requestTimes = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    requestTimes = requestTimes.filter(time => time > windowStart);
    
    // Check if under limit
    if (requestTimes.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    requestTimes.push(now);
    this.requests.set(key, requestTimes);
    
    return true;
  }
  
  getRemainingRequests(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const requestTimes = this.requests.get(key) || [];
    const recentRequests = requestTimes.filter(time => time > windowStart);
    
    return Math.max(0, this.maxRequests - recentRequests.length);
  }
  
  getResetTime(key: string): Date {
    const requestTimes = this.requests.get(key) || [];
    if (requestTimes.length === 0) return new Date();
    
    const oldestRequest = Math.min(...requestTimes);
    return new Date(oldestRequest + this.windowMs);
  }
}

// Create rate limiter instances for different operations
export const aiAnalysisLimiter = new RateLimiter(20, 60000); // 20 requests per minute
export const dataImportLimiter = new RateLimiter(5, 300000); // 5 imports per 5 minutes
export const emailGenerationLimiter = new RateLimiter(30, 60000); // 30 emails per minute

/**
 * Debounce utility for form inputs
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Check if data contains potential security risks
 */
export function checkDataSecurity(data: Record<string, any>): {
  hasRisks: boolean;
  risks: string[];
  sanitizedData: Record<string, any>;
} {
  const risks: string[] = [];
  const sanitizedData: Record<string, any> = {};

  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'string') {
      // Check for potential XSS
      if (value.includes('<script') || value.includes('javascript:') || value.includes('onerror=')) {
        risks.push(`Potential XSS in field: ${key}`);
      }
      
      // Check for SQL injection patterns
      if (value.includes("'") && (value.includes('DROP') || value.includes('DELETE') || value.includes('UPDATE'))) {
        risks.push(`Potential SQL injection in field: ${key}`);
      }
      
      // Sanitize the value
      sanitizedData[key] = sanitizeInput(value);
    } else {
      sanitizedData[key] = value;
    }
  });

  return {
    hasRisks: risks.length > 0,
    risks,
    sanitizedData
  };
}