import React from 'react';
import { Deal } from '../../types';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface DealCardInsightsProps {
  deal: Deal;
  onFeedback?: (e: React.MouseEvent, feedbackType: 'positive' | 'negative') => void;
}

export const DealCardInsights: React.FC<DealCardInsightsProps> = ({
  deal,
  onFeedback
}) => {
  // Mock AI insights for the deal
  const insights = [
    `Based on ${deal.company}'s industry and deal size, there's a ${deal.probability > 70 ? 'high' : 'moderate'} likelihood of conversion.`,
    `Similar deals in this stage typically close within ${deal.stage === 'qualification' ? '2-4 weeks' : deal.stage === 'proposal' ? '1-2 weeks' : '3-5 days'}.`,
    `The ${deal.priority} priority suggests ${deal.priority === 'high' ? 'immediate attention needed' : deal.priority === 'medium' ? 'regular follow-up required' : 'monitor for changes'}.`
  ];

  return (
    <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-300 flex items-center">
          <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
          AI Insights
        </h4>
        {onFeedback && (
          <div className="flex space-x-1">
            <button
              onClick={(e) => onFeedback(e, 'positive')}
              className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
              title="Helpful insight"
            >
              <ThumbsUp className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => onFeedback(e, 'negative')}
              className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Not helpful"
            >
              <ThumbsDown className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {insights.map((insight, index) => (
          <div key={index} className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
            • {insight}
          </div>
        ))}
      </div>

      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
        Last updated: {new Date().toLocaleDateString()}
      </div>
    </div>
  );
};