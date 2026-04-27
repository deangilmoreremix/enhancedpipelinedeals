import React, { useState, useEffect } from 'react';
import { Deal } from '../../types';
import { isFeatureEnabled } from '../../services/featureFlagService';
import { updateDealHealth } from '../../services/dealHealthService';
import { updateDealProbability } from '../../services/dealProbabilityService';
import DealHealthIndicator from '../deals/DealHealthIndicator';
import WinProbabilityCalculator from '../deals/WinProbabilityCalculator';
import DealTimeline from '../deals/DealTimeline';
import DealTemplates from '../deals/DealTemplates';
import BulkDealActions from '../deals/BulkDealActions';
import { BulkActionResult } from '../../types';

interface DealManagementPanelProps {
  deal: Deal;
  onUpdate: (id: string, updates: Partial<Deal>) => Promise<Deal>;
  linkedContactId?: string;
}

const DealManagementPanel: React.FC<DealManagementPanelProps> = ({
  deal,
  onUpdate,
  linkedContactId
}) => {
  const [featuresEnabled, setFeaturesEnabled] = useState({
    deal_health: false,
    win_probability: false,
    deal_templates: false,
    bulk_actions: false,
    deal_timeline: false
  });
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedDeals, setSelectedDeals] = useState<Deal[]>([deal]);

  useEffect(() => {
    checkFeatureFlags();
  }, []);

  const checkFeatureFlags = async () => {
    const [
      dealHealth,
      winProbability,
      dealTemplates,
      bulkActions,
      dealTimeline
    ] = await Promise.all([
      isFeatureEnabled('deal_health_indicators'),
      isFeatureEnabled('win_probability_calculator'),
      isFeatureEnabled('deal_templates_phase3'),
      isFeatureEnabled('bulk_deal_actions'),
      isFeatureEnabled('deal_timeline')
    ]);

    setFeaturesEnabled({
      deal_health: dealHealth,
      win_probability: winProbability,
      deal_templates: dealTemplates,
      bulk_actions: bulkActions,
      deal_timeline: dealTimeline
    });
  };

  const handleHealthRefresh = async () => {
    try {
      await updateDealHealth(deal.id);
      // Refresh the deal data
      await onUpdate(deal.id, {});
    } catch (error) {
      console.error('Error refreshing deal health:', error);
    }
  };

  const handleProbabilityRefresh = async () => {
    try {
      await updateDealProbability(deal.id);
      // Refresh the deal data
      await onUpdate(deal.id, {});
    } catch (error) {
      console.error('Error refreshing deal probability:', error);
    }
  };

  const handleBulkActionComplete = (results: BulkActionResult[]) => {
    setShowBulkActions(false);
    // Refresh deal data if this deal was affected
    const thisDealResult = results.find(r => r.dealId === deal.id);
    if (thisDealResult?.success) {
      onUpdate(deal.id, {});
    }
  };

  const handleTemplateApplied = (newDeal: Deal) => {
    // This would typically navigate to the new deal or update the current view
    console.log('Template applied, new deal:', newDeal);
  };

  if (!Object.values(featuresEnabled).some(enabled => enabled)) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Management features are not yet available.</p>
        <p className="text-sm mt-2">They will be enabled through feature flags when ready.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Deal Health Indicators */}
      {featuresEnabled.deal_health && (
        <DealHealthIndicator
          healthScore={deal.healthScore || 50}
          healthFactors={deal.healthFactors || []}
          onRefresh={handleHealthRefresh}
        />
      )}

      {/* Win Probability Calculator */}
      {featuresEnabled.win_probability && (
        <WinProbabilityCalculator
          winProbability={deal.winProbability || deal.probability || 50}
          probabilityFactors={deal.probabilityFactors || []}
          onRefresh={handleProbabilityRefresh}
        />
      )}

      {/* Deal Timeline */}
      {featuresEnabled.deal_timeline && (
        <DealTimeline
          dealId={deal.id}
          showFilters={true}
        />
      )}

      {/* Deal Templates */}
      {featuresEnabled.deal_templates && (
        <DealTemplates
          onTemplateApplied={handleTemplateApplied}
          contactId={linkedContactId}
          currentDeal={deal}
        />
      )}

      {/* Bulk Actions */}
      {featuresEnabled.bulk_actions && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Bulk Actions</h3>
            <button
              onClick={() => setShowBulkActions(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Open Bulk Actions
            </button>
          </div>
          <p className="text-sm text-gray-600">
            Perform bulk operations on multiple deals. This feature allows you to update stages,
            assign owners, add tags, and more across selected deals.
          </p>
        </div>
      )}

      {/* Bulk Actions Modal */}
      {showBulkActions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <BulkDealActions
            selectedDeals={selectedDeals}
            onActionComplete={handleBulkActionComplete}
            onClose={() => setShowBulkActions(false)}
          />
        </div>
      )}
    </div>
  );
};

export default DealManagementPanel;