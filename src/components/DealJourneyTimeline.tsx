import React, { useState, useEffect } from 'react';
import { Deal } from '../types';
import { Calendar, TrendingUp, Clock, CheckCircle, AlertCircle, Plus, Edit, Trash2, Paperclip, Upload, X, FileText, Eye, Sparkles } from 'lucide-react';
import { getWebSearchService } from '../services/webSearchService';
import { getSupabaseService } from '../services/supabaseService';
import ResearchStatusOverlay from './ui/ResearchStatusOverlay';
import { ModernButton } from './ui/ModernButton';
import { getStorageBucketService } from '../services/storageBucketService';

interface DealJourneyTimelineProps {
  deal: Deal;
}

export const DealJourneyTimeline: React.FC<DealJourneyTimelineProps> = ({ deal }) => {
  const [timelineEvents, setTimelineEvents] = useState([
    {
      id: '1',
      title: 'Deal Created',
      description: 'Initial deal entry created in the system',
      date: deal.createdAt,
      type: 'creation',
      icon: Calendar,
      status: 'completed'
    },
    {
      id: '2',
      title: 'Initial Contact',
      description: 'First outreach to the prospect',
      date: new Date(deal.createdAt.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days later
      type: 'contact',
      icon: TrendingUp,
      status: 'completed'
    },
    {
      id: '3',
      title: 'Proposal Sent',
      description: 'Formal proposal delivered to client',
      date: new Date(deal.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week later
      type: 'milestone',
      icon: CheckCircle,
      status: deal.stage === 'proposal' || deal.stage === 'negotiation' || deal.stage === 'closed-won' || deal.stage === 'closed-lost' ? 'completed' : 'pending'
    },
    {
      id: '4',
      title: 'Negotiation Phase',
      description: 'Terms and pricing discussion',
      date: deal.dueDate || new Date(deal.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks later or due date
      type: 'milestone',
      icon: AlertCircle,
      status: deal.stage === 'negotiation' || deal.stage === 'closed-won' || deal.stage === 'closed-lost' ? 'completed' : 'pending'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
          Deal Journey Timeline
        </h3>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {Math.ceil((new Date().getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days active
          </div>
          <ModernButton
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowAddEvent(true)}
          >
            Add Event
          </ModernButton>
        </div>
      </div>

      <div className="space-y-4">
        {timelineEvents.map((event, index) => {
          const Icon = event.icon;
          const isLast = index === timelineEvents.length - 1;

          return (
            <div key={event.id} className="flex items-start space-x-4">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  event.status === 'completed'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                {!isLast && (
                  <div className={`w-0.5 h-16 mt-2 ${
                    event.status === 'completed'
                      ? 'bg-green-200 dark:bg-green-800'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </div>

              <div className="flex-1 pb-8">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">{event.title}</h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {event.date.toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{event.description}</p>

                {event.status === 'completed' && (
                  <div className="flex items-center mt-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    <span className="text-xs text-green-600 dark:text-green-400">Completed</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">Next Steps</h4>
        <div className="space-y-2">
          <div className="flex items-center text-sm text-blue-700 dark:text-blue-400">
            <Clock className="w-4 h-4 mr-2" />
            Schedule follow-up call for proposal review
          </div>
          <div className="flex items-center text-sm text-blue-700 dark:text-blue-400">
            <TrendingUp className="w-4 h-4 mr-2" />
            Prepare negotiation strategy
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-xl font-semibold text-gray-900 dark:text-white">Add Timeline Event</h4>
              <button
                onClick={() => setShowAddEvent(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="e.g., Client Meeting, Proposal Review..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  placeholder="Describe what happened in this event..."
                  rows={3}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* File Attachments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Attachments
                </label>
                <div className="space-y-2">
                  <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                    <div className="text-center">
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Click to upload files</p>
                    </div>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.txt"
                    />
                  </label>

                  {attachedFiles.length > 0 && (
                    <div className="space-y-2">
                      {attachedFiles.map((file, index) => {
                        const fileId = `${file.name}-${file.size}-${file.lastModified}`;
                        const hasSummary = documentSummaries[fileId];
                        const isSummarizing = summarizingFiles.has(fileId);

                        return (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <Paperclip className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-gray-900 dark:text-white">{file.name}</span>
                              <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {!hasSummary && !isSummarizing && (
                                <button
                                  onClick={() => summarizeDocument(file, fileId)}
                                  className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors flex items-center"
                                  title="Generate AI Summary"
                                >
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  Summarize
                                </button>
                              )}
                              {isSummarizing && (
                                <div className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded flex items-center">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-700 mr-1"></div>
                                  Analyzing...
                                </div>
                              )}
                              {hasSummary && (
                                <button
                                  onClick={() => setShowSummary(showSummary === fileId ? null : fileId)}
                                  className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800 transition-colors flex items-center"
                                  title="View AI Summary"
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Summary
                                </button>
                              )}
                              <button
                                onClick={() => removeAttachment(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddEvent(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addNewEvent}
                disabled={!newEventTitle.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Summary Overlay */}
      {showSummary && documentSummaries[showSummary] && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                Document Summary
              </h4>
              <button
                onClick={() => setShowSummary(null)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
                  {documentSummaries[showSummary]}
                </div>
              </div>
            </div>

            <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
              <ModernButton
                variant="outline"
                onClick={() => setShowSummary(null)}
              >
                Close
              </ModernButton>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};