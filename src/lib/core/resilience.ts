/**
 * Production-Grade Resilience Patterns
 * Circuit Breaker, Retry Logic, and Timeout Handling
 */

import { enhancedLogger, withLogContext, createCorrelationId } from './enhancedLogger';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
  name: string;
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: Set<string>;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

export interface TimeoutOptions {
  timeoutMs: number;
  operationName: string;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private halfOpenCalls = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeoutMs: options.resetTimeoutMs || 30000,
      halfOpenMaxCalls: options.halfOpenMaxCalls || 3,
      name: options.name || 'default',
    };
  }

  getState(): CircuitState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (this.lastFailureTime && now - this.lastFailureTime >= this.options.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
        this.successCount = 0;
        enhancedLogger.info(`Circuit breaker ${this.options.name} moved to HALF_OPEN state`);
      }
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      const timeUntilReset = this.lastFailureTime 
        ? Math.max(0, this.options.resetTimeoutMs - (Date.now() - this.lastFailureTime))
        : this.options.resetTimeoutMs;
      
      throw new CircuitBreakerOpenError(
        `Circuit breaker ${this.options.name} is OPEN. Retry after ${timeUntilReset}ms`,
        timeUntilReset
      );
    }

    if (currentState === 'HALF_OPEN' && this.halfOpenCalls >= this.options.halfOpenMaxCalls) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker ${this.options.name} HALF_OPEN limit reached`
      );
    }

    if (currentState === 'HALF_OPEN') {
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.halfOpenMaxCalls) {
        this.reset();
        enhancedLogger.info(`Circuit breaker ${this.options.name} moved to CLOSED state`);
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
      enhancedLogger.error(`Circuit breaker ${this.options.name} moved to OPEN state`, {
        failureCount: this.failureCount,
        threshold: this.options.failureThreshold,
      });
    }
  }

  private reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCalls = 0;
    this.lastFailureTime = undefined;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      halfOpenCalls: this.halfOpenCalls,
    };
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string, public readonly retryAfterMs?: number) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

// ============================================================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ============================================================================

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: new Set([
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'NetworkError',
    'TimeoutError',
    'AbortError',
  ]),
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  abortSignal?: AbortSignal
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      // Check for abort before each attempt
      if (abortSignal?.aborted) {
        throw new AbortError('Operation was aborted');
      }

      const result = await fn();
      
      if (attempt > 1) {
        enhancedLogger.info(`Operation succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if aborted
      if (lastError.name === 'AbortError' || abortSignal?.aborted) {
        throw lastError;
      }

      // Check if error is retryable
      const isRetryable = opts.retryableErrors.has(lastError.name) ||
        opts.retryableErrors.has(lastError.constructor.name) ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('network') ||
        lastError.message.includes('connection');

      if (!isRetryable || attempt === opts.maxAttempts) {
        throw lastError;
      }

      // Calculate delay with exponential backoff and jitter
      const delayMs = calculateBackoff(attempt, opts);
      
      enhancedLogger.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms`, {
        error: lastError.message,
        attempt,
        maxAttempts: opts.maxAttempts,
      });

      if (opts.onRetry) {
        opts.onRetry(attempt, lastError, delayMs);
      }

      await sleep(delayMs, abortSignal);
    }
  }

  throw lastError || new Error('Retry failed');
}

function calculateBackoff(attempt: number, options: RetryOptions): number {
  const exponentialDelay = options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * cappedDelay;
  return Math.floor(cappedDelay + jitter);
}

function sleep(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    
    if (abortSignal) {
      const onAbort = () => {
        clearTimeout(timeout);
        reject(new AbortError('Operation was aborted during retry delay'));
      };
      
      if (abortSignal.aborted) {
        onAbort();
      } else {
        abortSignal.addEventListener('abort', onAbort, { once: true });
      }
    }
  });
}

export class AbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AbortError';
  }
}

// ============================================================================
// TIMEOUT HANDLING
// ============================================================================

export async function withTimeout<T>(
  fn: (abortSignal: AbortSignal) => Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs);

  try {
    const result = await fn(controller.signal);
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(
        `Operation ${options.operationName} timed out after ${options.timeoutMs}ms`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ============================================================================
// COMPOSITE RESILIENCE WRAPPER
// ============================================================================

export interface ResilienceOptions {
  timeout: TimeoutOptions;
  retry: Partial<RetryOptions>;
  circuitBreaker?: CircuitBreaker;
}

export async function withResilience<T>(
  fn: (abortSignal: AbortSignal) => Promise<T>,
  options: ResilienceOptions
): Promise<T> {
  const correlationId = createCorrelationId();
  
  return withLogContext({ correlationId, operation: options.timeout.operationName }, async () => {
    const executeWithRetry = async (): Promise<T> => {
      return withRetry(
        async () => withTimeout(fn, options.timeout),
        options.retry
      );
    };

    if (options.circuitBreaker) {
      return options.circuitBreaker.execute(executeWithRetry);
    }

    return executeWithRetry();
  });
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

export class RateLimiter {
  private requests = new Map<string, number[]>();

  constructor(private options: RateLimiterOptions) {}

  async acquire(key: string): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    
    const timestamps = this.requests.get(key) || [];
    const recentRequests = timestamps.filter(t => t > windowStart);
    
    if (recentRequests.length >= this.options.maxRequests) {
      const oldestRequest = recentRequests[0];
      const waitTime = oldestRequest + this.options.windowMs - now;
      
      enhancedLogger.warn(`Rate limit exceeded for key ${key}, waiting ${waitTime}ms`);
      await sleep(waitTime);
      
      // Recursively try again
      return this.acquire(key);
    }
    
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
  }

  getCurrentCount(key: string): number {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    const timestamps = this.requests.get(key) || [];
    return timestamps.filter(t => t > windowStart).length;
  }
}

// ============================================================================
// PREDEFINED CIRCUIT BREAKERS
// ============================================================================

export const circuitBreakers = {
  openAI: new CircuitBreaker({
    name: 'openai-api',
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    halfOpenMaxCalls: 2,
  }),
  
  supabase: new CircuitBreaker({
    name: 'supabase-db',
    failureThreshold: 10,
    resetTimeoutMs: 30000,
    halfOpenMaxCalls: 3,
  }),
};

// ============================================================================
// PREDEFINED TIMEOUTS
// ============================================================================

export const timeouts = {
  ai: { timeoutMs: 60000, operationName: 'ai-completion' },
  db: { timeoutMs: 10000, operationName: 'database-query' },
  default: { timeoutMs: 30000, operationName: 'default-operation' },
  api: { timeoutMs: 30000, operationName: 'external-api' },
};

// ============================================================================
// PREDEFINED RETRY OPTIONS
// ============================================================================

export const retryPolicies = {
  ai: {
    maxAttempts: 3,
    baseDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: new Set([
      'TimeoutError',
      'AbortError',
      'RateLimitError',
      'ECONNRESET',
    ]),
  },
  
  db: {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: new Set([
      'TimeoutError',
      'ConnectionError',
      'ECONNRESET',
    ]),
  },
  
  api: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 20000,
    backoffMultiplier: 2,
    retryableErrors: new Set([
      'TimeoutError',
      'NetworkError',
      'ECONNRESET',
      'ETIMEDOUT',
    ]),
  },
};
