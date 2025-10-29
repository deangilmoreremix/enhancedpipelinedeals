import React from 'react';
import { DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { Deal } from '../../types';

interface DealCardProps {
  deal: Deal;
  onClick: () => void;
}

export const DealCard: React.FC<DealCardProps> = ({ deal, onClick }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{deal.title}</h3>
        {deal.companyAvatar && (
          <img
            src={deal.companyAvatar}
            alt={deal.company}
            className="w-8 h-8 rounded-full"
          />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
          <DollarSign className="w-3 h-3 mr-1" />
          {formatCurrency(deal.value)}
        </div>

        <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
          <TrendingUp className="w-3 h-3 mr-1" />
          {deal.probability}% probability
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-500">
          {deal.company}
        </div>
      </div>
    </div>
  );
};
