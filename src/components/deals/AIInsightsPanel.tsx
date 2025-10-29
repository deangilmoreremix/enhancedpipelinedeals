import React from 'react';
import { Brain, TrendingUp, AlertTriangle, CheckCircle, Sparkles } from 'lucide-react';
import { Deal } from '../../types';

interface AIInsightsPanelProps {
  deal: Deal;
}

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ deal }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI-Generated Insights</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Intelligent analysis for {deal.title}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-900 dark:text-green-300 mb-1">Strong Indicators</h4>
                <p className="text-sm text-green-800 dark:text-green-400">
                  Deal is showing positive momentum with {deal.probability}% probability. Recent activity suggests strong engagement.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-1">Growth Opportunity</h4>
                <p className="text-sm text-blue-800 dark:text-blue-400">
                  Based on similar deals, this opportunity has potential for upselling additional services.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900 dark:text-yellow-300 mb-1">Action Required</h4>
                <p className="text-sm text-yellow-800 dark:text-yellow-400">
                  Follow-up recommended within 48 hours to maintain momentum and address any potential concerns.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-purple-900 dark:text-purple-300 mb-1">AI Recommendation</h4>
                <p className="text-sm text-purple-800 dark:text-purple-400">
                  Consider scheduling a product demo to showcase key features that align with {deal.company}'s needs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
