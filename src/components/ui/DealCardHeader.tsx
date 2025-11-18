import React from 'react';
import { Deal } from '../../types';
import { Edit, Camera, Heart, HeartOff, Brain, Loader2, Trash2, MoreHorizontal } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface DealCardHeaderProps {
  deal: Deal;
  onEdit?: (deal: Deal) => void;
  onDelete?: (dealId: string) => void;
  onToggleFavorite?: (deal: Deal) => Promise<void>;
  onFindNewImage?: (deal: Deal) => Promise<void>;
  onAnalyze?: (deal: Deal) => Promise<boolean>;
  isAnalyzing?: boolean;
  isFinding?: boolean;
}

export const DealCardHeader: React.FC<DealCardHeaderProps> = ({
  deal,
  onEdit,
  onDelete,
  onToggleFavorite,
  onFindNewImage,
  onAnalyze,
  isAnalyzing = false,
  isFinding = false
}) => {
  return (
    <div className="absolute top-4 right-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
      {/* AI Analysis Button */}
      {onAnalyze && (
        <Tooltip content={deal.probability > 70 ? 'Re-analyze with AI - Update win probability and insights' : 'AI Analysis - Generate win probability and strategic insights'} position="bottom">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAnalyze(deal);
            }}
            disabled={isAnalyzing}
            className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors disabled:opacity-50 relative"
          >
            {isAnalyzing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Brain className="w-3 h-3" />
            )}
          </button>
        </Tooltip>
      )}

      {/* Favorite Button */}
      {onToggleFavorite && (
        <Tooltip content={deal.isFavorite ? 'Remove from Favorites - Unmark this deal' : 'Add to Favorites - Quick access to important deals'} position="bottom">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(deal);
            }}
            className={`p-2 rounded-lg transition-colors ${
              deal.isFavorite
                ? 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-700'
                : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
            }`}
          >
            {deal.isFavorite ? <Heart className="w-3 h-3 fill-current" /> : <HeartOff className="w-3 h-3" />}
          </button>
        </Tooltip>
      )}

      {/* Edit Button */}
      {onEdit && (
        <Tooltip content="Edit Deal - Modify deal details, stage, and notes" position="bottom">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(deal);
            }}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-500 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            <Edit className="w-3 h-3" />
          </button>
        </Tooltip>
      )}

      {/* Delete Button */}
      {onDelete && (
        <Tooltip content="Delete Deal - Permanently remove this deal" position="bottom">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Are you sure you want to delete this deal?')) {
                onDelete(deal.id);
              }
            }}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </Tooltip>
      )}
    </div>
  );
};