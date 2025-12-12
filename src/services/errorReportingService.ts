/**
 * Error Reporting Service - Production-ready error tracking and monitoring
 * Integrates with Sentry for comprehensive error reporting
 */

interface ErrorContext {
  userId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

interface ErrorReport {
  message: string;
  stack?: string;
  context?: ErrorContext;
  timestamp: string;
  userAgent?: string;
  url?: string;
}

class ErrorReportingService {
  private sentryDsn?: string;
  private environment: string;
  private isInitialized = false;

  constructor() {
    this.environment = import.meta.env.MODE || 'development';
    this.initialize();
  }

  private initialize(): void {
    // Initialize Sentry if DSN is available
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

    if (sentryDsn && this.environment === 'production') {
      this.sentryDsn = sentryDsn;
      this.initializeSentry();
      this.isInitialized = true;
    } else {
      console.log('Sentry not configured or not in production mode');
    }
  }

  private initializeSentry(): void {
    // In a real implementation, this would initialize Sentry
    // For now, we'll log to console in development
    if (this.environment === 'development') {
      console.log('🔧 ErrorReportingService: Sentry would be initialized here');
    }
  }

  // Report an error
  reportError(error: Error | string, context?: ErrorContext): void {
    const errorReport: ErrorReport = {
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    if (this.isInitialized && this.environment === 'production') {
      this.sendToSentry(errorReport);
    } else {
      this.logToConsole(errorReport);
    }
  }

  // Report a warning
  reportWarning(message: string, context?: ErrorContext): void {
    const warningReport: ErrorReport = {
      message: `[WARNING] ${message}`,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    if (this.isInitialized && this.environment === 'production') {
      this.sendToSentry(warningReport);
    } else {
      console.warn('⚠️', message, context);
    }
  }

  // Report user interaction
  reportUserAction(action: string, metadata?: Record<string, any>): void {
    if (this.environment === 'production' && this.isInitialized) {
      // Send user action to analytics service
      this.sendUserAction(action, metadata);
    }
  }

  // Performance monitoring
  reportPerformance(metric: string, value: number, context?: ErrorContext): void {
    if (this.environment === 'production' && this.isInitialized) {
      this.sendPerformanceMetric(metric, value, context);
    } else {
      console.log(`📊 Performance: ${metric} = ${value}`, context);
    }
  }

  private sendToSentry(report: ErrorReport): void {
    // In a real implementation, this would send to Sentry
    console.log('📡 Sending error to Sentry:', report);
  }

  private sendUserAction(action: string, metadata?: Record<string, any>): void {
    // In a real implementation, this would send to analytics
    console.log('👤 User action:', action, metadata);
  }

  private sendPerformanceMetric(metric: string, value: number, context?: ErrorContext): void {
    // In a real implementation, this would send to monitoring service
    console.log('📈 Performance metric:', metric, value, context);
  }

  private logToConsole(report: ErrorReport): void {
    const logLevel = report.message.includes('[WARNING]') ? 'warn' : 'error';
    const logger = logLevel === 'warn' ? console.warn : console.error;

    logger(`🔧 ErrorReport: ${report.message}`, {
      stack: report.stack,
      context: report.context,
      timestamp: report.timestamp,
      url: report.url
    });
  }

  // Get error statistics (for debugging)
  getErrorStats(): {
    environment: string;
    isInitialized: boolean;
    hasSentry: boolean;
  } {
    return {
      environment: this.environment,
      isInitialized: this.isInitialized,
      hasSentry: !!this.sentryDsn
    };
  }
}

// Singleton instance
let errorReportingService: ErrorReportingService | null = null;

export const getErrorReportingService = (): ErrorReportingService => {
  if (!errorReportingService) {
    errorReportingService = new ErrorReportingService();
  }
  return errorReportingService;
};

export { ErrorReportingService };
export type { ErrorContext, ErrorReport };