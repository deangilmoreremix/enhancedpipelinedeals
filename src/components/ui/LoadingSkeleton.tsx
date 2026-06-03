import React from 'react';

interface LoadingSkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;
}

// Helper to convert size to pixel string
const toPixels = (size: string | number): string => {
  return typeof size === 'number' ? `${size}px` : size;
};

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'text',
  width = '100%',
  height,
  className = '',
  count = 1
}) => {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700';
  
  const getVariantClasses = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded-md';
      case 'card':
        return 'rounded-xl';
      case 'text':
      default:
        return 'rounded';
    }
  };

  const getDefaultHeight = () => {
    if (height) return toPixels(height);
    switch (variant) {
      case 'circular':
        return toPixels(width);
      case 'card':
        return '200px';
      case 'text':
        return '1em';
      default:
        return '40px';
    }
  };

  const skeletonStyle = {
    width: toPixels(width),
    height: getDefaultHeight()
  };

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`${baseClasses} ${getVariantClasses()} ${className}`}
          style={skeletonStyle}
        />
      ))}
    </>
  );
};

// Specialized skeleton components for common use cases
export const DealCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between mb-4">
      <LoadingSkeleton variant="text" width="60%" height="24px" />
      <LoadingSkeleton variant="rectangular" width="80px" height="24px" />
    </div>
    <div className="space-y-3">
      <LoadingSkeleton variant="text" width="40%" />
      <LoadingSkeleton variant="text" width="80%" />
      <div className="flex space-x-2 mt-4">
        <LoadingSkeleton variant="rectangular" width="100px" height="32px" />
        <LoadingSkeleton variant="rectangular" width="100px" height="32px" />
      </div>
    </div>
  </div>
);

export const ContactCardSkeleton: React.FC = () => (
  <div className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <LoadingSkeleton variant="circular" width={48} height={48} />
    <div className="flex-1 space-y-2">
      <LoadingSkeleton variant="text" width="60%" />
      <LoadingSkeleton variant="text" width="40%" />
    </div>
  </div>
);

export const StatCardSkeleton: React.FC = () => (
  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
    <LoadingSkeleton variant="text" width="50%" className="mb-2" />
    <LoadingSkeleton variant="text" width="80%" height="32px" />
  </div>
);

export const InsightsPanelSkeleton: React.FC = () => (
  <div className="p-6 space-y-6">
    {/* Health Score Skeleton */}
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-6">
        <LoadingSkeleton variant="circular" width={128} height={128} />
        <div className="flex-1 space-y-3">
          <LoadingSkeleton variant="text" width="80%" />
          <LoadingSkeleton variant="text" width="60%" />
        </div>
      </div>
    </div>

    {/* Recommendations Skeleton */}
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <LoadingSkeleton variant="text" width="40%" height="24px" className="mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <LoadingSkeleton variant="text" width="100%" />
            <LoadingSkeleton variant="text" width="80%" className="mt-2" />
          </div>
        ))}
      </div>
    </div>

    {/* Analytics Grid Skeleton */}
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <LoadingSkeleton variant="text" width="40%" height="24px" className="mb-4" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
  </div>
);
