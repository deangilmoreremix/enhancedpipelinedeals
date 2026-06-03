/**
 * Lazy Loading Utilities for Performance Optimization
 * Provides utilities for code splitting and dynamic imports
 */

import React, { Suspense, lazy, ComponentType } from 'react';

// Loading fallback component
const LoadingFallback: React.FC<{ message?: string }> = ({
  message = "Loading..."
}) => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    <span className="ml-3 text-gray-600">{message}</span>
  </div>
);

// Error boundary for lazy components
const LazyErrorBoundary: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback
}) => {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  if (hasError) {
    return fallback || (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Failed to load component. Please refresh the page.</p>
      </div>
    );
  }

  return <>{children}</>;
};

// Dynamic imports for services (can be used with React Query or SWR)
export const loadAIService = async () => {
  const { getAIFunctionOrchestrator } = await import('../../services/aiFunctionOrchestrator');
  return getAIFunctionOrchestrator();
};

export const loadMonitoringService = async () => {
  const { getMonitoringService } = await import('../../services/monitoringService');
  return getMonitoringService();
};

export const loadValidationUtils = async () => {
  return await import('../../utils/validation');
};

// Preload critical components on user interaction
export const preloadCriticalComponents = () => {
  // Preload essential components
  import('../ui/ResearchStatusOverlay');
  import('../ErrorBoundary');
};

export const preloadOptionalComponents = () => {
  // Preload optional heavy components
  import('../VoiceAgentPanel');
  import('../VideoAgentPanel');
  import('../sdr/SDRAgentsHub');
};

// Intersection Observer for lazy loading based on visibility
export const useLazyLoadOnVisible = (ref: React.RefObject<Element>, callback: () => void) => {
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            callback();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, callback]);
};

// Bundle splitting utilities
export const createLazyComponent = <T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) => {
  return lazy(importFn);
};

export const withLazyLoading = <T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  LoadingComponent?: ComponentType<any>
) => {
  const LazyComponent = lazy(importFn);

  return (props: React.ComponentProps<T>) => (
    <Suspense fallback={LoadingComponent ? <LoadingComponent /> : <LoadingFallback />}>
      <LazyComponent {...props} />
    </Suspense>
  );
};