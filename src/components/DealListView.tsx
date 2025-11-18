import React, { useMemo, useState } from 'react';
import { Deal } from '../types';
import {
  DollarSign, Calendar, TrendingUp, Building2, User,
  ChevronDown, ChevronUp, Star, Sparkles, ArrowUpDown
} from 'lucide-react';

interface DealListViewProps {
  deals: Record<string, Deal>;
  onDealClick: (dealId: string) => void;
  onDealUpdate: (dealId: string, updates: Partial<Deal>) => void;
  searchTerm: string;
  filterStage: string;
}

type SortField = 'value' | 'probability' | 'updated' | 'title' | 'company';
type SortOrder = 'asc' | 'desc';

export const DealListView: React.FC<DealListViewProps> = ({
  deals,
  onDealClick,
  onDealUpdate,
  searchTerm,
  filterStage
}) => {
  const [sortField, setSortField] = useState<SortField>('updated');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const filteredAndSortedDeals = useMemo(() => {
    let result = Object.values(deals);

    if (searchTerm.trim()) {
      result = result.filter(deal =>
        deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.contact.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStage !== 'all') {
      result = result.filter(deal => deal.stage === filterStage);
    }

    result.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'value':
          aValue = a.value;
          bValue = b.value;
          break;
        case 'probability':
          aValue = a.probability;
          bValue = b.probability;
          break;
        case 'updated':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'company':
          aValue = a.company.toLowerCase();
          bValue = b.company.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [deals, searchTerm, filterStage, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const toggleFavorite = (e: React.MouseEvent, deal: Deal) => {
    e.stopPropagation();
    onDealUpdate(deal.id, { isFavorite: !deal.isFavorite });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'qualification': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'proposal': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
      'negotiation': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      'closed-won': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'closed-lost': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    };
    return colors[stage] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  const getStageName = (stage: string) => {
    const names: Record<string, string> = {
      'qualification': 'Qualification',
      'proposal': 'Proposal',
      'negotiation': 'Negotiation',
      'closed-won': 'Won',
      'closed-lost': 'Lost'
    };
    return names[stage] || stage;
  };

  const SortButton: React.FC<{ field: SortField; label: string }> = ({ field, label }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
    >
      <span>{label}</span>
      {sortField === field ? (
        sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  );

  if (filteredAndSortedDeals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <Building2 className="w-8 h-8 text-gray-400 dark:text-gray-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No deals found</h3>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
          {searchTerm || filterStage !== 'all'
            ? 'Try adjusting your search or filter criteria'
            : 'Get started by creating your first deal'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-6">
          <SortButton field="title" label="Title" />
          <SortButton field="company" label="Company" />
          <SortButton field="value" label="Value" />
          <SortButton field="probability" label="Probability" />
          <SortButton field="updated" label="Updated" />
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {filteredAndSortedDeals.length} deal{filteredAndSortedDeals.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-2">
        {filteredAndSortedDeals.map((deal) => (
          <div
            key={deal.id}
            onClick={() => onDealClick(deal.id)}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {deal.title}
                    </h3>
                    {deal.isFavorite && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                    )}
                    {deal.aiScore && deal.aiScore > 0 && (
                      <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full flex-shrink-0">
                        <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                          {deal.aiScore}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <Building2 className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{deal.company}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <User className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{deal.contact}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-sm font-medium text-gray-900 dark:text-white">
                      <DollarSign className="w-4 h-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                      <span>{formatCurrency(deal.value)}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <TrendingUp className="w-4 h-4 flex-shrink-0" />
                      <span>{deal.probability}% probability</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                  <button
                    onClick={(e) => toggleFavorite(e, deal)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Star className={`w-5 h-5 ${deal.isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400 dark:text-gray-600'}`} />
                  </button>

                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStageColor(deal.stage)}`}>
                    {getStageName(deal.stage)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-500">
                  <Calendar className="w-3 h-3" />
                  <span>Updated {formatDate(deal.updatedAt)}</span>
                </div>

                {deal.notes && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 truncate max-w-md">
                    {deal.notes.length > 100 ? `${deal.notes.substring(0, 100)}...` : deal.notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
