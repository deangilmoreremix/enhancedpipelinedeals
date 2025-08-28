import React, { useState, useMemo } from 'react';
import { Deal } from '../../types';
import { DollarSign, Calendar, User, Building2, Target, ArrowUp, ArrowDown, Search, Filter } from 'lucide-react';

interface DealListViewProps {
  deals: Record<string, Deal>;
  onDealClick: (dealId: string) => void;
  onDealUpdate: (id: string, updates: Partial<Deal>) => void;
  searchTerm: string;
  filterStage: string;
}

export const DealListView: React.FC<DealListViewProps> = ({
  deals,
  onDealClick,
  onDealUpdate,
  searchTerm,
  filterStage
}) => {
  const [sortBy, setSortBy] = useState<'title' | 'company' | 'value' | 'probability' | 'updated'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort deals
  const filteredAndSortedDeals = useMemo(() => {
    let result = Object.values(deals);

    // Apply search filter
    if (searchTerm.trim()) {
      result = result.filter(deal =>
        deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.contact.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply stage filter
    if (filterStage !== 'all') {
      result = result.filter(deal => deal.stage === filterStage);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'company':
          aValue = a.company.toLowerCase();
          bValue = b.company.toLowerCase();
          break;
        case 'value':
          aValue = a.value;
          bValue = b.value;
          break;
        case 'probability':
          aValue = a.probability;
          bValue = b.probability;
          break;
        case 'updated':
          aValue = new Date(a.updatedAt);
          bValue = new Date(b.updatedAt);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [deals, searchTerm, filterStage, sortBy, sortOrder]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'qualification': 'bg-blue-100 text-blue-800',
      'proposal': 'bg-indigo-100 text-indigo-800',
      'negotiation': 'bg-purple-100 text-purple-800',
      'closed-won': 'bg-green-100 text-green-800',
      'closed-lost': 'bg-red-100 text-red-800'
    };
    return colors[stage] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'high': 'text-red-600',
      'medium': 'text-yellow-600',
      'low': 'text-green-600'
    };
    return colors[priority] || 'text-gray-600';
  };

  return (
    <div className="space-y-4">
      {/* Sort Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
          {['title', 'company', 'value', 'probability', 'updated'].map((field) => (
            <button
              key={field}
              onClick={() => handleSort(field as typeof sortBy)}
              className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-md transition-colors ${
                sortBy === field 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              <span className="capitalize">{field === 'updated' ? 'Date' : field}</span>
              {sortBy === field && (
                sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
            </button>
          ))}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {filteredAndSortedDeals.length} deal{filteredAndSortedDeals.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Deals List */}
      <div className="space-y-3">
        {filteredAndSortedDeals.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">No deals found</h3>
            <p className="text-gray-500 dark:text-gray-500">
              {searchTerm || filterStage !== 'all' 
                ? 'Try adjusting your search or filter criteria' 
                : 'Create your first deal to get started'
              }
            </p>
          </div>
        ) : (
          filteredAndSortedDeals.map((deal) => (
            <div
              key={deal.id}
              onClick={() => onDealClick(deal.id)}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {deal.title}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageColor(deal.stage)}`}>
                      {deal.stage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <span className={`text-xs font-medium ${getPriorityColor(deal.priority)}`}>
                      {deal.priority.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Building2 className="w-4 h-4" />
                      <span>{deal.company}</span>
                    </div>
                    {deal.contact && (
                      <div className="flex items-center space-x-1">
                        <User className="w-4 h-4" />
                        <span>{deal.contact}</span>
                      </div>
                    )}
                    {deal.dueDate && (
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{deal.dueDate.toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(deal.value)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {deal.probability}% probability
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};