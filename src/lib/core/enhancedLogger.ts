/**
 * Production-Enhanced Logger with Correlation IDs and PII Redaction
 * Enterprise-grade logging for SDR Orchestrator System
 */

import { v4 as uuidv4 } from 'uuid';

// PII Field patterns for redaction
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  ssn: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g,
  creditCard: /\b(?:\d[ -]*?){13,16}\b/g,
  apiKey: /['"\s]?[a-zA-Z0-9_-]*(?:key|token|secret|password|pwd)['"\s]?[:=]\s*['"\s]?[a-zA-Z0-9_-]+['"\s]?/gi,
};

// Sensitive field names to redact
const SENSITIVE_FIELDS = new Set([
  'password', 'token', 'secret', 'apiKey', 'api_key', 'auth',
  'credit_card', 'ssn', 'social_security', 'dob', 'date_of_birth',
  'email', 'phone', 'address', 'name', 'firstName', 'lastName',
  'full_name', 'contact_name', 'company_name', 'inbox_id', 'message_id'
]);

export interface LogContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  agentId?: string;
  contactId?: string;
  operation?: string;
  [key: string]: unknown;
}

class AsyncLocalStorageContext {
  private storage = new Map<string, LogContext>();
  
  getStore(): LogContext | undefined {
    // Simple implementation for demo - in production use Node.js AsyncLocalStorage
    return this.storage.get('current');
  }
  
  run<T>(context: LogContext, callback: () => T): T {
    this.storage.set('current', context);
    try {
      return callback();
    } finally {
      this.storage.delete('current');
    }
  }
  
  setContext(context: Partial<LogContext>): void {
    const current = this.storage.get('current');
    if (current) {
      this.storage.set('current', { ...current, ...context });
    }
  }
}

const contextStorage = new AsyncLocalStorageContext();

/**
 * Redact PII from string values
 */
function redactPII(value: string): string {
  let redacted = value;
  redacted = redacted.replace(PII_PATTERNS.email, '[REDACTED_EMAIL]');
  redacted = redacted.replace(PII_PATTERNS.phone, '[REDACTED_PHONE]');
  redacted = redacted.replace(PII_PATTERNS.ssn, '[REDACTED_SSN]');
  redacted = redacted.replace(PII_PATTERNS.creditCard, '[REDACTED_CC]');
  redacted = redacted.replace(PII_PATTERNS.apiKey, (match) => {
    const parts = match.split(/[:=]/);
    return parts.length > 1 ? `${parts[0]}=[REDACTED]` : '[REDACTED]';
  });
  return redacted;
}

/**
 * Recursively sanitize data to remove PII
 */
function sanitizeData(data: unknown, depth = 0): unknown {
  if (depth > 10) return '[MAX_DEPTH_REACHED]';
  
  if (data === null || data === undefined) return data;
  
  if (typeof data === 'string') {
    return redactPII(data);
  }
  
  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }
  
  if (data instanceof Date) {
    return data.toISOString();
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, depth + 1));
  }
  
  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Check if field is sensitive
      if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(value, depth + 1);
      }
    }
    return sanitized;
  }
  
  return '[UNSERIALIZABLE]';
}

/**
 * Create a correlation ID for distributed tracing
 */
export function createCorrelationId(): string {
  return `corr-${uuidv4()}`;
}

/**
 * Get current log context or create new one
 */
export function getCurrentContext(): LogContext {
  return contextStorage.getStore() || {
    correlationId: createCorrelationId(),
  };
}

/**
 * Run code within a logging context
 */
export function withLogContext<T>(context: Partial<LogContext>, fn: () => T): T {
  const current = getCurrentContext();
  const newContext: LogContext = {
    ...current,
    ...context,
    correlationId: context.correlationId || current.correlationId || createCorrelationId(),
  };
  return contextStorage.run(newContext, fn);
}

/**
 * Enhanced logger with correlation IDs and PII redaction
 */
export const enhancedLogger = {
  /**
   * Log info level message
   */
  info: (message: string, data?: Record<string, unknown>): void => {
    const context = getCurrentContext();
    const sanitizedData = data ? sanitizeData(data) : undefined;
    
    console.log(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      message: redactPII(message),
      correlationId: context.correlationId,
      traceId: context.traceId,
      spanId: context.spanId,
      agentId: context.agentId,
      operation: context.operation,
      data: sanitizedData,
    }));
  },

  /**
   * Log warning level message
   */
  warn: (message: string, data?: Record<string, unknown>): void => {
    const context = getCurrentContext();
    const sanitizedData = data ? sanitizeData(data) : undefined;
    
    console.warn(JSON.stringify({
      level: 'WARN',
      timestamp: new Date().toISOString(),
      message: redactPII(message),
      correlationId: context.correlationId,
      traceId: context.traceId,
      spanId: context.spanId,
      agentId: context.agentId,
      operation: context.operation,
      data: sanitizedData,
    }));
  },

  /**
   * Log error level message
   */
  error: (message: string, data?: Record<string, unknown>): void => {
    const context = getCurrentContext();
    const sanitizedData = data ? sanitizeData(data) : undefined;
    
    console.error(JSON.stringify({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      message: redactPII(message),
      correlationId: context.correlationId,
      traceId: context.traceId,
      spanId: context.spanId,
      agentId: context.agentId,
      operation: context.operation,
      data: sanitizedData,
    }));
  },

  /**
   * Log debug level message (only in development)
   */
  debug: (message: string, data?: Record<string, unknown>): void => {
    if (process.env.NODE_ENV === 'production') return;
    
    const context = getCurrentContext();
    const sanitizedData = data ? sanitizeData(data) : undefined;
    
    console.debug(JSON.stringify({
      level: 'DEBUG',
      timestamp: new Date().toISOString(),
      message: redactPII(message),
      correlationId: context.correlationId,
      data: sanitizedData,
    }));
  },

  /**
   * Start a performance timer
   */
  startTimer: (label: string): (data?: Record<string, unknown>) => void => {
    const start = performance.now();
    const context = getCurrentContext();
    
    return (data?: Record<string, unknown>) => {
      const duration = performance.now() - start;
      enhancedLogger.info(`Timer: ${label}`, {
        duration: Math.round(duration * 100) / 100,
        unit: 'ms',
        ...data,
      });
    };
  },

  /**
   * Create a child logger with additional context
   */
  child: (additionalContext: Partial<LogContext>) => {
    const parentContext = getCurrentContext();
    const childContext = { ...parentContext, ...additionalContext };
    
    return {
      info: (message: string, data?: Record<string, unknown>) => 
        withLogContext(childContext, () => enhancedLogger.info(message, data)),
      warn: (message: string, data?: Record<string, unknown>) => 
        withLogContext(childContext, () => enhancedLogger.warn(message, data)),
      error: (message: string, data?: Record<string, unknown>) => 
        withLogContext(childContext, () => enhancedLogger.error(message, data)),
      debug: (message: string, data?: Record<string, unknown>) => 
        withLogContext(childContext, () => enhancedLogger.debug(message, data)),
    };
  },
};

export { contextStorage };
export default enhancedLogger;
