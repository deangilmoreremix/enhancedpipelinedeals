/**
 * Research Status Overlay Component
 * Real-time status updates and progress tracking for AI research processes
 */

import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  ExternalLink,
  FileText,
  Search,
  Brain,
  Zap,
  Activity
} from 'lucide-react';

interface ResearchStatus {
  id: string;
  stage: 'researching' | 'analyzing' | 'synthesizing' | 'optimizing' | 'complete' | 'error';
  message: string;
  progress: number;
  timestamp: Date;
  sourceCount?: number;
  estimatedTimeRemaining?: number;
}

interface ResearchStatusOverlayProps {
  isVisible: boolean;
  statuses: ResearchStatus[];
  onClose?: () => void;
  onRetry?: (statusId: string) => void;
  position?: 'top-right' | 'bottom-right' | 'center';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Shared utility functions
const getStageIcon = (stage: string) => {
  switch (stage) {
    case 'researching': return Search;
    case 'analyzing': return Brain;
    case 'synthesizing': return FileText;
    case 'optimizing': return Zap;
    case 'complete': return CheckCircle;
    case 'error': return AlertCircle;
    default: return Activity;
  }
};

const getStageColor = (stage: string) => {
  switch (stage) {
    case 'researching': return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
    case 'analyzing': return 'text-purple-500 bg-purple-100 dark:bg-purple-900/30';
    case 'synthesizing': return 'text-green-500 bg-green-100 dark:bg-green-900/30';
    case 'optimizing': return 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30';
    case 'complete': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
    case 'error': return 'text-red-500 bg-red-100 dark:bg-red-900/30';
    default: return 'text-gray-500 bg-gray-100 dark:bg-gray-900/30';
  }
};

const ResearchStatusOverlay: React.FC<ResearchStatusOverlayProps> = ({
  isVisible,
  statuses,
  onClose,
  onRetry,
  position = 'top-right',
  size = 'md',
  className = ''
}) => {
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null);

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'center': 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
  };

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg'
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (!isVisible || statuses.length === 0) {
    return null;
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50 ${className}`}>
      <div className={`${sizeClasses[size]} bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI Research Status
            </h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status List */}
        <div className="max-h-96 overflow-y-auto">
          {statuses.map((status, index) => {
            const Icon = getStageIcon(status.stage);
            const isExpanded = expandedStatus === status.id;
            const isLast = index === statuses.length - 1;

            return (
              <div
                key={status.id}
                className={`p-4 border-b border-gray-100 dark:border-gray-800 ${
                  !isLast ? '' : 'border-b-0'
                } hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors`}
              >
                <div className="flex items-start space-x-3">
                  {/* Status Icon */}
                  <div className={`p-2 rounded-lg ${getStageColor(status.stage)}`}>
                    {status.stage === 'complete' ? (
                      <Icon className="w-4 h-4" />
                    ) : status.stage === 'error' ? (
                      <Icon className="w-4 h-4" />
                    ) : (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>

                  {/* Status Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {status.stage.replace('_', ' ')}
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {status.timestamp.toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      {status.message}
                    </p>

                    {/* Progress Bar */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{status.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            status.stage === 'error'
                              ? 'bg-red-500'
                              : status.stage === 'complete'
                              ? 'bg-green-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${status.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-4">
                        {status.sourceCount !== undefined && (
                          <div className="flex items-center space-x-1">
                            <FileText className="w-3 h-3" />
                            <span>{status.sourceCount} sources</span>
                          </div>
                        )}
                        {status.estimatedTimeRemaining !== undefined && status.stage !== 'complete' && (
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(status.estimatedTimeRemaining)} left</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setExpandedStatus(isExpanded ? null : status.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          {isExpanded ? 'Less' : 'More'}
                        </button>

                        {status.stage === 'error' && onRetry && (
                          <button
                            onClick={() => onRetry(status.id)}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                          <div className="flex justify-between">
                            <span>Status ID:</span>
                            <span className="font-mono">{status.id.slice(0, 8)}...</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Started:</span>
                            <span>{status.timestamp.toLocaleString()}</span>
                          </div>
                          {status.sourceCount !== undefined && (
                            <div className="flex justify-between">
                              <span>Sources Found:</span>
                              <span>{status.sourceCount}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-green-500" />
              <span className="text-gray-600 dark:text-gray-400">
                {statuses.filter(s => s.stage === 'complete').length} of {statuses.length} completed
              </span>
            </div>

            {statuses.some(s => s.stage === 'error') && (
              <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">
                  {statuses.filter(s => s.stage === 'error').length} errors
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Mini status indicator for inline use
interface MiniStatusIndicatorProps {
  status: ResearchStatus;
  className?: string;
}

export const MiniStatusIndicator: React.FC<MiniStatusIndicatorProps> = ({
  status,
  className = ''
}) => {
  const Icon = getStageIcon(status.stage);

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'researching': return 'text-blue-500';
      case 'analyzing': return 'text-purple-500';
      case 'synthesizing': return 'text-green-500';
      case 'optimizing': return 'text-yellow-500';
      case 'complete': return 'text-green-600';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-1 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm ${className}`}>
      {status.stage === 'complete' ? (
        <Icon className="w-4 h-4 text-green-600" />
      ) : status.stage === 'error' ? (
        <Icon className="w-4 h-4 text-red-500" />
      ) : (
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      )}

      <span className={`text-sm font-medium ${getStageColor(status.stage)}`}>
        {status.stage === 'complete' ? 'Complete' :
         status.stage === 'error' ? 'Error' :
         status.stage.charAt(0).toUpperCase() + status.stage.slice(1)}
      </span>

      <span className="text-xs text-gray-500">
        {status.progress}%
      </span>
    </div>
  );
};

export default ResearchStatusOverlay;