/**
 * Comprehensive tests for input validation and sanitization utilities
 */

import {
  sanitizeString,
  validateEmail,
  validateUrl,
  validateString,
  validateNumber,
  validateContactData,
  validateDealData
} from '../utils/validation';

describe('Input Validation Utilities', () => {
  describe('sanitizeString', () => {
    it('should remove angle brackets', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    });

    it('should remove javascript protocol', () => {
      expect(sanitizeString('javascript:alert("xss")')).toBe('alert("xss")');
    });

    it('should remove event handlers', () => {
      expect(sanitizeString('<div onclick="alert()">test</div>')).toBe('div test/div');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  test  ')).toBe('test');
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const result = validateEmail('test@example.com');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('test@example.com');
    });

    it('should reject invalid email formats', () => {
      const result = validateEmail('invalid-email');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid email format');
    });

    it('should reject emails that are too long', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const result = validateEmail(longEmail);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should handle empty input', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      const result = validateUrl('https://example.com');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('https://example.com');
    });

    it('should reject non-HTTP protocols', () => {
      const result = validateUrl('ftp://example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Only HTTP and HTTPS');
    });

    it('should reject malformed URLs', () => {
      const result = validateUrl('not-a-url');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });
  });

  describe('validateString', () => {
    it('should validate required strings', () => {
      const result = validateString('test', { required: true });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('test');
    });

    it('should reject empty required strings', () => {
      const result = validateString('', { required: true });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should enforce minimum length', () => {
      const result = validateString('a', { minLength: 3 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Minimum length');
    });

    it('should enforce maximum length', () => {
      const result = validateString('a'.repeat(11), { maxLength: 10 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Maximum length');
    });

    it('should validate against allowed values', () => {
      const result = validateString('invalid', { allowedValues: ['valid1', 'valid2'] });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not allowed');
    });
  });

  describe('validateNumber', () => {
    it('should validate correct numbers', () => {
      const result = validateNumber('42');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe(42);
    });

    it('should enforce minimum values', () => {
      const result = validateNumber('5', { min: 10 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least 10');
    });

    it('should enforce maximum values', () => {
      const result = validateNumber('15', { max: 10 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('no more than 10');
    });

    it('should validate integers', () => {
      const result = validateNumber('3.14', { integer: true });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('whole number');
    });

    it('should handle non-numeric input', () => {
      const result = validateNumber('not-a-number');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('valid number');
    });
  });

  describe('validateContactData', () => {
    it('should validate correct contact data', () => {
      const contact = {
        name: 'John Doe',
        email: 'john@example.com',
        company: 'ACME Corp',
        title: 'CEO'
      };
      const result = validateContactData(contact);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toEqual(contact);
    });

    it('should sanitize contact data', () => {
      const contact = {
        name: '<script>John Doe</script>',
        email: 'john@example.com',
        company: 'ACME Corp <b>Inc</b>'
      };
      const result = validateContactData(contact);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue?.name).toBe('scriptJohn Doe/script');
      expect(result.sanitizedValue?.company).toBe('ACME Corp bInc/b');
    });

    it('should reject invalid email in contact data', () => {
      const contact = {
        name: 'John Doe',
        email: 'invalid-email',
        company: 'ACME Corp'
      };
      const result = validateContactData(contact);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Email:');
    });
  });

  describe('validateDealData', () => {
    it('should validate correct deal data', () => {
      const deal = {
        name: 'Big Deal',
        value: 100000,
        probability: 75
      };
      const result = validateDealData(deal);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toEqual({
        name: 'Big Deal',
        value: 100000,
        probability: 75
      });
    });

    it('should reject invalid probability', () => {
      const deal = {
        name: 'Big Deal',
        value: 100000,
        probability: 150
      };
      const result = validateDealData(deal);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Probability:');
    });

    it('should reject negative values', () => {
      const deal = {
        name: 'Big Deal',
        value: -1000,
        probability: 50
      };
      const result = validateDealData(deal);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Deal value:');
    });
  });
});