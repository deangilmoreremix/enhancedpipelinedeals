import React, { useMemo, useState } from 'react';
import { Deal } from '../types';
import {
  DollarSign, ChevronDown, ChevronUp, Star, Sparkles,
  Edit2, Trash2, ExternalLink, ArrowUpDown
} from 'lucide-react';

interface DealTableViewProps {
  deals: Record<string, Deal>;
  onDealClick: (dealId: string) => void;
  onDealUpdate: (dealId: string, updates: Partial<Deal>) => void;
  searchTerm: string;
  filterStage: string;
}

type SortField = 'title' | 'company' | 'contact' | 'value' | 'stage' | 'probability' | 'updated';
type SortOrder = 'asc' | 'desc';

export const DealTableView: React.FC<DealTableViewProps> = ({
  deals,
  onDealClick,
  onDealUpdate,
  searchTerm,
  filterStage
}) => {
  const [sortField, setSortField] = useState<SortField>('updated');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());

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
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'company':
          aValue = a.company.toLowerCase();
          bValue = b.company.toLowerCase();
          break;
        case 'contact':
          aValue = a.contact.toLowerCase();
          bValue = b.contact.toLowerCase();
          break;
        case 'value':
          aValue = a.value;
          bValue = b.value;
          break;
        case 'stage':
          aValue = a.stage;
          bValue = b.stage;
          break;
        case 'probability':
          aValue = a.probability;
          bValue = b.probability;
          break;
        case 'updated':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
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

  const toggleSelectAll = () => {
    if (selectedDeals.size === filteredAndSortedDeals.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(filteredAndSortedDeals.map(d => d.id)));
    }
  };

  const toggleSelect = (dealId: string) => {
    const newSelected = new Set(selectedDeals);
    if (newSelected.has(dealId)) {
      newSelected.delete(dealId);
    } else {
      newSelected.add(dealId);
    }
    setSelectedDeals(newSelected);
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

  const TableHeader: React.FC<{ field: SortField; label: string; className?: string }> = ({ field, label, className = '' }) => (
    <th
      onClick={() => handleSort(field)}
      className={`px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        {sortField === field ? (
          sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </div>
    </th>
  );

  if (filteredAndSortedDeals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <DollarSign className="w-8 h-8 text-gray-400 dark:text-gray-600" />
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
      {selectedDeals.size > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
            {selectedDeals.size} deal{selectedDeals.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => setSelectedDeals(new Set())}
            className="text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 font-medium"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedDeals.size === filteredAndSortedDeals.length && filteredAndSortedDeals.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Favorite
                </th>
                <TableHeader field="title" label="Deal Title" />
                <TableHeader field="company" label="Company" />
                <TableHeader field="contact" label="Contact" />
                <TableHeader field="value" label="Value" />
                <TableHeader field="stage" label="Stage" />
                <TableHeader field="probability" label="Win %" />
                <TableHeader field="updated" label="Updated" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  AI Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSortedDeals.map((deal) => (
                <tr
                  key={deal.id}
                  onClick={() => onDealClick(deal.id)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedDeals.has(deal.id)}
                      onChange={() => toggleSelect(deal.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => toggleFavorite(e, deal)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                    >
                      <Star className={`w-4 h-4 ${deal.isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400 dark:text-gray-600'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                      {deal.title}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">
                      {deal.company}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">
                      {deal.contact}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(deal.value)}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStageColor(deal.stage)}`}>
                      {getStageName(deal.stage)}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {deal.probability}%
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(deal.updatedAt)}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {deal.aiScore && deal.aiScore > 0 ? (
                      <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full">
                        <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                          {deal.aiScore}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onDealClick(deal.id)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors"
                        title="View details"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredAndSortedDeals.length} deal{filteredAndSortedDeals.length !== 1 ? 's' : ''}
        </div>
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          Total Value: {formatCurrency(filteredAndSortedDeals.reduce((sum, deal) => sum + deal.value, 0))}
        </div>
      </div>
    </div>
  );
};
