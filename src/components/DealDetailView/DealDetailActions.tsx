import React from 'react';
import { Heart, HeartOff, Share2, Save, X } from 'lucide-react';
import { ModernButton } from '../ui/ModernButton';
import { DealDetailActionsProps } from './types';

export const DealDetailActions: React.FC<DealDetailActionsProps> = ({
  deal,
  linkedContact,
  isEditing,
  isSaving,
  onSave,
  onCancel,
  onToggleFavorite,
  onShare,
  onAction
}) => {
  return (
    <div className="flex items-center space-x-3 p-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <ModernButton
        variant={deal.isFavorite ? "primary" : "outline"}
        size="sm"
        onClick={onToggleFavorite}
        className="flex items-center space-x-2"
      >
        {deal.isFavorite ? <Heart className="w-4 h-4" /> : <HeartOff className="w-4 h-4" />}
        <span>{deal.isFavorite ? 'Favorited' : 'Add to Favorites'}</span>
      </ModernButton>

      <ModernButton
        variant="outline"
        size="sm"
        onClick={onShare}
        className="flex items-center space-x-2"
      >
        <Share2 className="w-4 h-4" />
        <span>Share Deal</span>
      </ModernButton>

      {isEditing ? (
        <div className="flex items-center space-x-2">
          <ModernButton
            variant="primary"
            size="sm"
            onClick={onSave}
            loading={isSaving}
            className="flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </ModernButton>
          <ModernButton
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="flex items-center space-x-2"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </ModernButton>
        </div>
      ) : (
        <ModernButton
          variant="primary"
          size="sm"
          onClick={() => onAction('edit')}
          className="flex items-center space-x-2"
        >
          <span>Edit Deal</span>
        </ModernButton>
      )}
    </div>
  );
};