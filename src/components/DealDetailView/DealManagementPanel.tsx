import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Deal } from '../../types';
import { isFeatureEnabled } from '../../services/featureFlagService';
import { DealHealthService } from '../../services/dealHealthService';
import { DealProbabilityService } from '../../services/dealProbabilityService';
import DealHealthIndicator from '../deals/DealHealthIndicator';
import WinProbabilityCalculator from '../deals/WinProbabilityCalculator';
import DealTimeline from '../deals/DealTimeline';
import DealTemplates from '../deals/DealTemplates';
import { pushToast } from '../../store/dealRecordStore';

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
  const navigate = useNavigate();
  const [featuresEnabled, setFeaturesEnabled] = useState({
    deal_health: false,
    win_probability: false,
    deal_templates: false,
    deal_timeline: false
  });

  useEffect(() => {
    let alive = true;
    void Promise.all([
      isFeatureEnabled('deal_health_indicators'),
      isFeatureEnabled('win_probability_calculator'),
      isFeatureEnabled('deal_templates_phase3'),
      isFeatureEnabled('deal_timeline')
    ]).then(([dealHealth, winProbability, dealTemplates, dealTimeline]) => {
      if (alive) setFeaturesEnabled({ deal_health: dealHealth, win_probability: winProbability, deal_templates: dealTemplates, deal_timeline: dealTimeline });
    });
    return () => { alive = false; };
  }, []);

  // Scores are computed from the deal itself (stage, age, value, close date); a refresh recomputes and stores them.
  const healthFactors = deal.healthFactors?.length ? deal.healthFactors : DealHealthService.analyzeHealthFactors(deal);
  const healthScore = deal.healthScore ?? DealHealthService.calculateHealthScore(deal);
  const probabilityFactors = deal.probabilityFactors?.length ? deal.probabilityFactors : DealProbabilityService.analyzeProbabilityFactors(deal);
  const winProbability = deal.winProbability ?? DealProbabilityService.calculateWinProbability(deal);

  const handleHealthRefresh = async () => {
    try {
      await onUpdate(deal.id, {
        healthScore: DealHealthService.calculateHealthScore(deal),
        healthFactors: DealHealthService.analyzeHealthFactors(deal)
      });
      pushToast('success', 'Deal health recalculated');
    } catch (error) {
      pushToast('error', error instanceof Error ? `Could not refresh deal health: ${error.message}` : 'Could not refresh deal health');
    }
  };

  const handleProbabilityRefresh = async () => {
    try {
      await onUpdate(deal.id, {
        winProbability: DealProbabilityService.calculateWinProbability(deal),
        probabilityFactors: DealProbabilityService.analyzeProbabilityFactors(deal)
      });
      pushToast('success', 'Win probability recalculated');
    } catch (error) {
      pushToast('error', error instanceof Error ? `Could not refresh win probability: ${error.message}` : 'Could not refresh win probability');
    }
  };

  const handleTemplateApplied = (newDeal: Deal) => {
    pushToast('success', `Created "${newDeal.title ?? newDeal.company}" from the template`);
    navigate(`/deals/${newDeal.id}`);
  };

  if (!Object.values(featuresEnabled).some(enabled => enabled)) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No management tools are enabled for this workspace.</p>
        <p className="text-sm mt-2">An administrator can turn them on with the deal_health_indicators, win_probability_calculator, deal_templates_phase3 and deal_timeline feature flags.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Deal Health Indicators */}
      {featuresEnabled.deal_health && (
        <DealHealthIndicator
          healthScore={healthScore}
          healthFactors={healthFactors}
          onRefresh={handleHealthRefresh}
        />
      )}

      {/* Win Probability Calculator */}
      {featuresEnabled.win_probability && (
        <WinProbabilityCalculator
          winProbability={winProbability}
          probabilityFactors={probabilityFactors}
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