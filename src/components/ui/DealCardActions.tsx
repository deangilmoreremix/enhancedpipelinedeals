import React from 'react';
import { Deal } from '../../types';
import { Mail, Phone } from 'lucide-react';

interface DealCardActionsProps {
  deal: Deal;
  onEmail?: (e: React.MouseEvent) => void;
  onCall?: (e: React.MouseEvent) => void;
  onView?: () => void;
}

export const DealCardActions: React.FC<DealCardActionsProps> = ({
  deal,
  onEmail,
  onCall,
  onView
}) => {
  return (
    <div className="flex justify-center space-x-2 mt-4">
      {onEmail && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEmail(e);
          }}
          className="flex items-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Mail size={11} className="mr-1" />
          <span>Email</span>
        </button>
      )}

      {onCall && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCall(e);
          }}
          className="flex items-center space-x-1 px-3 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Phone size={11} className="mr-1" />
          <span>Call</span>
        </button>
      )}

      {onView && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          className="px-3 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-800 text-white text-xs font-medium rounded-lg transition-colors"
        >
          View Details
        </button>
      )}
    </div>
  );
};