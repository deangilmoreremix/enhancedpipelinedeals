import React, { useState, useMemo } from 'react';
import { Deal } from '../../types';
import { DollarSign, Calendar, User, Building2, Target, ArrowUp, ArrowDown, Edit } from 'lucide-react';

interface DealTableViewProps {
  deals: Record<string, Deal>;
  onDealClick: (dealId: string) => void;
  onDealUpdate: (id: string, updates: Partial<Deal>) => void;
  searchTerm: string;
  filterStage: string;
}

export const DealTableView: React.FC<DealTableViewProps> = ({
  deals,
  onDealClick,
  onDealUpdate,
  searchTerm,
  filterStage
}) => {
  const [sortBy, setSortBy] = useState<'title' | 'company' | 'contact' | 'value' | 'probability' | 'stage' | 'updated'>('updated');
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
        case 'contact':
          aValue = a.contact.toLowerCase();
          bValue = b.contact.toLowerCase();
          break;
        case 'value':
          aValue = a.value;
          bValue = b.value;
          break;
        case 'probability':
          aValue = a.probability;
          bValue = b.probability;
          break;
        case 'stage':
          aValue = a.stage;
          bValue = b.stage;
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
      'qualification': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'proposal': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
      'negotiation': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'closed-won': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'closed-lost': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    };
    return colors[stage] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'high': 'text-red-600 dark:text-red-400',
      'medium': 'text-yellow-600 dark:text-yellow-400',
      'low': 'text-green-600 dark:text-green-400'
    };
    return colors[priority] || 'text-gray-600 dark:text-gray-400';
  };

  const SortButton: React.FC<{ field: typeof sortBy; children: React.ReactNode }> = ({ field, children }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 text-left font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
    >
      <span>{children}</span>
      {sortBy === field && (
        sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
      )}
    </button>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Table Header */}
      <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-12 gap-4 px-6 py-4">
          <div className="col-span-3">
            <SortButton field="title">Deal Title</SortButton>
          </div>
          <div className="col-span-2">
            <SortButton field="company">Company</SortButton>
          </div>
          <div className="col-span-2">
            <SortButton field="contact">Contact</SortButton>
          </div>
          <div className="col-span-1">
            <SortButton field="value">Value</SortButton>
          </div>
          <div className="col-span-2">
            <SortButton field="stage">Stage</SortButton>
          </div>
          <div className="col-span-1">
            <SortButton field="probability">Probability</SortButton>
          </div>
          <div className="col-span-1">
            <span className="font-medium text-gray-700 dark:text-gray-300">Actions</span>
          </div>
        </div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {filteredAndSortedDeals.length === 0 ? (
          <div className="text-center py-12">
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
              className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <div className="col-span-3">
                <div className="flex items-center space-x-2">
                  {deal.isFavorite && (
                    <span className="text-red-500">★</span>
                  )}
                  <span className="font-medium text-gray-900 dark:text-white truncate">
                    {deal.title}
                  </span>
                </div>
                <div className={`text-xs font-medium mt-1 ${getPriorityColor(deal.priority)}`}>
                  {deal.priority.toUpperCase()} PRIORITY
                </div>
              </div>
              
              <div className="col-span-2">
                <div className="flex items-center space-x-2">
                  <img
                    src={deal.companyAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(deal.company)}&background=3b82f6&color=ffffff&size=24`}
                    alt={deal.company}
                    className="w-6 h-6 rounded object-cover"
                  />
                  <span className="text-gray-900 dark:text-white truncate">{deal.company}</span>
                </div>
              </div>
              
              <div className="col-span-2">
                <div className="flex items-center space-x-2">
                  {deal.contactAvatar ? (
                    <img
                      src={deal.contactAvatar}
                      alt={deal.contact}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                      <User className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                    </div>
                  )}
                  <span className="text-gray-900 dark:text-white truncate">{deal.contact}</span>
                </div>
              </div>
              
              <div className="col-span-1">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(deal.value)}
                </span>
              </div>
              
              <div className="col-span-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageColor(deal.stage)}`}>
                  {deal.stage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
              
              <div className="col-span-1">
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${deal.probability}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {deal.probability}%
                  </span>
                </div>
              </div>
              
              <div className="col-span-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle edit action
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};