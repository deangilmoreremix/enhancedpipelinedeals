import React from 'react';
import { Clock, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface SLAIndicatorProps {
  dealId: string;
  slaTargetHours?: number;
  elapsedHours?: number;
  status: 'on-track' | 'at-risk' | 'breached' | 'completed';
  lastUpdated?: Date;
  nextMilestone?: string;
  onExtendSLA?: (dealId: string) => void;
  onNotifyTeam?: (dealId: string) => void;
  compact?: boolean;
}

export const SLAIndicator: React.FC<SLAIndicatorProps> = ({
  dealId,
  slaTargetHours = 72,
  elapsedHours = 0,
  status,
  lastUpdated,
  nextMilestone,
  onExtendSLA,
  onNotifyTeam,
  compact = false
}) => {
  const percentage = Math.min((elapsedHours / slaTargetHours) * 100, 100);
  const remainingHours = Math.max(slaTargetHours - elapsedHours, 0);

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'on-track':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'at-risk':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'breached':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'on-track':
        return <Clock className="w-4 h-4" />;
      case 'at-risk':
        return <TrendingUp className="w-4 h-4" />;
      case 'breached':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getProgressColor = () => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full border ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="ml-1.5 font-medium text-sm">
          {status === 'completed' ? 'Done' : `${remainingHours}h left`}
        </span>
        <div className="ml-2 w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getProgressColor()} transition-all`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">SLA Status</h3>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
          {status.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ')}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">Time Elapsed</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {elapsedHours}h / {slaTargetHours}h
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor()} transition-all`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {remainingHours}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Hours Remaining</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(percentage)}%
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Complete</p>
          </div>
        </div>

        {nextMilestone && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Next Milestone</p>
            <p className="text-sm text-blue-900 dark:text-blue-200">{nextMilestone}</p>
          </div>
        )}

        {status === 'at-risk' && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                Deal approaching SLA limit
              </p>
            </div>
            {onNotifyTeam && (
              <button
                onClick={() => onNotifyTeam(dealId)}
                className="text-xs text-yellow-600 hover:text-yellow-800 underline"
              >
                Notify team
              </button>
            )}
          </div>
        )}

        {status === 'breached' && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <p className="text-sm font-medium text-red-900 dark:text-red-200">
                SLA breached - Immediate action required
              </p>
            </div>
            <div className="flex space-x-2">
              {onExtendSLA && (
                <button
                  onClick={() => onExtendSLA(dealId)}
                  className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Extend SLA
                </button>
              )}
              {onNotifyTeam && (
                <button
                  onClick={() => onNotifyTeam(dealId)}
                  className="text-xs text-red-600 hover:text-red-800 underline"
                >
                  Notify team
                </button>
              )}
            </div>
          </div>
        )}

        {lastUpdated && (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
};

export default SLAIndicator;