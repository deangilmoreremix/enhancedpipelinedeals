import React from 'react';
import { Heart, HeartOff, Share2, Save, X } from 'lucide-react';
import { ModernButton } from '../ui/ModernButton';
import { SDRButtonGroup } from './SDRButtonGroup';
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
  onAction,
  onRunSDRAgent,
  isRunningSDR = false
}) => {
  // Determine relevant SDR agents based on deal context
  const getRelevantSDRAgents = () => {
    const agents = [];

    // Competitor-aware SDR if deal mentions competitors
    if (deal.notes?.toLowerCase().includes('competitor') ||
        linkedContact?.notes?.toLowerCase().includes('competitor')) {
      agents.push('sdr-competitor-aware');
    }

    // Objection-handling SDR for negotiation stage
    if (deal.stage === 'negotiation') {
      agents.push('sdr-objection-handling');
    }

    // Data-enrichment SDR if contact data is incomplete
    if (!linkedContact?.industry) {
      agents.push('sdr-data-enrichment');
    }

    // Follow-up SDR if deal is stale (last activity > 7 days)
    const lastActivity = deal.updatedAt ? new Date(deal.updatedAt) : new Date(deal.createdAt);
    const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity > 7) {
      agents.push('sdr-follow-up');
    }

    // High-intent SDR for proposal stage
    if (deal.stage === 'proposal') {
      agents.push('sdr-high-intent');
    }

    return agents;
  };

  const relevantAgents = getRelevantSDRAgents();
  return (
    <div className="space-y-3 p-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="flex items-center space-x-3">
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

      {/* Smart SDR Actions */}
      {relevantAgents.length > 0 && onRunSDRAgent && (
        <SDRButtonGroup
          relevantAgents={relevantAgents}
          onRunSDRAgent={onRunSDRAgent}
          isRunning={isRunningSDR}
        />
      )}
    </div>
  );
};