import React from 'react';

export interface WIPLimitIndicatorProps {
  current: number;
  limit: number;
  className?: string;
}

/**
 * Visual indicator for Work In Progress limits
 */
export const WIPLimitIndicator: React.FC<WIPLimitIndicatorProps> = ({
  current,
  limit,
  className = ''
}) => {
  const percentage = Math.min((current / limit) * 100, 100);
  const isOverLimit = current > limit;
  const isNearLimit = current >= limit * 0.8;

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex-1">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              isOverLimit
                ? 'bg-red-500'
                : isNearLimit
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
      <div className={`text-xs font-medium ${
        isOverLimit
          ? 'text-red-600 dark:text-red-400'
          : isNearLimit
            ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-gray-600 dark:text-gray-400'
      }`}>
        {current}/{limit}
      </div>
    </div>
  );
};