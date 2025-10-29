import React from 'react';
import { Search, Loader2 } from 'lucide-react';

interface AIResearchButtonProps {
  onClick?: () => void;
  isLoading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const AIResearchButton: React.FC<AIResearchButtonProps> = ({
  onClick,
  isLoading = false,
  className = '',
  children = 'AI Research'
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Search className="w-4 h-4" />
      )}
      <span className="text-sm font-medium">{children}</span>
    </button>
  );
};
