import React, { useMemo } from 'react';
import { User, Search, RefreshCw, FileText, TrendingUp, AlertCircle, Calendar, DollarSign } from 'lucide-react';
import { DealDetailOverviewProps } from './types';

export const DealDetailOverview: React.FC<DealDetailOverviewProps> = ({
  deal,
  editedDeal,
  linkedContact,
  onEditField,
  onStartEditingField,
  onSaveField,
  editingField
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

  // Calculate deal health metrics
  const dealMetrics = useMemo(() => {
    const daysActive = Math.ceil((new Date().getTime() - editedDeal.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const expectedValue = editedDeal.value * (editedDeal.probability / 100);
    const isStale = daysActive > 30;
    const isHighValue = editedDeal.value > 50000;
    
    return { daysActive, expectedValue, isStale, isHighValue };
  }, [editedDeal]);

  return (
    <div className="p-6 space-y-6">
      {/* Deal Summary Card - Enhanced */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border-l-4 border-blue-500">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{editedDeal.title}</h4>
            {dealMetrics.isStale && (
              <div className="flex items-center text-amber-600 dark:text-amber-400 text-sm">
                <AlertCircle className="w-4 h-4 mr-1" />
                <span>Deal inactive for {dealMetrics.daysActive} days - Consider follow-up</span>
              </div>
            )}
          </div>
          {dealMetrics.isHighValue && (
            <span className="px-3 py-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-white text-xs font-bold rounded-full shadow-sm">
              HIGH VALUE
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
              <User className="w-4 h-4 mr-1" />
              Company
            </p>
            <p className="text-gray-900 dark:text-white text-lg font-semibold">{editedDeal.company}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
              <DollarSign className="w-4 h-4 mr-1" />
              Deal Value
            </p>
            <p className="text-green-700 dark:text-green-400 text-lg font-bold">{formatCurrency(editedDeal.value)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Expected: {formatCurrency(dealMetrics.expectedValue)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              Stage
            </p>
            <span className={`${getStageColor(editedDeal.stage)} text-white text-sm px-3 py-1 rounded-full font-medium inline-block mt-1`}>
              {editedDeal.stage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              Days Active
            </p>
            <p className="text-gray-900 dark:text-white text-lg font-semibold">{dealMetrics.daysActive}</p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
              <div 
                className={`h-1.5 rounded-full ${dealMetrics.isStale ? 'bg-amber-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(dealMetrics.daysActive, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information Card - Enhanced */}
      {linkedContact && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" />
            Contact Information
            {linkedContact.aiScore && linkedContact.aiScore >= 80 && (
              <span className="ml-auto px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full">
                ⭐ High Quality Lead
              </span>
            )}
          </h4>

          <div className="flex items-start space-x-4">
            <div className="relative">
              <img
                src={linkedContact.avatarSrc || `https://api.dicebear.com/7.x/avataaars/svg?seed=${linkedContact.name}`}
                alt={linkedContact.name}
                className="w-20 h-20 rounded-lg border-2 border-gray-200 dark:border-gray-600 shadow-sm"
              />
              {linkedContact.aiScore && (
                <div className={`absolute -bottom-2 -right-2 px-2 py-1 rounded-full text-xs font-bold text-white shadow-lg ${
                  linkedContact.aiScore >= 80 ? 'bg-green-500' :
                  linkedContact.aiScore >= 60 ? 'bg-blue-500' :
                  linkedContact.aiScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}>
                  {linkedContact.aiScore}
                </div>
              )}
            </div>

            <div className="flex-1">
              <h5 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{linkedContact.name}</h5>
              <p className="text-gray-600 dark:text-gray-300 mb-3">{linkedContact.title} at {linkedContact.company}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</p>
                  <a 
                    href={`mailto:${linkedContact.email}`} 
                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                    title="Send email"
                  >
                    <span className="truncate">{linkedContact.email}</span>
                  </a>
                </div>
                {linkedContact.phone && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</p>
                    <a 
                      href={`tel:${linkedContact.phone}`} 
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                      title="Call contact"
                    >
                      {linkedContact.phone}
                    </a>
                  </div>
                )}
                {linkedContact.industry && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Industry</p>
                    <p className="text-gray-900 dark:text-white">{linkedContact.industry}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deal Notes - Enhanced with character count and formatting help */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <FileText className="w-5 h-5 mr-2 text-purple-500 dark:text-purple-400" />
            Notes
          </h4>
          <button
            onClick={() => onStartEditingField('notes')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            title="Edit notes (Keyboard shortcut: E)"
          >
            {editingField === 'notes' ? 'Editing...' : 'Edit'}
          </button>
        </div>

        {editingField === 'notes' ? (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                value={editedDeal.notes || ''}
                onChange={(e) => onEditField('notes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                rows={5}
                placeholder="Add notes about this deal..."
                autoFocus
              />
              <div className="absolute bottom-2 right-2 text-xs text-gray-400 dark:text-gray-500">
                {editedDeal.notes?.length || 0} characters
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                <button
                  onClick={onSaveField}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  title="Save changes (Keyboard shortcut: Ctrl+Enter)"
                >
                  Save
                </button>
                <button
                  onClick={() => onStartEditingField('')}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  title="Cancel editing (Keyboard shortcut: Esc)"
                >
                  Cancel
                </button>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                💡 Tip: Use markdown for formatting
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-colors cursor-pointer" onClick={() => onStartEditingField('notes')}>
            {editedDeal.notes ? (
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                {editedDeal.notes}
              </p>
            ) : (
              <div className="text-center py-4">
                <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">No notes for this deal.</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Click to add notes</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Research & Competitive Analysis - Enhanced */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Search className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
            AI Research & Competitive Analysis
            <span className="ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-semibold rounded">
              AI-Powered
            </span>
          </h4>
          <button 
            className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center font-medium group"
            title="Refresh AI analysis"
          >
            <RefreshCw className="w-4 h-4 mr-1 group-hover:rotate-180 transition-transform duration-500" />
            Update
          </button>
        </div>

        <div className="space-y-4">
          {/* Company Analysis */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
            <div className="flex items-start justify-between mb-3">
              <h5 className="text-sm font-semibold text-purple-900 dark:text-purple-300 flex items-center">
                <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs mr-2">1</span>
                Company Analysis
              </h5>
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">90% confidence</span>
            </div>
            <p className="text-sm text-purple-700 dark:text-purple-400 leading-relaxed">
              {editedDeal.company} is a mid-sized company in the technology sector with an estimated annual revenue of $50-100M.
              Recent news indicates they're expanding operations and investing in digital transformation initiatives.
            </p>
          </div>

          {/* Decision Factors */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="flex items-start justify-between mb-3">
              <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-300 flex items-center">
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs mr-2">2</span>
                Key Decision Factors
              </h5>
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-400 mb-3 leading-relaxed">
              Based on analysis of similar deals, key decision factors for this type of client include:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border border-blue-100 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Implementation Time</p>
                  <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full font-medium">Critical</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                  <div className="bg-red-500 h-1.5 rounded-full" style={{ width: '90%' }}></div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border border-blue-100 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">ROI Timeline</p>
                  <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full font-medium">High</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                  <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border border-blue-100 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Technical Support</p>
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full font-medium">Medium</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                  <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border border-blue-100 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Pricing Model</p>
                  <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">Medium</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                  <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '55%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Competitive Landscape */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
            <div className="flex items-start justify-between mb-3">
              <h5 className="text-sm font-semibold text-green-900 dark:text-green-300 flex items-center">
                <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs mr-2">3</span>
                Competitive Landscape
              </h5>
              <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full font-medium">2 competitors</span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-400 mb-3 leading-relaxed">
              Main competitors pursuing similar deals in this space:
            </p>
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-white dark:bg-gray-700 p-3 rounded-lg border border-green-100 dark:border-green-800 hover:border-green-300 dark:hover:border-green-600 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">CompetitorX</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Market leader</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Weakness: Implementation time
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">6-8 months avg</p>
                </div>
              </div>
              <div className="flex justify-between items-center bg-white dark:bg-gray-700 p-3 rounded-lg border border-green-100 dark:border-green-800 hover:border-green-300 dark:hover:border-green-600 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">CompetitorY</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Budget option</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Weakness: Limited support
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email only</p>
                </div>
              </div>
            </div>
          </div>

          {/* Citations Section - Enhanced */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
            <h5 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-3 flex items-center">
              <FileText className="w-4 h-4 mr-2 dark:text-indigo-400" />
              Research Citations & Sources
              <span className="ml-2 text-xs px-2 py-0.5 bg-indigo-600 text-white rounded-full font-medium">Verified</span>
            </h5>
            <div className="space-y-2">
              <a 
                href="#" 
                className="block bg-white dark:bg-gray-700 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all hover:shadow-sm group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">techcrunch.com</p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Company Analysis Report - Recent developments and market position analysis</p>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">2d ago</span>
                </div>
              </a>
              <a 
                href="#" 
                className="block bg-white dark:bg-gray-700 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all hover:shadow-sm group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">linkedin.com</p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Company LinkedIn Profile - Official company information and updates</p>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">5d ago</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};