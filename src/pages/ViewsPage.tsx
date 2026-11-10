import React, { useEffect, useState } from 'react';
import { ViewsReportingManager } from '../components/views/ViewsReportingManager';
import { ViewPickerDropdown } from '../components/views/ViewPickerDropdown';
import { FilterChipsContainer } from '../components/views/FilterChip';
import type { FilterCondition } from '../components/ui/AdvancedFilter';
import { getAllViews, deleteView, SavedPipelineView } from '../services/savedPipelineViewService';
import { useDealStore } from '../store/dealStore';
import { useCurrentUserId, useDeals } from './hooks';
import { PageContainer, PageHeader } from './PageHeader';

const ViewsPage: React.FC = () => {
  const { deals } = useDeals();
  const updateDeal = useDealStore(s => s.updateDeal);
  const selectDeal = useDealStore(s => s.selectDeal);
  const selected = useDealStore(s => s.selectedDeal);
  const userId = useCurrentUserId();
  const [views, setViews] = useState<SavedPipelineView[]>([]);
  const [currentView, setCurrentView] = useState<SavedPipelineView | null>(null);

  useEffect(() => {
    getAllViews().then(setViews).catch(() => setViews([]));
  }, []);

  const handleDelete = async (id: string) => {
    if (await deleteView(id)) {
      setViews(v => v.filter(x => x.id !== id));
      setCurrentView(cv => (cv?.id === id ? null : cv));
    }
  };

  const chips: FilterCondition[] = Array.isArray(currentView?.filters) ? (currentView?.filters as FilterCondition[]) : [];

  return (
    <PageContainer>
      <PageHeader
        title="Views"
        subtitle="Saved views, filters and reports"
        actions={
          <ViewPickerDropdown
            views={views}
            currentView={currentView}
            onViewSelect={setCurrentView}
            onViewDelete={handleDelete}
          />
        }
      />
      {chips.length > 0 && (
        <div className="mb-4">
          <FilterChipsContainer
            filters={chips}
            onRemove={f => setCurrentView(cv => cv && { ...cv, filters: chips.filter(c => c !== f) })}
          />
        </div>
      )}
      {selected && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm flex justify-between">
          <span>Selected deal: <strong>{selected.title || selected.company}</strong> ({selected.stage})</span>
          <button className="text-blue-600 dark:text-blue-400" onClick={() => selectDeal(null)}>Clear</button>
        </div>
      )}
      <ViewsReportingManager
        deals={deals}
        currentUserId={userId || undefined}
        onDealClick={id => selectDeal(deals[id] ?? null)}
        onDealUpdate={(id, updates) => { void updateDeal(id, updates); }}
      />
    </PageContainer>
  );
};

export default ViewsPage;
