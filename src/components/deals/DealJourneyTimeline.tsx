import React from 'react';
import { Clock, CheckCircle, Circle, ArrowRight } from 'lucide-react';
import { Deal } from '../../types';

interface DealJourneyTimelineProps {
  deal: Deal;
}

export const DealJourneyTimeline: React.FC<DealJourneyTimelineProps> = ({ deal }) => {
  const stages = [
    { id: 'qualification', label: 'Qualification', status: 'completed' },
    { id: 'proposal', label: 'Proposal', status: deal.stage === 'qualification' ? 'pending' : 'completed' },
    { id: 'negotiation', label: 'Negotiation', status: ['qualification', 'proposal'].includes(deal.stage) ? 'pending' : 'completed' },
    { id: 'closed-won', label: 'Closed Won', status: deal.stage === 'closed-won' ? 'completed' : 'pending' },
  ];

  const currentStageIndex = stages.findIndex(s => s.id === deal.stage);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Deal Journey</h3>

        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

          <div className="space-y-6">
            {stages.map((stage, index) => {
              const isCompleted = index <= currentStageIndex;
              const isCurrent = stage.id === deal.stage;

              return (
                <div key={stage.id} className="relative flex items-start space-x-4">
                  <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${
                    isCompleted
                      ? 'bg-green-100 dark:bg-green-900/30 border-green-500 dark:border-green-600'
                      : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>

                  <div className="flex-1 pt-2">
                    <div className={`p-4 rounded-lg border ${
                      isCurrent
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : isCompleted
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className={`font-medium ${
                          isCurrent
                            ? 'text-blue-900 dark:text-blue-300'
                            : isCompleted
                            ? 'text-green-900 dark:text-green-300'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {stage.label}
                        </h4>
                        {isCurrent && (
                          <span className="px-2 py-1 bg-blue-600 dark:bg-blue-700 text-white text-xs rounded-full">
                            Current Stage
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${
                        isCurrent
                          ? 'text-blue-700 dark:text-blue-400'
                          : isCompleted
                          ? 'text-green-700 dark:text-green-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {isCompleted
                          ? `Completed ${index === currentStageIndex ? 'on ' + new Date().toLocaleDateString() : ''}`
                          : 'Not yet started'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <h4 className="font-medium text-gray-900 dark:text-white">Timeline Summary</h4>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Deal created on {deal.createdAt.toLocaleDateString()}. Currently in {deal.stage.replace('-', ' ')} stage.
            {deal.dueDate && ` Expected close date: ${deal.dueDate.toLocaleDateString()}.`}
          </p>
        </div>
      </div>
    </div>
  );
};
