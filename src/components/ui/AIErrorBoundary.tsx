import React, { ReactNode } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';

interface AIErrorBoundaryProps {
  children: ReactNode;
  serviceName?: string;
  onRetry?: () => void;
}

/**
 * Specialized error boundary for AI components with user-friendly messaging
 */
export const AIErrorBoundary: React.FC<AIErrorBoundaryProps> = ({
  children,
  serviceName = 'AI Service',
  onRetry
}) => {
  return (
    <ErrorBoundary
      level="component"
      fallback={
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mt-0.5">
              <span className="text-blue-600 dark:text-blue-400 text-xs">🤖</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {serviceName} Temporarily Unavailable
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                The AI service is currently experiencing issues. This may be due to high demand or a temporary outage.
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="mt-2 text-sm text-blue-800 dark:text-blue-200 hover:text-blue-900 dark:hover:text-blue-100 underline"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

export default AIErrorBoundary;