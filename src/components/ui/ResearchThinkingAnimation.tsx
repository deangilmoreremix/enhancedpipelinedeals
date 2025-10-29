import React, { useState, useEffect } from 'react';
import { Brain, Search, BarChart3, Sparkles, CheckCircle, Loader2 } from 'lucide-react';

interface ResearchThinkingAnimationProps {
  currentStage: 'researching' | 'analyzing' | 'synthesizing' | 'optimizing' | 'complete';
  progress: number; // 0-100
  message?: string;
  showCitations?: boolean;
  citationCount?: number;
  onStageComplete?: (stage: string) => void;
}

const stageConfig = {
  researching: {
    icon: Search,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Researching',
    description: 'Gathering information from web sources'
  },
  analyzing: {
    icon: BarChart3,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    label: 'Analyzing',
    description: 'Processing and analyzing data patterns'
  },
  synthesizing: {
    icon: Brain,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    label: 'Synthesizing',
    description: 'Combining insights into coherent analysis'
  },
  optimizing: {
    icon: Sparkles,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    label: 'Optimizing',
    description: 'Refining results for maximum impact'
  },
  complete: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Complete',
    description: 'Research analysis finished'
  }
};

export const ResearchThinkingAnimation: React.FC<ResearchThinkingAnimationProps> = ({
  currentStage,
  progress,
  message,
  showCitations = false,
  citationCount = 0,
  onStageComplete
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(message || '');

  useEffect(() => {
    // Animate progress bar
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 100);

    return () => clearTimeout(timer);
  }, [progress]);

  useEffect(() => {
    if (message) {
      setCurrentMessage(message);
    } else {
      // Set default messages based on stage
      const defaultMessages = {
        researching: 'Searching through web sources and gathering relevant information...',
        analyzing: 'Analyzing data patterns and extracting key insights...',
        synthesizing: 'Combining multiple sources into comprehensive analysis...',
        optimizing: 'Refining results and optimizing for actionable recommendations...',
        complete: 'Research analysis completed successfully!'
      };
      setCurrentMessage(defaultMessages[currentStage]);
    }
  }, [currentStage, message]);

  const config = stageConfig[currentStage];
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border-2 p-6 transition-all duration-500 ${config.bgColor} ${config.borderColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${config.color} bg-white shadow-sm`}>
            {currentStage === 'complete' ? (
              <Icon className="w-6 h-6" />
            ) : (
              <Loader2 className="w-6 h-6 animate-spin" />
            )}
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${config.color}`}>{config.label}</h3>
            <p className="text-sm text-gray-600">{config.description}</p>
          </div>
        </div>

        {/* Citation Count */}
        {showCitations && citationCount > 0 && (
          <div className="flex items-center space-x-2 bg-white px-3 py-1 rounded-full shadow-sm">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-700">{citationCount} sources</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm font-bold text-gray-900">{Math.round(animatedProgress)}%</span>
        </div>
        <div className="w-full bg-white rounded-full h-3 shadow-inner">
          <div
            className={`h-3 rounded-full transition-all duration-1000 ease-out ${config.color.replace('text-', 'bg-')}`}
            style={{ width: `${animatedProgress}%` }}
          />
        </div>
      </div>

      {/* Current Message */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <p className="text-sm text-gray-700 leading-relaxed">{currentMessage}</p>
      </div>

      {/* Stage Indicators */}
      <div className="mt-6 flex justify-between">
        {Object.entries(stageConfig).map(([stage, stageInfo], index) => {
          const StageIcon = stageInfo.icon;
          const isActive = stage === currentStage;
          const isCompleted = Object.keys(stageConfig).indexOf(stage) < Object.keys(stageConfig).indexOf(currentStage);
          const isUpcoming = Object.keys(stageConfig).indexOf(stage) > Object.keys(stageConfig).indexOf(currentStage);

          return (
            <div key={stage} className="flex flex-col items-center space-y-2">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                ${isCompleted ? 'bg-green-500 text-white shadow-lg' :
                  isActive ? `${stageInfo.color} bg-white shadow-lg ring-2 ring-offset-2 ring-blue-500` :
                  isUpcoming ? 'bg-gray-200 text-gray-400' : 'bg-gray-200 text-gray-400'}
              `}>
                <StageIcon className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium text-center ${
                isActive ? config.color : isCompleted ? 'text-green-600' : 'text-gray-400'
              }`}>
                {stageInfo.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ResearchStatusOverlayProps {
  isVisible: boolean;
  currentStage: 'researching' | 'analyzing' | 'synthesizing' | 'optimizing' | 'complete';
  progress: number;
  message?: string;
  citationCount?: number;
  elapsedTime?: number; // in seconds
  estimatedTimeRemaining?: number; // in seconds
  onCancel?: () => void;
  onMinimize?: () => void;
}

export const ResearchStatusOverlay: React.FC<ResearchStatusOverlayProps> = ({
  isVisible,
  currentStage,
  progress,
  message,
  citationCount = 0,
  elapsedTime = 0,
  estimatedTimeRemaining,
  onCancel,
  onMinimize
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isVisible) return null;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span className="text-sm font-medium text-gray-700">
            Research in progress... {Math.round(progress)}%
          </span>
          <button
            onClick={() => setIsMinimized(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            ↗
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">AI Research in Progress</h2>
            <div className="flex space-x-2">
              {onMinimize && (
                <button
                  onClick={() => setIsMinimized(true)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  title="Minimize"
                >
                  ↙
                </button>
              )}
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="text-gray-400 hover:text-red-600 p-1"
                  title="Cancel research"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <ResearchThinkingAnimation
            currentStage={currentStage}
            progress={progress}
            message={message}
            showCitations={true}
            citationCount={citationCount}
          />

          {/* Time Information */}
          {(elapsedTime > 0 || estimatedTimeRemaining) && (
            <div className="mt-4 bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Elapsed:</span>
                <span className="font-medium">{formatTime(elapsedTime)}</span>
              </div>
              {estimatedTimeRemaining && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-600">Remaining:</span>
                  <span className="font-medium">{formatTime(estimatedTimeRemaining)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};