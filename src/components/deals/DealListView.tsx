import React from 'react';
import { Deal } from '../../types';
import { DollarSign, TrendingUp } from 'lucide-react';

interface DealListViewProps {
  deals: Record<string, Deal>;
  onDealClick: (dealId: string) => void;
  onDealUpdate: (id: string, updates: Partial<Deal>) => void;
  searchTerm: string;
  filterStage: string;
}

export const DealListView: React.FC<DealListViewProps> = ({ deals, onDealClick }) => {
  const dealsList = Object.values(deals);

  return (
    <div className="space-y-2">
      {dealsList.map((deal) => (
        <div
          key={deal.id}
          onClick={() => onDealClick(deal.id)}
          className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">{deal.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{deal.company}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                <DollarSign className="w-4 h-4" />
                {deal.value.toLocaleString()}
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <TrendingUp className="w-3 h-3 mr-1" />
                {deal.probability}%
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
