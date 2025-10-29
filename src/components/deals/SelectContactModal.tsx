import React from 'react';
import { X, Search } from 'lucide-react';

interface SelectContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (contactId: string) => void;
}

export const SelectContactModal: React.FC<SelectContactModalProps> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full">
        <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Select Contact</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-400">Contact selection coming soon...</p>
        </div>
      </div>
    </div>
  );
};
