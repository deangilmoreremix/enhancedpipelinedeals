import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Error Boundary for SDRAgentsHub component to prevent app crashes
 */
export class SDRAgentsHubErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 SDRAgentsHub Error Boundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback or default error UI
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} resetError={this.resetError} />;
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">🚨</div>
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
              SDR Agents Hub Error
            </h2>
            <p className="text-red-600 dark:text-red-300 mb-4">
              Something went wrong with the SDR Agents Hub. This might be due to missing configuration or a temporary issue.
            </p>

            <div className="bg-red-100 dark:bg-red-800 rounded p-3 mb-4 text-left">
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-red-800 dark:text-red-200">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap">
                  {this.state.error?.message || 'Unknown error'}
                  {this.state.errorInfo && (
                    <div className="mt-2">
                      Component Stack:
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </pre>
              </details>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.resetError}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Reload Page
              </button>
            </div>

            <div className="mt-4 text-xs text-red-500 dark:text-red-400">
              If this problem persists, please check your SDR_AGENTS configuration.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}