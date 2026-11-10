import React, { useMemo } from 'react';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import KPIWidgets from '../components/deals/KPIWidgets';
import WeightedPipelineTotal from '../components/deals/WeightedPipelineTotal';
import SLAIndicator from '../components/deals/SLAIndicator';
import { PageContainer, PageHeader } from './PageHeader';
import { useDeals } from './hooks';

const HOUR = 3600 * 1000;

const AnalyticsPage: React.FC = () => {
  const { deals } = useDeals();
  const dealList = useMemo(() => Object.values(deals), [deals]);

  // SLA derived from each open deal's own created -> due window
  const slaDeals = useMemo(() => {
    const now = Date.now();
    return dealList
      .filter(d => d.dueDate && !d.stage.startsWith('closed'))
      .slice(0, 6)
      .map(d => {
        const start = new Date(d.createdAt).getTime();
        const due = new Date(d.dueDate as Date).getTime();
        const target = Math.max(1, Math.round((due - start) / HOUR));
        const elapsed = Math.max(0, Math.round((now - start) / HOUR));
        const status: 'on-track' | 'at-risk' | 'breached' =
          elapsed >= target ? 'breached' : elapsed >= target * 0.8 ? 'at-risk' : 'on-track';
        return { deal: d, target, elapsed, status };
      });
  }, [dealList]);

  return (
    <PageContainer>
      <PageHeader title="Analytics" subtitle="Pipeline performance, forecasts and KPIs" />
      <div className="space-y-8">
        <KPIWidgets deals={deals} />
        <WeightedPipelineTotal deals={dealList} showBreakdown />
        {slaDeals.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold mb-3">Deal SLAs</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {slaDeals.map(({ deal, target, elapsed, status }) => (
                <SLAIndicator
                  key={deal.id}
                  dealId={deal.id}
                  slaTargetHours={target}
                  elapsedHours={elapsed}
                  status={status}
                  lastUpdated={new Date(deal.updatedAt)}
                  compact
                />
              ))}
            </div>
          </section>
        )}
        <AnalyticsDashboard />
      </div>
    </PageContainer>
  );
};

export default AnalyticsPage;
