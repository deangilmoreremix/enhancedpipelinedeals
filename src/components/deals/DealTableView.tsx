import React from 'react';
import { Deal } from '../../types';

interface DealTableViewProps {
  deals: Record<string, Deal>;
  onDealClick: (dealId: string) => void;
  onDealUpdate: (id: string, updates: Partial<Deal>) => void;
  searchTerm: string;
  filterStage: string;
}

export const DealTableView: React.FC<DealTableViewProps> = ({ deals, onDealClick }) => {
  const dealsList = Object.values(deals);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Title</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Company</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Value</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Stage</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Probability</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {dealsList.map((deal) => (
            <tr
              key={deal.id}
              onClick={() => onDealClick(deal.id)}
              className="hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{deal.title}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{deal.company}</td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">${deal.value.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 capitalize">{deal.stage.replace('-', ' ')}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{deal.probability}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
