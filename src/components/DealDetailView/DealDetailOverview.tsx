import React from 'react';
import { User, Search, RefreshCw, FileText, Edit } from 'lucide-react';
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

  // Calculate days in current stage
  const daysInStage = Math.ceil((Date.now() - new Date(editedDeal.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  const daysActive = Math.ceil((Date.now() - new Date(editedDeal.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="p-6 space-y-6">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1">Deal Value</p>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{formatCurrency(editedDeal.value)}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Expected revenue</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-4 border border-green-200 dark:border-green-700">
          <p className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide mb-1">Probability</p>
          <p className="text-2xl font-bold text-green-900 dark:text-green-100">{editedDeal.probability}%</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Close confidence</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
          <p className="text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wide mb-1">Days in Stage</p>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{daysInStage}</p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Current stage time</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-xl p-4 border border-orange-200 dark:border-orange-700">
          <p className="text-xs font-medium text-orange-700 dark:text-orange-300 uppercase tracking-wide mb-1">Days Active</p>
          <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{daysActive}</p>
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Total deal age</p>
        </div>
      </div>

      {/* Deal Summary Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{editedDeal.title}</h4>
          <span className={`${getStageColor(editedDeal.stage)} text-white text-sm px-3 py-1 rounded-full font-medium`}>
            {editedDeal.stage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company</p>
            <p className="text-gray-900 dark:text-white text-lg font-medium">{editedDeal.company}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</p>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              editedDeal.priority === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
              editedDeal.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
              'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            }`}>
              {editedDeal.priority.charAt(0).toUpperCase() + editedDeal.priority.slice(1)} Priority
            </span>
          </div>
        </div>
      </div>

      {/* Contact Information Card */}
      {linkedContact && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" />
            Contact Information
          </h4>

          <div className="flex items-start space-x-4">
            <img
              src={linkedContact.avatarSrc || `https://api.dicebear.com/7.x/avataaars/svg?seed=${linkedContact.name}`}
              alt={linkedContact.name}
              className="w-16 h-16 rounded-lg border border-gray-200 dark:border-gray-600"
            />

            <div className="flex-1">
              <h5 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{linkedContact.name}</h5>
              <p className="text-gray-600 dark:text-gray-300 mb-2">{linkedContact.title} at {linkedContact.company}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</p>
                  <a href={`mailto:${linkedContact.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                    {linkedContact.email}
                  </a>
                </div>
                {linkedContact.phone && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone</p>
                    <a href={`tel:${linkedContact.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                      {linkedContact.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deal Notes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <FileText className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
            Deal Notes
          </h4>
          <button
            onClick={() => onStartEditingField('notes')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center"
          >
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </button>
        </div>

        {editingField === 'notes' ? (
          <div className="space-y-3">
            <textarea
              value={editedDeal.notes || ''}
              onChange={(e) => onEditField('notes', e.target.value)}
              placeholder="Add notes about this deal, recent conversations, key points, or next steps..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              rows={6}
            />
            <div className="flex space-x-2">
              <button
                onClick={onSaveField}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
              >
                Save Notes
              </button>
              <button
                onClick={() => onStartEditingField('')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            {editedDeal.notes ? (
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line text-sm leading-relaxed">
                {editedDeal.notes}
              </p>
            ) : (
              <div className="text-center py-6">
                <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">No notes added yet</p>
                <button
                  onClick={() => onStartEditingField('notes')}
                  className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Add your first note
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Research & Competitive Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Search className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
            AI Research & Competitive Analysis
          </h4>
          <button className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center">
            <RefreshCw className="w-4 h-4 mr-1" />
            Update
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
            <h5 className="text-sm font-medium text-purple-900 dark:text-purple-300 mb-2">Company Analysis</h5>
            <p className="text-xs text-purple-700 dark:text-purple-400">
              {editedDeal.company} is a mid-sized company in the technology sector with an estimated annual revenue of $50-100M.
              Recent news indicates they're expanding operations and investing in digital transformation initiatives.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
            <h5 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">Decision Factors</h5>
            <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">
              Based on analysis of similar deals, key decision factors for this type of client include:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white dark:bg-gray-700 p-2 rounded border border-blue-100 dark:border-blue-800">
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Implementation Time</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Critical factor</p>
              </div>
              <div className="bg-white dark:bg-gray-700 p-2 rounded border border-blue-100 dark:border-blue-800">
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300">ROI Timeline</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">High importance</p>
              </div>
              <div className="bg-white dark:bg-gray-700 p-2 rounded border border-blue-100 dark:border-blue-800">
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Technical Support</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Medium importance</p>
              </div>
              <div className="bg-white dark:bg-gray-700 p-2 rounded border border-blue-100 dark:border-blue-800">
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Pricing Model</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Medium importance</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
            <h5 className="text-sm font-medium text-green-900 dark:text-green-300 mb-2">Competitive Landscape</h5>
            <p className="text-xs text-green-700 dark:text-green-400 mb-2">
              Main competitors pursuing similar deals in this space:
            </p>
            <div className="space-y-2">
              <div className="flex justify-between bg-white dark:bg-gray-700 p-2 rounded border border-green-100 dark:border-green-800">
                <p className="text-xs font-medium text-green-800 dark:text-green-300">CompetitorX</p>
                <div className="flex items-center">
                  <span className="text-xs text-red-600 dark:text-red-400">Weakness: Implementation time</span>
                </div>
              </div>
              <div className="flex justify-between bg-white dark:bg-gray-700 p-2 rounded border border-green-100 dark:border-green-800">
                <p className="text-xs font-medium text-green-800 dark:text-green-300">CompetitorY</p>
                <div className="flex items-center">
                  <span className="text-xs text-red-600 dark:text-red-400">Weakness: Limited support</span>
                </div>
              </div>
            </div>
          </div>

          {/* Citations Section */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
            <h5 className="text-sm font-medium text-indigo-900 dark:text-indigo-300 mb-3 flex items-center">
              <FileText className="w-4 h-4 mr-2 dark:text-indigo-400" />
              Research Citations & Sources
            </h5>
            <div className="space-y-2">
              <div className="bg-white dark:bg-gray-700 p-3 rounded border border-indigo-100 dark:border-indigo-800">
                <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300">techcrunch.com</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">Company Analysis Report - Recent developments and market position analysis</p>
              </div>
              <div className="bg-white dark:bg-gray-700 p-3 rounded border border-indigo-100 dark:border-indigo-800">
                <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300">linkedin.com</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">Company LinkedIn Profile - Official company information and updates</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};