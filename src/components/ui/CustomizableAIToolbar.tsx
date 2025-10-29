import React from 'react';
import { Brain, Target, Sparkles } from 'lucide-react';

interface CustomizableAIToolbarProps {
  onAction?: (action: string) => void;
  className?: string;
}

export const CustomizableAIToolbar: React.FC<CustomizableAIToolbarProps> = ({
  onAction,
  className = ''
}) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <button
        onClick={() => onAction?.('analyze')}
        className="p-2 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/60 transition-colors"
        title="AI Analysis"
      >
        <Brain className="w-4 h-4" />
      </button>
      <button
        onClick={() => onAction?.('enhance')}
        className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/60 transition-colors"
        title="Enhance with AI"
      >
        <Sparkles className="w-4 h-4" />
      </button>
    </div>
  );
};

interface AIGoalsButtonProps {
  onClick?: () => void;
  className?: string;
}

export const AIGoalsButton: React.FC<AIGoalsButtonProps> = ({
  onClick,
  className = ''
}) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors ${className}`}
    >
      <Target className="w-4 h-4" />
      <span className="text-sm font-medium">AI Goals</span>
    </button>
  );
};
