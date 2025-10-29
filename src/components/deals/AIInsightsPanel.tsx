import React from 'react';
import { Brain, Sparkles } from 'lucide-react';

interface AIInsightsPanelProps {
  dealId: string;
}

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ dealId }) => {
  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-6 rounded-lg border border-purple-200 dark:border-purple-800">
      <div className="flex items-center space-x-2 mb-4">
        <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Insights</h3>
        <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
      </div>
      <p className="text-gray-600 dark:text-gray-400">AI insights for deal {dealId} coming soon...</p>
    </div>
  );
};
