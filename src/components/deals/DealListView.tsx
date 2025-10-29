import React from 'react';
import { Deal } from '../../types';

interface DealListViewProps {
  deals: Deal[];
  onDealClick?: (deal: Deal) => void;
}

export const DealListView: React.FC<DealListViewProps> = ({ deals, onDealClick }) => {
  return (
    <div className="space-y-2">
      {deals.map((deal) => (
        <div
          key={deal.id}
          onClick={() => onDealClick?.(deal)}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
        >
          <h3 className="font-semibold text-gray-900 dark:text-white">{deal.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{deal.company}</p>
        </div>
      ))}
    </div>
  );
};
