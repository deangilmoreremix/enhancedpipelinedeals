import React, { useCallback, useMemo } from 'react';
import { WorkflowStep, WorkflowAction, ActionType } from '../../types/workflow';
import { Plus, Trash2, Copy, Edit2, Check, X, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface WorkflowDiagramProps {
  steps: WorkflowStep[];
  onStepAdd?: (stepType: 'trigger' | 'action' | 'condition' | 'delay', position: { x: number; y: number }) => void;
  onStepUpdate?: (stepId: string, updates: Partial<WorkflowStep>) => void;
  onStepDelete?: (stepId: string) => void;
  onStepConnect?: (fromStepId: string, toStepId: string) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  readOnly?: boolean;
}

export const WorkflowDiagram: React.FC<WorkflowDiagramProps> = ({
  steps,
  onStepAdd,
  onStepUpdate,
  onStepDelete,
  onStepConnect,
  zoom = 1,
  onZoomChange,
  readOnly = false
}) => {
  const [connectingFrom, setConnectingFrom] = React.useState<string | null>(null);

  const getStepIcon = (step: WorkflowStep) => {
    switch (step.type) {
      case 'trigger':
        return '⚡';
      case 'action':
        switch (step.action?.type) {
          case 'send_email':
            return '📧';
          case 'create_record':
            return '➕';
          case 'update_record':
            return '✏️';
          case 'code':
            return '</>';
          case 'http_request':
            return '🌐';
          case 'ai_agent':
            return '🤖';
          case 'delay':
            return '⏱️';
          default:
            return '▶️';
        }
      case 'condition':
        return '❓';
      case 'delay':
        return '⏰';
      default:
        return '⚙️';
    }
  };

  const getStepColor = (step: WorkflowStep) => {
    if (!step.isActive) return 'bg-gray-100 border-gray-300';

    switch (step.type) {
      case 'trigger':
        return 'bg-yellow-50 border-yellow-300';
      case 'action':
        return 'bg-blue-50 border-blue-300';
      case 'condition':
        return 'bg-purple-50 border-purple-300';
      case 'delay':
        return 'bg-orange-50 border-orange-300';
      default:
        return 'bg-gray-50 border-gray-300';
    }
  };

  const handleStepClick = (step: WorkflowStep) => {
    if (readOnly) return;

    if (connectingFrom) {
      if (connectingFrom !== step.id) {
        onStepConnect?.(connectingFrom, step.id);
      }
      setConnectingFrom(null);
    }
  };

  const renderConnectionLines = useMemo(() => {
    const lines: JSX.Element[] = [];

    steps.forEach(step => {
      step.connections.forEach(targetId => {
        const targetStep = steps.find(s => s.id === targetId);
        if (!targetStep) return;

        const startX = step.position.x + 80;
        const startY = step.position.y + 40;
        const endX = targetStep.position.x + 80;
        const endY = targetStep.position.y;

        lines.push(
          <line
            key={`${step.id}-${targetId}`}
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke="#6b7280"
            strokeWidth="2"
            markerEnd="url(#arrowhead)"
          />
        );
      });
    });

    return lines;
  }, [steps]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (readOnly) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    onStepAdd?.('action', { x, y });
  };

  return (
    <div className="relative bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
        <button
          onClick={() => onZoomChange?.(Math.max(0.5, zoom - 0.1))}
          className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[50px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => onZoomChange?.(Math.min(2, zoom + 0.1))}
          className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <button
          onClick={() => window.location.reload()}
          className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Reset view"
        >
          <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      <div
        className="relative h-[500px] overflow-auto"
        style={{
          backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          transform: `scale(${zoom})`,
          transformOrigin: 'top left'
        }}
        onClick={handleCanvasClick}
      >
        <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 1, minWidth: '100%', minHeight: '100%' }}>
          {renderConnectionLines}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#6b7280"
              />
            </marker>
          </defs>
        </svg>

        <div className="relative" style={{ minWidth: '100%', minHeight: '100%' }}>
          {steps.map((step) => (
            <div
              key={step.id}
              className={`absolute border-2 rounded-lg cursor-pointer transition-all w-40 ${getStepColor(step)} ${
                connectingFrom === step.id ? 'ring-2 ring-blue-500' : ''
              } ${!step.isActive ? 'opacity-50' : ''}`}
              style={{
                left: step.position.x,
                top: step.position.y,
              }}
              onClick={() => handleStepClick(step)}
            >
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">{getStepIcon(step)}</span>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize">
                    {step.type}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {step.name}
                </p>
                {step.action?.type && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">
                    {step.action.type.replace('_', ' ')}
                  </p>
                )}
              </div>

              {!readOnly && (
                <div className="absolute -top-2 -right-2 flex space-x-1 opacity-0 hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConnectingFrom(connectingFrom === step.id ? null : step.id);
                    }}
                    className={`p-1 rounded-full text-xs ${
                      connectingFrom === step.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                    title="Connect"
                  >
                    🔗
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStepDelete?.(step.id);
                    }}
                    className="p-1 rounded-full bg-red-100 hover:bg-red-200 text-red-600"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="absolute -top-2 -left-2 w-3 h-3 bg-gray-400 rounded-full border-2 border-white"></div>
              <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-gray-400 rounded-full border-2 border-white"></div>
            </div>
          ))}
        </div>
      </div>

      {connectingFrom && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
          Click a step to connect or click elsewhere to cancel
        </div>
      )}
    </div>
  );
};

export default WorkflowDiagram;