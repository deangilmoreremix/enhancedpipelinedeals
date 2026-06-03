/**
 * Input validation and sanitization utilities for production safety
 */

interface ValidationResult {
  isValid: boolean;
  sanitizedValue?: any;
  error?: string;
}

interface ValidationOptions {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  allowedValues?: any[];
  customValidator?: (value: any) => boolean;
}

/**
 * Sanitize string input by removing potentially dangerous characters
 */
export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') return '';

  return input
    .replace(/</g, '') // Remove opening angle brackets
    .replace(/>/g, '') // Remove closing angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers with double quotes
    .replace(/on\w+='[^']*'/gi, '') // Remove event handlers with single quotes
    .trim();
};

/**
 * Validate and sanitize email addresses
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const sanitized = sanitizeString(email).toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(sanitized)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  if (sanitized.length > 254) {
    return { isValid: false, error: 'Email too long' };
  }

  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Validate and sanitize URLs
 */
export const validateUrl = (url: string): ValidationResult => {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL is required' };
  }

  const sanitized = sanitizeString(url);

  try {
    const urlObj = new URL(sanitized);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
    }

    return { isValid: true, sanitizedValue: sanitized };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
};

/**
 * Validate string input with customizable options
 */
export const validateString = (
  input: string,
  options: ValidationOptions = {}
): ValidationResult => {
  const {
    required = false,
    minLength = 0,
    maxLength = 10000,
    pattern,
    allowedValues,
    customValidator
  } = options;

  if (required && (!input || typeof input !== 'string' || input.trim() === '')) {
    return { isValid: false, error: 'This field is required' };
  }

  if (!input && !required) {
    return { isValid: true, sanitizedValue: '' };
  }

  const sanitized = sanitizeString(input);

  if (sanitized.length < minLength) {
    return { isValid: false, error: `Minimum length is ${minLength} characters` };
  }

  if (sanitized.length > maxLength) {
    return { isValid: false, error: `Maximum length is ${maxLength} characters` };
  }

  if (pattern && !pattern.test(sanitized)) {
    return { isValid: false, error: 'Input does not match required pattern' };
  }

  if (allowedValues && !allowedValues.includes(sanitized)) {
    return { isValid: false, error: 'Input value not allowed' };
  }

  if (customValidator && !customValidator(sanitized)) {
    return { isValid: false, error: 'Input failed custom validation' };
  }

  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Validate numeric input
 */
export const validateNumber = (
  input: any,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}
): ValidationResult => {
  const { required = false, min, max, integer = false } = options;

  if (required && (input === null || input === undefined || input === '')) {
    return { isValid: false, error: 'This field is required' };
  }

  if (!required && (input === null || input === undefined || input === '')) {
    return { isValid: true, sanitizedValue: null };
  }

  const num = Number(input);

  if (isNaN(num)) {
    return { isValid: false, error: 'Must be a valid number' };
  }

  if (integer && !Number.isInteger(num)) {
    return { isValid: false, error: 'Must be a whole number' };
  }

  if (min !== undefined && num < min) {
    return { isValid: false, error: `Must be at least ${min}` };
  }

  if (max !== undefined && num > max) {
    return { isValid: false, error: `Must be no more than ${max}` };
  }

  return { isValid: true, sanitizedValue: num };
};

/**
 * Validate contact data for AI processing
 */
export const validateContactData = (contact: any): ValidationResult => {
  if (!contact || typeof contact !== 'object') {
    return { isValid: false, error: 'Contact data is required' };
  }

  const errors: string[] = [];

  // Validate name
  if (contact.name) {
    const nameValidation = validateString(contact.name, {
      maxLength: 100
    });
    if (!nameValidation.isValid) {
      errors.push(`Name: ${nameValidation.error}`);
    }
  }

  // Validate email
  if (contact.email) {
    const emailValidation = validateEmail(contact.email);
    if (!emailValidation.isValid) {
      errors.push(`Email: ${emailValidation.error}`);
    }
  }

  // Validate company
  if (contact.company) {
    const companyValidation = validateString(contact.company, {
      maxLength: 100
    });
    if (!companyValidation.isValid) {
      errors.push(`Company: ${companyValidation.error}`);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, error: errors.join('; ') };
  }

  // Return sanitized contact data
  return {
    isValid: true,
    sanitizedValue: {
      ...contact,
      name: contact.name ? sanitizeString(contact.name) : contact.name,
      email: contact.email ? validateEmail(contact.email).sanitizedValue : contact.email,
      company: contact.company ? sanitizeString(contact.company) : contact.company,
      title: contact.title ? sanitizeString(contact.title) : contact.title
    }
  };
};

/**
 * Validate deal data for AI processing
 */
export const validateDealData = (deal: any): ValidationResult => {
  if (!deal || typeof deal !== 'object') {
    return { isValid: false, error: 'Deal data is required' };
  }

  const errors: string[] = [];

  // Validate deal name/value
  if (deal.name) {
    const nameValidation = validateString(deal.name, { maxLength: 200 });
    if (!nameValidation.isValid) {
      errors.push(`Deal name: ${nameValidation.error}`);
    }
  }

  if (deal.value) {
    const valueValidation = validateNumber(deal.value, { min: 0 });
    if (!valueValidation.isValid) {
      errors.push(`Deal value: ${valueValidation.error}`);
    }
  }

  if (deal.probability !== undefined) {
    const probValidation = validateNumber(deal.probability, { min: 0, max: 100 });
    if (!probValidation.isValid) {
      errors.push(`Probability: ${probValidation.error}`);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, error: errors.join('; ') };
  }

  return {
    isValid: true,
    sanitizedValue: {
      ...deal,
      name: deal.name ? sanitizeString(deal.name) : deal.name,
      value: deal.value ? Number(deal.value) : deal.value,
      probability: deal.probability ? Number(deal.probability) : deal.probability
    }
  };
};

/**
 * Alias for sanitizeString to match import expectations
 */
export const sanitizeInput = sanitizeString;

/**
 * Normalize email address (lowercase and trim)
 */
export const normalizeEmail = (email: string): string => {
  if (!email || typeof email !== 'string') return '';
  return email.toLowerCase().trim();
};

/**
 * Normalize phone number (remove non-digit characters except +)
 */
export const normalizePhoneNumber = (phone: string): string => {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/[^\d+]/g, '');
};

/**
 * Generic schema validation function
 */
export const validateSchema = (data: any, schema: any): ValidationResult => {
  if (!schema) {
    return { isValid: false, error: 'Schema is required' };
  }

  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Data is required' };
  }

  const errors: string[] = [];

  // Simple schema validation - check required fields and types
  for (const [field, rules] of Object.entries(schema) as [string, any][]) {
    const value = data[field];

    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    if (value !== undefined && value !== null && value !== '') {
      // Type validation
      if (rules.type) {
        switch (rules.type) {
          case 'string':
            if (typeof value !== 'string') {
              errors.push(`${field} must be a string`);
            } else if (rules.maxLength && value.length > rules.maxLength) {
              errors.push(`${field} must be ${rules.maxLength} characters or less`);
            }
            break;
          case 'number':
            const num = Number(value);
            if (isNaN(num)) {
              errors.push(`${field} must be a number`);
            } else {
              if (rules.min !== undefined && num < rules.min) {
                errors.push(`${field} must be at least ${rules.min}`);
              }
              if (rules.max !== undefined && num > rules.max) {
                errors.push(`${field} must be no more than ${rules.max}`);
              }
            }
            break;
          case 'email':
            const emailValidation = validateEmail(value);
            if (!emailValidation.isValid) {
              errors.push(`${field}: ${emailValidation.error}`);
            }
            break;
          case 'url':
            const urlValidation = validateUrl(value);
            if (!urlValidation.isValid) {
              errors.push(`${field}: ${urlValidation.error}`);
            }
            break;
        }
      }

      // Custom validation
      if (rules.customValidator && typeof rules.customValidator === 'function') {
        if (!rules.customValidator(value)) {
          errors.push(`${field} failed custom validation`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false, error: errors.join('; ') };
  }

  // Return sanitized data
  const sanitized: any = {};
  for (const [field, rules] of Object.entries(schema) as [string, any][]) {
    const value = data[field];
    if (value !== undefined && value !== null) {
      if (rules.type === 'string') {
        sanitized[field] = sanitizeString(value);
      } else if (rules.type === 'email') {
        sanitized[field] = normalizeEmail(value);
      } else if (rules.type === 'number') {
        sanitized[field] = Number(value);
      } else {
        sanitized[field] = value;
      }
    }
  }

  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Deal validation schema
 */
export const dealValidationSchema = {
  name: { type: 'string', required: true, maxLength: 200 },
  value: { type: 'number', required: false, min: 0 },
  probability: { type: 'number', required: false, min: 0, max: 100 },
  stage: { type: 'string', required: false, maxLength: 50 },
  company: { type: 'string', required: false, maxLength: 100 },
  contact: { type: 'string', required: false, maxLength: 100 },
  description: { type: 'string', required: false, maxLength: 1000 }
};

/**
 * Contact validation schema
 */
export const contactValidationSchema = {
  name: { type: 'string', required: true, maxLength: 100 },
  email: { type: 'email', required: true },
  phone: { type: 'string', required: false, maxLength: 20 },
  company: { type: 'string', required: false, maxLength: 100 },
  title: { type: 'string', required: false, maxLength: 100 },
  linkedin: { type: 'url', required: false },
  notes: { type: 'string', required: false, maxLength: 1000 }
};