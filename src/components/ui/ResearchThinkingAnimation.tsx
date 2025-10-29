import React from 'react';
import { Brain, Loader2 } from 'lucide-react';

interface ResearchThinkingAnimationProps {
  message?: string;
  progress?: number;
}

export const ResearchThinkingAnimation: React.FC<ResearchThinkingAnimationProps> = ({
  message = 'Researching...',
  progress
}) => {
  return (
    <div className="flex items-center space-x-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
      <Loader2 className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-spin" />
      <div className="flex-1">
        <p className="text-sm font-medium text-purple-900 dark:text-purple-100">{message}</p>
        {progress !== undefined && (
          <div className="mt-2">
            <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2">
              <div
                className="bg-purple-600 dark:bg-purple-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface ResearchStatusOverlayProps {
  isVisible: boolean;
  status: string;
  progress?: number;
}

export const ResearchStatusOverlay: React.FC<ResearchStatusOverlayProps> = ({
  isVisible,
  status,
  progress
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center space-x-3 mb-4">
          <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Research</h3>
        </div>
        <ResearchThinkingAnimation message={status} progress={progress} />
      </div>
    </div>
  );
};
