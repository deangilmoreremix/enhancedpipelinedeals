import React from 'react';
import ResearchStatusOverlay, { MiniStatusIndicator } from './ResearchStatusOverlay';
import { useResearchStatusOverlay } from '../../hooks/useResearchStatusOverlay';
import { ModernButton } from './ModernButton';
import { Activity } from 'lucide-react';

interface ResearchStatusManagerProps {
  className?: string;
}

export const ResearchStatusManager: React.FC<ResearchStatusManagerProps> = ({ className = '' }) => {
  const {
    statuses,
    isVisible,
    showOverlay,
    hideOverlay,
    clearCompleted,
    retryStatus
  } = useResearchStatusOverlay();

  const activeStatuses = statuses.filter(status =>
    status.stage !== 'complete' && status.stage !== 'error'
  );

  const hasActiveResearch = activeStatuses.length > 0;

  return (
    <>
      {/* Research Status Overlay */}
      <ResearchStatusOverlay
        isVisible={isVisible}
        statuses={statuses}
        onClose={hideOverlay}
        onRetry={retryStatus}
        position="top-right"
        size="md"
      />

      {/* Mini Status Indicator - can be placed in header/toolbar */}
      {hasActiveResearch && (
        <div
          className={`fixed top-4 right-4 z-40 cursor-pointer hover:scale-105 transition-transform ${className}`}
          onClick={showOverlay}
        >
          <MiniStatusIndicator
            status={activeStatuses[0]}
          />
        </div>
      )}

      {/* Research Control Panel - can be embedded in UI */}
      <div className={`bg-white rounded-lg border shadow-sm p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">AI Research Operations</h3>
          </div>

          {statuses.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">
                {activeStatuses.length} active, {statuses.length - activeStatuses.length} total
              </span>
              <ModernButton
                variant="outline"
                size="xs"
                onClick={showOverlay}
                className="text-xs"
              >
                View Details
              </ModernButton>
            </div>
          )}
        </div>

        {statuses.length === 0 ? (
          <div className="text-center py-4">
            <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No active research operations</p>
            <p className="text-xs text-gray-400 mt-1">
              Research status will appear here when AI operations are running
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {statuses.slice(0, 3).map((status) => (
              <div key={status.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <MiniStatusIndicator status={status} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{status.message}</p>
                    <p className="text-xs text-gray-500">
                      {status.sourceCount ? `${status.sourceCount} sources • ` : ''}
                      {status.progress}% complete
                    </p>
                  </div>
                </div>

                {status.stage === 'error' && (
                  <ModernButton
                    variant="danger"
                    size="xs"
                    onClick={() => retryStatus(status.id)}
                  >
                    Retry
                  </ModernButton>
                )}
              </div>
            ))}

            {statuses.length > 3 && (
              <div className="text-center pt-2">
                <ModernButton
                  variant="ghost"
                  size="xs"
                  onClick={showOverlay}
                >
                  View All {statuses.length} Operations
                </ModernButton>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t">
              <ModernButton
                variant="outline"
                size="xs"
                onClick={clearCompleted}
                disabled={!statuses.some(s => s.stage === 'complete' || s.stage === 'error')}
              >
                Clear Completed
              </ModernButton>

              <ModernButton
                variant="primary"
                size="xs"
                onClick={showOverlay}
              >
                Full Status View
              </ModernButton>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// Hook for easy integration into components
export const useResearchStatusManager = () => {
  return useResearchStatusOverlay();
};