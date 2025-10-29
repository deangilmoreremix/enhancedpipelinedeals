import React from 'react';
import { Clock, CheckCircle } from 'lucide-react';

interface DealJourneyTimelineProps {
  dealId: string;
}

export const DealJourneyTimeline: React.FC<DealJourneyTimelineProps> = ({ dealId }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
        <Clock className="w-5 h-5" />
        <span>Deal Journey</span>
      </h3>
      <div className="space-y-3">
        <div className="flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Deal created</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Initial contact established</p>
          </div>
        </div>
      </div>
    </div>
  );
};
