import React from 'react';
import { Deal } from '../../types';
import { Calendar, DollarSign, Target, TrendingUp, Users, Building2, Tag, Clock, MapPin, Briefcase, Award } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface DealCardMetadataProps {
  deal: Deal;
  onAnalyze?: (e: React.MouseEvent) => void;
  onAIEnrich?: (e: React.MouseEvent) => void;
  isAnalyzing?: boolean;
  isEnriching?: boolean;
}

export const DealCardMetadata: React.FC<DealCardMetadataProps> = ({
  deal,
  onAnalyze,
  onAIEnrich,
  isAnalyzing = false,
  isEnriching = false
}) => {
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
      'qualification': 'bg-blue-500',
      'proposal': 'bg-indigo-500',
      'negotiation': 'bg-purple-500',
      'closed-won': 'bg-green-500',
      'closed-lost': 'bg-red-500'
    };
    return colors[stage] || 'bg-gray-500';
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
    <div className="space-y-3">
      {/* Deal Value and Stage */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="text-lg font-bold text-green-700 dark:text-green-400">
            {formatCurrency(deal.value)}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs font-medium text-white rounded-full ${getStageColor(deal.stage)}`}>
            {deal.stage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        </div>
      </div>

      {/* Priority and Probability */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className={`text-sm font-medium ${getPriorityColor(deal.priority)}`}>
            {deal.priority.toUpperCase()} PRIORITY
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            {deal.probability}% Win Rate
          </span>
        </div>
      </div>

      {/* Due Date */}
      {deal.dueDate && (
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Due: {deal.dueDate.toLocaleDateString()}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            new Date() > deal.dueDate
              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
          }`}>
            {new Date() > deal.dueDate ? 'Overdue' : 'Upcoming'}
          </span>
        </div>
      )}

      {/* Assigned Team Member */}
      {deal.assignedTo && (
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Assigned to: {deal.assignedTo}
          </span>
        </div>
      )}

      {/* Company and Contact */}
      <div className="flex items-center space-x-2">
        <Building2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {deal.company}
        </span>
      </div>

      {deal.contact && (
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Contact: {deal.contact}
          </span>
        </div>
      )}

      {/* Tags */}
      {deal.tags && deal.tags.length > 0 && (
        <div className="flex items-center space-x-2">
          <Tag className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <div className="flex flex-wrap gap-1">
            {deal.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
            {deal.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                +{deal.tags.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* AI Actions */}
      <div className="flex space-x-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        {onAnalyze && (
          <Tooltip content="Analyze deal with AI" position="bottom">
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="flex items-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Target className="w-3 h-3" />
              <span>{isAnalyzing ? 'Analyzing...' : 'AI Analyze'}</span>
            </button>
          </Tooltip>
        )}

        {onAIEnrich && (
          <Tooltip content="Enrich deal data with AI" position="bottom">
            <button
              onClick={onAIEnrich}
              disabled={isEnriching}
              className="flex items-center space-x-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Award className="w-3 h-3" />
              <span>{isEnriching ? 'Enriching...' : 'AI Enrich'}</span>
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};