import React, { useState, useEffect } from 'react';
import { Deal } from '../../types';
import { isFeatureEnabled } from '../../services/featureFlagService';
import { updateDealHealth } from '../../services/dealHealthService';
import { updateDealProbability } from '../../services/dealProbabilityService';
import DealHealthIndicator from '../deals/DealHealthIndicator';
import WinProbabilityCalculator from '../deals/WinProbabilityCalculator';
import DealTimeline from '../deals/DealTimeline';
import DealTemplates from '../deals/DealTemplates';

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
    deal_timeline: false
  });

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

    </div>
  );
};

export default DealManagementPanel;