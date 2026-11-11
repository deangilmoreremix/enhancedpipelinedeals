import React, { useMemo, useState } from 'react';
import { Deal } from '../types';
import { useStageMeta } from '../utils/stageUtils';
import { stageColorClasses } from '../utils/stageMeta';
import { formatMoneyCompact, totalsOf } from '../utils/viewDeals';
import { useViewSelection } from '../hooks/useViewSelection';
import { BulkActionBar } from './pipeline/BulkActionBar';
import { useViewToasts } from './pipeline/ViewToasts';
import {
  Clock, DollarSign, TrendingUp, Building2, User, Star,
  Calendar, Sparkles, CheckCircle, XCircle,
  ArrowRight, Filter
} from 'lucide-react';

export interface DealTimelineViewProps {
  /** Filtered AND sorted deals (Pipeline's single `viewDeals`). */
  deals: Deal[];
  onDealClick: (dealId: string) => void;
  onDealUpdate?: (dealId: string, updates: Partial<Deal>) => Promise<unknown> | void;
  isFiltered?: boolean;
}

export const DealTimelineView: React.FC<DealTimelineViewProps> = ({ deals, onDealClick, isFiltered = false }) => {
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const { meta } = useStageMeta();
  const { notify, toastsNode } = useViewToasts();

  const filteredAndGroupedDeals = useMemo(() => {
    let result = deals;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (timeFilter === 'today') {
      result = result.filter(deal => new Date(deal.updatedAt) >= today);
    } else if (timeFilter === 'week') {
      result = result.filter(deal => new Date(deal.updatedAt) >= weekAgo);
    } else if (timeFilter === 'month') {
      result = result.filter(deal => new Date(deal.updatedAt) >= monthAgo);
    }

    // Day groups are chronological (newest first); inside a day the shared view sort order is kept
    const dayOf = (d: Deal) => { const x = new Date(d.updatedAt); return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
    const days = new Map<number, Deal[]>();
    result.forEach(deal => {
      const k = dayOf(deal);
      days.set(k, [...(days.get(k) ?? []), deal]);
    });
    const grouped: { [key: string]: Deal[] } = {};
    [...days.entries()].sort((a, b) => b[0] - a[0]).forEach(([k, list]) => {
      grouped[new Date(k).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })] = list;
    });
    return grouped;
  }, [deals, timeFilter]);

  const visibleDeals = useMemo(() => Object.values(filteredAndGroupedDeals).flat(), [filteredAndGroupedDeals]);
  const visibleIds = useMemo(() => visibleDeals.map(d => d.id), [visibleDeals]);
  const sel = useViewSelection(visibleIds, { onOpen: onDealClick, notify });
  const totals = useMemo(() => totalsOf(visibleDeals), [visibleDeals]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStageIcon = (stage: string) => {
    const m = meta(stage);
    if (m.isWon) return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
    if (m.isLost) return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
    return <Clock className={`w-5 h-5 ${stageColorClasses(m.color).text}`} style={stageColorClasses(m.color).style ? { color: m.color } : undefined} />;
  };

  const getStageColor = (stage: string) => {
    const c = stageColorClasses(meta(stage).color);
    return `${c.borderLeft} ${c.bg}`;
  };

  const getStageName = (stage: string) => meta(stage).name;

  const totalDeals = visibleDeals.length;

  if (totalDeals === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-gray-400 dark:text-gray-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No activity found</h3>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
          {isFiltered || timeFilter !== 'all'
            ? 'Try adjusting your filters to see more activity'
            : 'Deal activities will appear here as you work'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Time Period:</span>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['all', 'today', 'week', 'month'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  timeFilter === filter
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          {totalDeals} event{totalDeals !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

        <div className="space-y-8">
          {Object.entries(filteredAndGroupedDeals).map(([date, dateDeals]) => (
            <div key={date} className="relative">
              <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 py-2 mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full border-4 border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-sm">
                    <Calendar className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {date}
                  </h3>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    ({dateDeals.length} event{dateDeals.length !== 1 ? 's' : ''})
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                {dateDeals.map((deal, index) => (
                  <div key={deal.id} className="relative pl-20">
                    <div className="absolute left-0 w-16 h-16 bg-white dark:bg-gray-800 rounded-full border-4 border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-sm">
                      {getStageIcon(deal.stage)}
                    </div>

                    <div
                      data-deal-id={deal.id}
                      aria-selected={sel.selected.has(deal.id)}
                      onClick={() => onDealClick(deal.id)}
                      style={stageColorClasses(meta(deal.stage).color).styleAccent}
                      className={`border-l-4 rounded-lg p-4 cursor-pointer hover:shadow-lg transition-all ${getStageColor(deal.stage)} ${
                        sel.selected.has(deal.id) ? 'ring-2 ring-blue-500' : sel.focusedId === deal.id ? 'ring-2 ring-blue-300' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <input
                              type="checkbox"
                              aria-label={`Select ${deal.title ?? deal.company}`}
                              checked={sel.selected.has(deal.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => sel.select(deal.id, { shiftKey: (e.nativeEvent as MouseEvent).shiftKey })}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                            />
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {deal.title}
                            </h4>
                            {deal.isFavorite && (
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            )}
                            {deal.aiScore && deal.aiScore > 0 && (
                              <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full">
                                <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                                  {deal.aiScore}
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center space-x-2">
                            <span>Moved to</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {getStageName(deal.stage)}
                            </span>
                            <ArrowRight className="w-4 h-4" />
                            <span className="text-gray-500 dark:text-gray-500">
                              {formatTime(deal.updatedAt)}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-gray-500 dark:text-gray-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{deal.company}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-gray-500 dark:text-gray-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{deal.contact}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(deal.value)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="w-4 h-4 text-gray-500 dark:text-gray-500" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {deal.probability}% probability
                          </span>
                        </div>

                        {deal.notes && (
                          <div className="flex-1 text-sm text-gray-600 dark:text-gray-400 truncate">
                            {deal.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" data-testid="timeline-footer">
        <span className="text-sm text-gray-600 dark:text-gray-400">{totals.count} deal{totals.count !== 1 ? 's' : ''}</span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">Total: {formatMoneyCompact(totals.sum)}</span>
      </div>

      <BulkActionBar onNotify={notify} />
      {toastsNode}
    </div>
  );
};
