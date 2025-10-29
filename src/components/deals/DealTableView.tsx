import React from 'react';
import { Deal } from '../../types';

interface DealTableViewProps {
  deals: Deal[];
  onDealClick?: (deal: Deal) => void;
}

export const DealTableView: React.FC<DealTableViewProps> = ({ deals, onDealClick }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Title</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Company</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Value</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Stage</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {deals.map((deal) => (
            <tr
              key={deal.id}
              onClick={() => onDealClick?.(deal)}
              className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{deal.title}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{deal.company}</td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">${deal.value.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{deal.stage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
