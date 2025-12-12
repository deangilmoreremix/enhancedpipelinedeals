/**
 * Monitoring and Observability Service
 * Provides comprehensive application monitoring, error tracking, and performance metrics
 */

import { getSupabaseService } from './supabaseService';

interface ErrorEvent {
  message: string;
  stack?: string;
  component?: string;
  userId?: string;
  sessionId?: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

interface UserAction {
  action: string;
  userId?: string;
  component: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface MonitoringConfig {
  enableErrorTracking: boolean;
  enablePerformanceMonitoring: boolean;
  enableUserAnalytics: boolean;
  errorReportingEndpoint?: string;
  metricsEndpoint?: string;
  sampleRate: number; // 0.0 to 1.0
}

class MonitoringService {
  private config: MonitoringConfig;
  private errorBuffer: ErrorEvent[] = [];
  private metricsBuffer: PerformanceMetric[] = [];
  private userActionsBuffer: UserAction[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enableErrorTracking: true,
      enablePerformanceMonitoring: true,
      enableUserAnalytics: true,
      sampleRate: 1.0,
      ...config
    };

    this.initialize();
  }

  private initialize(): void {
    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flushBuffers();
    }, 30000); // Flush every 30 seconds

    // Track page visibility for performance monitoring
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.trackPerformanceMetric('page_hidden', Date.now(), 'timestamp');
        } else {
          this.trackPerformanceMetric('page_visible', Date.now(), 'timestamp');
        }
      });
    }

    // Track page load performance
    if (typeof window !== 'undefined' && window.performance) {
      window.addEventListener('load', () => {
        const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.trackPerformanceMetric('page_load_time', navigation.loadEventEnd - navigation.fetchStart, 'ms');
          this.trackPerformanceMetric('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart, 'ms');
        }
      });
    }
  }

  // Error Tracking
  trackError(error: Error | string, context?: {
    component?: string;
    userId?: string;
    sessionId?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    additionalContext?: Record<string, any>;
  }): void {
    if (!this.config.enableErrorTracking) return;
    if (Math.random() > this.config.sampleRate) return;

    const errorEvent: ErrorEvent = {
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      component: context?.component,
      userId: context?.userId,
      sessionId: context?.sessionId,
      timestamp: Date.now(),
      severity: context?.severity || 'medium',
      context: context?.additionalContext
    };

    this.errorBuffer.push(errorEvent);

    // Immediately report critical errors
    if (errorEvent.severity === 'critical') {
      this.reportError(errorEvent);
    }
  }

  private async reportError(errorEvent: ErrorEvent): Promise<void> {
    try {
      if (this.config.errorReportingEndpoint) {
        await fetch(this.config.errorReportingEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorEvent)
        });
      } else {
        // Fallback to console in development
        console.error('🚨 Error tracked:', errorEvent);
      }
    } catch (reportingError) {
      console.error('🚨 Failed to report error:', reportingError);
    }
  }

  // Performance Monitoring
  trackPerformanceMetric(
    name: string,
    value: number,
    unit: string,
    tags?: Record<string, string>
  ): void {
    if (!this.config.enablePerformanceMonitoring) return;
    if (Math.random() > this.config.sampleRate) return;

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags
    };

    this.metricsBuffer.push(metric);
  }

  startPerformanceTimer(name: string, tags?: Record<string, string>): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.trackPerformanceMetric(`${name}_duration`, duration, 'ms', tags);
    };
  }

  // User Analytics
  trackUserAction(
    action: string,
    component: string,
    metadata?: Record<string, any>,
    userId?: string
  ): void {
    if (!this.config.enableUserAnalytics) return;
    if (Math.random() > this.config.sampleRate) return;

    const userAction: UserAction = {
      action,
      userId,
      component,
      timestamp: Date.now(),
      metadata
    };

    this.userActionsBuffer.push(userAction);
  }

  // AI-specific monitoring
  async trackAIFunctionCall(
    functionName: string,
    executionTime: number,
    success: boolean,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.trackPerformanceMetric(
      'ai_function_execution_time',
      executionTime,
      'ms',
      { function: functionName, success: success.toString() }
    );

    this.trackUserAction(
      'ai_function_call',
      'AIFunctionOrchestrator',
      {
        functionName,
        executionTime,
        success,
        ...metadata
      },
      userId
    );

    // Save AI usage metrics to database
    if (userId) {
      try {
        const supabaseService = getSupabaseService();
        await supabaseService.saveAIUsageMetric({
          user_id: userId,
          service_name: 'AIFunctionOrchestrator',
          operation: functionName,
          model_used: metadata?.modelUsed,
          tokens_used: metadata?.tokensUsed,
          cost_usd: metadata?.cost,
          duration_ms: executionTime,
          success,
          error_message: success ? undefined : metadata?.error,
          metadata
        });
      } catch (error) {
        console.error('Failed to save AI usage metric:', error);
      }
    }
  }

  trackRateLimitExceeded(userId: string, functionName: string): void {
    this.trackError(
      `Rate limit exceeded for ${functionName}`,
      {
        component: 'AIFunctionOrchestrator',
        userId,
        severity: 'medium',
        additionalContext: { functionName }
      }
    );
  }

  // Buffer flushing
  private async flushBuffers(): Promise<void> {
    // Flush errors
    if (this.errorBuffer.length > 0) {
      const errorsToFlush = [...this.errorBuffer];
      this.errorBuffer = [];

      for (const error of errorsToFlush) {
        await this.reportError(error);
      }
    }

    // Flush metrics
    if (this.metricsBuffer.length > 0) {
      const metricsToFlush = [...this.metricsBuffer];
      this.metricsBuffer = [];

      await this.reportMetrics(metricsToFlush);
    }

    // Flush user actions
    if (this.userActionsBuffer.length > 0) {
      const actionsToFlush = [...this.userActionsBuffer];
      this.userActionsBuffer = [];

      await this.reportUserActions(actionsToFlush);
    }
  }

  private async reportMetrics(metrics: PerformanceMetric[]): Promise<void> {
    try {
      if (this.config.metricsEndpoint) {
        await fetch(this.config.metricsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metrics })
        });
      } else {
        // Fallback to console in development
        console.log('📊 Metrics:', metrics);
      }
    } catch (error) {
      console.error('🚨 Failed to report metrics:', error);
    }
  }

  private async reportUserActions(actions: UserAction[]): Promise<void> {
    try {
      if (this.config.metricsEndpoint) {
        await fetch(this.config.metricsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userActions: actions })
        });
      } else {
        // Fallback to console in development
        console.log('👤 User Actions:', actions);
      }
    } catch (error) {
      console.error('🚨 Failed to report user actions:', error);
    }
  }

  // Health check
  getHealthStatus(): {
    errorsInBuffer: number;
    metricsInBuffer: number;
    userActionsInBuffer: number;
    lastFlushTime: number;
  } {
    return {
      errorsInBuffer: this.errorBuffer.length,
      metricsInBuffer: this.metricsBuffer.length,
      userActionsInBuffer: this.userActionsBuffer.length,
      lastFlushTime: Date.now() // Simplified - in real implementation, track actual flush times
    };
  }

  // Cleanup
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    this.flushBuffers();
  }
}

// Singleton instance
let monitoringInstance: MonitoringService | null = null;

export const getMonitoringService = (config?: Partial<MonitoringConfig>): MonitoringService => {
  if (!monitoringInstance) {
    monitoringInstance = new MonitoringService(config);
  }
  return monitoringInstance;
};

export type { ErrorEvent, PerformanceMetric, UserAction, MonitoringConfig };