/**
 * Error Reporting Service
 * Handles error logging and reporting to monitoring services
 */

interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
  level: 'error' | 'warning' | 'info';
  context?: Record<string, any>;
}

interface ErrorReportingConfig {
  enabled: boolean;
  service: 'console' | 'supabase'; // Simplified for now
  environment: 'development' | 'staging' | 'production';
  sampleRate: number; // 0-1, percentage of errors to report
}

class ErrorReportingService {
  private config: ErrorReportingConfig;
  private queue: ErrorReport[] = [];
  private isInitialized = false;

  constructor() {
    this.config = {
      enabled: true, // Enable for all environments for now
      service: 'console', // Start with console logging
      environment: (process.env.NODE_ENV as any) || 'development',
      sampleRate: 1.0 // Report all errors for now
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize based on service type
      switch (this.config.service) {
        case 'supabase':
          await this.initializeSupabaseReporting();
          break;
        default:
          // Console logging is always available
          break;
      }

      this.isInitialized = true;

      // Process any queued errors
      if (this.queue.length > 0) {
        const queuedErrors = [...this.queue];
        this.queue = [];
        for (const error of queuedErrors) {
          await this.sendErrorReport(error);
        }
      }
    } catch (error) {
      console.error('Failed to initialize error reporting:', error);
      // Fallback to console logging
      this.config.service = 'console';
      this.isInitialized = true;
    }
  }

  private async initializeSupabaseReporting(): Promise<void> {
    // For now, we'll use console logging with Supabase context
    // In production, you could create an error_logs table
    console.log('🔧 Error reporting initialized (console mode)');
  }


  async reportError(
    error: Error | string,
    context?: {
      componentStack?: string;
      userId?: string;
      sessionId?: string;
      additionalData?: Record<string, any>;
      level?: 'error' | 'warning' | 'info';
    }
  ): Promise<void> {
    // Sample errors based on rate
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' ? error.stack : undefined,
      componentStack: context?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userId: context?.userId,
      sessionId: context?.sessionId,
      level: context?.level || 'error',
      context: context?.additionalData
    };

    if (!this.isInitialized) {
      // Queue error for later processing
      this.queue.push(errorReport);
      return;
    }

    try {
      await this.sendErrorReport(errorReport);
    } catch (sendError) {
      console.error('Failed to send error report:', sendError);
      // Fallback to console logging
      this.sendToConsole(errorReport);
    }
  }

  private async sendErrorReport(report: ErrorReport): Promise<void> {
    switch (this.config.service) {
      case 'supabase':
        await this.sendToSupabase(report);
        break;
      default:
        this.sendToConsole(report);
        break;
    }
  }

  private async sendToSupabase(report: ErrorReport): Promise<void> {
    try {
      // For now, just log to console with Supabase context
      // In production, you could extend the activities table or create error_logs
      console.log('📊 Error logged (Supabase mode):', {
        id: report.id,
        message: report.message,
        timestamp: report.timestamp,
        environment: this.config.environment
      });

      // Optionally store in local storage for debugging
      this.storeErrorLocally(report);
    } catch (error) {
      console.error('Supabase error reporting failed:', error);
      this.sendToConsole(report);
    }
  }


  private sendToConsole(report: ErrorReport): void {
    const logMethod = report.level === 'error' ? 'error' : report.level === 'warning' ? 'warn' : 'log';
    console[logMethod](`📊 Error Report [${report.level.toUpperCase()}]:`, {
      id: report.id,
      message: report.message,
      stack: report.stack,
      componentStack: report.componentStack,
      timestamp: report.timestamp,
      url: report.url,
      environment: this.config.environment
    });
  }

  private storeErrorLocally(report: ErrorReport): void {
    try {
      const storedErrors = JSON.parse(localStorage.getItem('app_errors') || '[]');
      storedErrors.push(report);
      // Keep only last 50 errors
      if (storedErrors.length > 50) {
        storedErrors.splice(0, storedErrors.length - 50);
      }
      localStorage.setItem('app_errors', JSON.stringify(storedErrors));
    } catch (error) {
      // Ignore localStorage errors
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Method to manually flush queued errors
  async flush(): Promise<void> {
    if (this.queue.length > 0) {
      const queuedErrors = [...this.queue];
      this.queue = [];
      for (const error of queuedErrors) {
        await this.sendErrorReport(error);
      }
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<ErrorReportingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get current configuration (for debugging)
  getConfig(): ErrorReportingConfig {
    return { ...this.config };
  }

  // Get stored errors (for debugging)
  getStoredErrors(): ErrorReport[] {
    try {
      return JSON.parse(localStorage.getItem('app_errors') || '[]');
    } catch (error) {
      return [];
    }
  }

  // Clear stored errors
  clearStoredErrors(): void {
    try {
      localStorage.removeItem('app_errors');
    } catch (error) {
      // Ignore
    }
  }
}

// Singleton instance
let errorReportingInstance: ErrorReportingService | null = null;

export const getErrorReportingService = (): ErrorReportingService => {
  if (!errorReportingInstance) {
    errorReportingInstance = new ErrorReportingService();
  }
  return errorReportingInstance;
};

// Convenience functions for easy error reporting
export const reportError = (
  error: Error | string,
  context?: {
    componentStack?: string;
    userId?: string;
    sessionId?: string;
    additionalData?: Record<string, any>;
    level?: 'error' | 'warning' | 'info';
  }
): Promise<void> => {
  return getErrorReportingService().reportError(error, context);
};

export const reportWarning = (
  message: string,
  context?: {
    componentStack?: string;
    userId?: string;
    sessionId?: string;
    additionalData?: Record<string, any>;
  }
): Promise<void> => {
  return getErrorReportingService().reportError(new Error(message), { ...context, level: 'warning' });
};

export const reportInfo = (
  message: string,
  context?: {
    componentStack?: string;
    userId?: string;
    sessionId?: string;
    additionalData?: Record<string, any>;
  }
): Promise<void> => {
  return getErrorReportingService().reportError(new Error(message), { ...context, level: 'info' });
};

export type { ErrorReport, ErrorReportingConfig };