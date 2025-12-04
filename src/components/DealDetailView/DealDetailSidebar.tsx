import React from 'react';
import { Sparkles, Brain, Wand2, Target, BarChart3, Mail, Phone, Edit, Heart, HeartOff, Camera, User, Globe, Clock, Building2, Tag, DollarSign, TrendingUp, AlertCircle, CheckCircle, Plus, X, Zap, Calendar, FileText } from 'lucide-react';
import { DealDetailSidebarProps } from './types';
import { AIAnalyzeButton, EmailButton, CallButton, AIEnrichButton, AIAutoEnrichButton, FavoriteButton } from '../ui/UnifiedActionButton';

export const DealDetailSidebar: React.FC<DealDetailSidebarProps> = ({
  deal,
  editedDeal,
  linkedContact,
  isAnalyzing,
  onAnalyzeDeal,
  onContactAnalysis,
  onContactEnrichment,
  onFindNewImage,
  onToggleFavorite,
  onAction,
  onClose
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
    <div className="w-80 bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Fixed Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
          Deal Profile
          <Sparkles className="w-4 h-4 ml-2 text-purple-500 dark:text-purple-400" />
        </h2>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Deal Header with Company Info */}
        <div className="p-5 text-center border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="relative inline-block mb-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              {editedDeal.company.charAt(0)}
            </div>

            {/* AI Enhancement Indicator */}
            {editedDeal.probability > 70 && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-lg ring-2 ring-white">
                <Sparkles className="w-2.5 h-2.5" />
              </div>
            )}

            {/* Favorite Badge */}
            {editedDeal.isFavorite && (
              <div className="absolute -top-1 -left-1 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg ring-2 ring-white">
                <Heart className="w-3 h-3" />
              </div>
            )}
          </div>

          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">{editedDeal.title}</h3>
          <p className="text-gray-600 dark:text-gray-300 font-medium mb-1">{editedDeal.company}</p>

          {/* Stage and Priority */}
          <div className="flex items-center justify-center space-x-2 mt-3">
            <span className={`${getStageColor(editedDeal.stage)} text-white text-xs px-3 py-1 rounded-full font-medium`}>
              {editedDeal.stage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
            <span className={`text-xs font-medium ${getPriorityColor(editedDeal.priority)}`}>
              {editedDeal.priority.toUpperCase()} PRIORITY
            </span>
          </div>

          {/* AI Enhanced Badge */}
          {editedDeal.probability > 70 && (
            <div className="mt-3 p-2 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-center space-x-2">
                <Sparkles className="w-3 h-3 text-purple-600" />
                <span className="text-xs font-medium text-purple-900">
                  AI Enhanced (75% confidence)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* AI Tools Section */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-800">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center">
            <Brain className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
            AI Assistant Tools
          </h4>

          {/* AI Goals Button */}
          <div className="mb-3">
            <button className="w-full flex items-center justify-center py-2 px-3 bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-700 dark:to-blue-700 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 dark:hover:from-purple-800 dark:hover:to-blue-800 text-sm font-medium transition-all duration-200 border border-purple-300/50 dark:border-purple-500/50 shadow-sm hover:shadow-md hover:scale-105">
              <Target className="w-4 h-4 mr-2" />
              AI Goals
            </button>
          </div>

          {/* Quick AI Actions Grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <EmailButton
              ai={true}
              onClick={onAction}
              disabled={!linkedContact?.email}
              className="p-3 flex flex-col items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 min-h-[3.5rem] bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 text-gray-700 dark:text-gray-100 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-600 dark:hover:to-gray-500 border-gray-200/50 dark:border-gray-600/50"
            />

            <AIEnrichButton
              onClick={onAction}
              className="p-3 flex flex-col items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 min-h-[3.5rem] bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 text-gray-700 dark:text-gray-100 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-600 dark:hover:to-gray-500 border-gray-200/50 dark:border-gray-600/50"
            />

            <button
              onClick={() => {/* Navigate to insights */}}
              className="p-3 flex flex-col items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 min-h-[3.5rem] bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 text-gray-700 dark:text-gray-100 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-600 dark:hover:to-gray-500 border-gray-200/50 dark:border-gray-600/50"
            >
              <TrendingUp className="w-4 h-4 mb-1" />
              <span className="text-xs leading-tight text-center">Insights</span>
            </button>

            <button
              onClick={() => {/* Navigate to analytics */}}
              className="p-3 flex flex-col items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 min-h-[3.5rem] bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 text-gray-700 dark:text-gray-100 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-600 dark:hover:to-gray-500 border-gray-200/50 dark:border-gray-600/50"
            >
              <BarChart3 className="w-4 h-4 mb-1" />
              <span className="text-xs leading-tight text-center">Analytics</span>
            </button>
          </div>

          {/* AI Auto-Enrich Button */}
          <AIAutoEnrichButton
            onClick={onAction}
            className="w-full flex items-center justify-center py-2 px-3 bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-700 dark:to-blue-700 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 dark:hover:from-purple-800 dark:hover:to-blue-800 text-sm font-medium transition-all duration-200 border border-purple-300/50 dark:border-purple-500/50 shadow-sm hover:shadow-md hover:scale-105"
          />
        </div>

        {/* Quick Action Buttons */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
            <Zap className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400" />
            Quick Actions
          </h4>
          <div className="grid grid-cols-4 gap-2">
            <button className="p-3 flex flex-col items-center hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-all text-center">
              <Edit className="w-4 h-4 mb-1 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium dark:text-gray-200">Edit</span>
            </button>
            <EmailButton
              onClick={onAction}
              disabled={!linkedContact?.email}
              className="p-3 flex flex-col items-center hover:bg-green-50 dark:hover:bg-gray-700 rounded-lg transition-all text-center"
            />
            <CallButton
              onClick={onAction}
              disabled={!linkedContact?.phone}
              className="p-3 flex flex-col items-center hover:bg-yellow-50 dark:hover:bg-gray-700 rounded-lg transition-all text-center"
            />
            <button className="p-3 flex flex-col items-center hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg transition-all text-center">
              <Calendar className="w-4 h-4 mb-1 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-medium dark:text-gray-200">Meet</span>
            </button>
          </div>

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button className="p-2 flex items-center justify-center hover:bg-purple-50 dark:hover:bg-gray-700 rounded-lg transition-all text-center text-xs font-medium text-purple-600 dark:text-purple-400">
              <Plus className="w-3 h-3 mr-1" />
              Add Field
            </button>
            <button className="p-2 flex items-center justify-center hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-all text-center text-xs font-medium text-orange-600 dark:text-orange-400">
              <FileText className="w-3 h-3 mr-1" />
              Files
            </button>
          </div>
        </div>

        {/* Contact Person Section */}
        {linkedContact ? (
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                <User className="w-4 h-4 mr-2 text-green-500 dark:text-green-400" />
                Contact Person
              </h4>
              <div className="flex space-x-1">
                <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                  <Edit className="w-3 h-3" />
                </button>
                <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors">
                  <User className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-gray-700 dark:to-gray-700 rounded-lg p-4 border border-blue-200 dark:border-gray-600">
              <div className="flex items-center space-x-3 mb-3">
                <div className="relative">
                  <img
                    src={linkedContact.avatarSrc || `https://api.dicebear.com/7.x/avataaars/svg?seed=${linkedContact.name}`}
                    alt={linkedContact.name}
                    className="w-12 h-12 rounded-full border border-gray-200 dark:border-gray-600"
                  />

                  {/* AI Score Badge */}
                  {linkedContact.aiScore && (
                    <div className={`absolute -top-1 -right-1 h-5 w-5 rounded-full ${
                      linkedContact.aiScore >= 80 ? 'bg-green-500' :
                      linkedContact.aiScore >= 60 ? 'bg-blue-500' :
                      linkedContact.aiScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                    } text-white flex items-center justify-center text-xs font-bold shadow-lg ring-1 ring-white`}>
                      {linkedContact.aiScore}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <h5 className="font-semibold text-gray-900 dark:text-white">{linkedContact.name}</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{linkedContact.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{linkedContact.company}</p>
                </div>
              </div>

              {/* Contact Actions */}
              <div className="grid grid-cols-2 gap-2">
                <EmailButton
                  onClick={onAction}
                  className="p-2 flex items-center justify-center hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-all text-center text-xs font-medium text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700"
                />
                <CallButton
                  onClick={onAction}
                  disabled={!linkedContact?.phone}
                  className="p-2 flex items-center justify-center hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition-all text-center text-xs font-medium text-yellow-600 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                <User className="w-4 h-4 mr-2 text-green-500 dark:text-green-400" />
                Contact Person
              </h4>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 text-center">
              <User className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">No contact assigned to this deal</p>
              <button className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors text-sm font-medium">
                Add Contact
              </button>
            </div>
          </div>
        )}

        {/* Deal Value & Probability */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
            <DollarSign className="w-4 h-4 mr-2 text-green-500 dark:text-green-400" />
            Deal Value & Probability
          </h4>

          <div className="space-y-4">
            {/* Deal Value */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Deal Value</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(editedDeal.value)}</p>
              </div>
            </div>

            {/* Probability */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Probability</p>
                <span className="text-lg font-bold text-blue-700 dark:text-blue-400">{editedDeal.probability}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    editedDeal.probability >= 80 ? 'bg-green-500' :
                    editedDeal.probability >= 60 ? 'bg-blue-500' :
                    editedDeal.probability >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${editedDeal.probability}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-4 bg-white dark:bg-gray-800">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
            <Clock className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400" />
            Timeline
          </h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Created</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{editedDeal.createdAt.toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Days Active</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {Math.ceil((new Date().getTime() - editedDeal.createdAt.getTime()) / (1000 * 60 * 60 * 24))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};