import React from 'react';

/** Placeholder cards while deals load (Tailwind animate-pulse). */
export const CardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse" aria-hidden="true">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      </div>
      <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
    </div>
    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
  </div>
);

export const ColumnSkeleton: React.FC<{ cards?: number }> = ({ cards = 3 }) => (
  <div className="space-y-3" role="status" aria-label="Loading deals">
    {Array.from({ length: cards }).map((_, i) => <CardSkeleton key={i} />)}
  </div>
);
