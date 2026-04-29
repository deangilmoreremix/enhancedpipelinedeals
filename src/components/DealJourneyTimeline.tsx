import React, { useState, useEffect, useCallback } from 'react';
import { Deal } from '../types';
import {
  Calendar, TrendingUp, Clock, CheckCircle, AlertCircle, Plus, Paperclip, Upload, X, FileText, Eye, Sparkles,
  MessageSquare, Filter, RefreshCw, Activity as ActivityIcon, User, Phone, Mail, File, Settings,
  ChevronDown, ChevronUp, Search, Tag, Star, Heart
} from 'lucide-react';
import { ModernButton } from './ui/ModernButton';
import { enhancedActivityService, ActivityFilter } from '../services/enhancedActivityService';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

interface DealJourneyTimelineProps {
  deal: Deal;
  dealId: string;
}

// Activity type icons mapping
const getActivityIcon = (activityType: string) => {
  const iconMap: Record<string, any> = {
    created: Calendar,
    updated: Settings,
    stage_changed: TrendingUp,
    contact_added: User,
    note_added: FileText,
    email_sent: Mail,
    meeting_scheduled: Calendar,
    task_completed: CheckCircle,
    attachment_added: Paperclip,
    link_added: File,
    probability_updated: TrendingUp,
    health_updated: ActivityIcon,
    bulk_action: Settings,
    ai_analysis: Sparkles,
    calendar_event: Calendar,
    email_received: Mail,
    followup_created: Clock,
    reminder_set: AlertCircle
  };
  return iconMap[activityType] || ActivityIcon;
};

// Activity type colors
const getActivityColor = (activityType: string, status?: string) => {
  if (status === 'completed') return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400';
  if (status === 'pending') return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400';
  if (status === 'failed') return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';

  const colorMap: Record<string, string> = {
    created: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    updated: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    stage_changed: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    contact_added: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    email_sent: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    meeting_scheduled: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    task_completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    ai_analysis: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    followup_created: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400'
  };
  return colorMap[activityType] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
};

export const DealJourneyTimeline: React.FC<DealJourneyTimelineProps> = ({ deal, dealId }) => {
  // Enhanced activity state
  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>({
    limit: 50,
    offset: 0
  });
  const [activityComments, setActivityComments] = useState<Record<string, any[]>>({});
  const [activityTemplates, setActivityTemplates] = useState<any[]>([]);
  const [showActivityFilters, setShowActivityFilters] = useState(false);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());

  // UI state
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newActivity, setNewActivity] = useState({
    title: '',
    description: '',
    type: 'note_added',
    priority: 'medium' as const,
    tags: [] as string[]
  });
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [documentSummaries, setDocumentSummaries] = useState<Record<string, string>>({});
  const [summarizingFiles, setSummarizingFiles] = useState<Set<string>>(new Set());
  const [showSummary, setShowSummary] = useState<string | null>(null);
  const [creatingActivity, setCreatingActivity] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Real-time sync for activities
  const { currentVersion } = useRealtimeSync({
    dealId,
    onActivitiesChange: (newActivities) => {
      setActivities(newActivities);
    },
    enabled: true
  });

  // Load activities and templates on mount
  useEffect(() => {
    const loadActivities = async () => {
      setActivitiesLoading(true);
      try {
        const result = await enhancedActivityService.getActivitiesForDeal(dealId, activityFilter);
        setActivities(result.activities);
      } catch (error) {
        setActivitiesError(error instanceof Error ? error.message : 'Failed to load activities');
      } finally {
        setActivitiesLoading(false);
      }
    };

    const loadTemplates = async () => {
      try {
        const templates = await enhancedActivityService.getActivityTemplates();
        setActivityTemplates(templates);
      } catch (error) {
        console.error('Failed to load activity templates:', error);
      }
    };

    loadActivities();
    loadTemplates();
  }, [dealId, activityFilter]);

  // Load comments for expanded activities
  const loadActivityComments = useCallback(async (activityId: string) => {
    if (activityComments[activityId]) return; // Already loaded

    try {
      const comments = await enhancedActivityService.getComments(activityId);
      setActivityComments(prev => ({
        ...prev,
        [activityId]: comments
      }));
    } catch (error) {
      console.error('Failed to load activity comments:', error);
    }
  }, [activityComments]);

  // Handle activity expansion
  const toggleActivityExpansion = useCallback(async (activityId: string) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
      await loadActivityComments(activityId); // Load comments when expanding
    }
    setExpandedActivities(newExpanded);
  }, [expandedActivities, loadActivityComments]);

  // Handle activity creation
  const createActivity = async () => {
    if (!newActivity.title.trim()) return;

    setCreatingActivity(true);
    try {
      const activityData = {
        dealId,
        activityType: newActivity.type,
        title: newActivity.title,
        description: newActivity.description,
        priority: newActivity.priority,
        tags: newActivity.tags,
        metadata: attachedFiles.length > 0 ? {
          attachments: attachedFiles.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
          }))
        } : undefined
      };

      const newActivityRecord = await enhancedActivityService.createActivity(activityData);

      // Add to activities list
      setActivities(prev => [newActivityRecord, ...prev]);

      // Reset form
      setNewActivity({
        title: '',
        description: '',
        type: 'note_added',
        priority: 'medium',
        tags: []
      });
      setAttachedFiles([]);
      setSelectedTemplate('');
      setShowAddEvent(false);
    } catch (error) {
      console.error('Failed to create activity:', error);
      setActivitiesError('Failed to create activity');
    } finally {
      setCreatingActivity(false);
    }
  };

  const createActivityFromTemplate = async (templateId: string) => {
    try {
      const activity = await enhancedActivityService.createActivityFromTemplate(templateId, dealId);
      setActivities(prev => [activity, ...prev]);
    } catch (error) {
      console.error('Failed to create activity from template:', error);
      setActivitiesError('Failed to create activity from template');
    }
  };

  // File handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const summarizeDocument = async (file: File, fileId: string) => {
    setSummarizingFiles(prev => new Set(prev).add(fileId));
    try {
      // Placeholder for document summarization logic
      // This would integrate with AI services to summarize the document
      const summary = `AI Summary of ${file.name}: This document contains key information relevant to the deal. Analysis shows important details about requirements, timelines, and next steps.`;
      setDocumentSummaries(prev => ({ ...prev, [fileId]: summary }));
    } catch (error) {
      console.error('Error summarizing document:', error);
    } finally {
      setSummarizingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  // Filter handling
  const updateFilter = (newFilter: Partial<ActivityFilter>) => {
    setActivityFilter(prev => ({ ...prev, ...newFilter }));
  };

  const toggleFilter = () => {
    setShowActivityFilters(!showActivityFilters);
  };

  // Add comment to activity
  const addComment = async (activityId: string, content: string) => {
    try {
      const comment = await enhancedActivityService.addComment(activityId, content);
      setActivityComments(prev => ({
        ...prev,
        [activityId]: [...(prev[activityId] || []), comment]
      }));
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <ActivityIcon className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Activity Timeline
          </h3>
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{activities.length} activities</span>
            <span>•</span>
            <span>{Math.ceil((new Date().getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days active</span>
            {currentVersion && (
              <>
                <span>•</span>
                <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  v{currentVersion}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <ModernButton
            variant="outline"
            size="sm"
            leftIcon={<Filter className="w-4 h-4" />}
            onClick={toggleFilter}
          >
            Filter
          </ModernButton>

          <ModernButton
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowAddEvent(true)}
          >
            Add Activity
          </ModernButton>
        </div>
      </div>

      {/* Activity Filters */}
      {showActivityFilters && (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Activity Types
              </label>
              <select
                multiple
                value={activityFilter.activityTypes || []}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  updateFilter({ activityTypes: values.length > 0 ? values : undefined });
                }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="created">Created</option>
                <option value="updated">Updated</option>
                <option value="stage_changed">Stage Changed</option>
                <option value="email_sent">Email Sent</option>
                <option value="meeting_scheduled">Meeting Scheduled</option>
                <option value="note_added">Note Added</option>
                <option value="task_completed">Task Completed</option>
                <option value="ai_analysis">AI Analysis</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={activityFilter.priorities?.[0] || ''}
                onChange={(e) => updateFilter({
                  priorities: e.target.value ? [e.target.value] : undefined
                })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={activityFilter.dateFrom || ''}
                onChange={(e) => updateFilter({ dateFrom: e.target.value || undefined })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date To
              </label>
              <input
                type="date"
                value={activityFilter.dateTo || ''}
                onChange={(e) => updateFilter({ dateTo: e.target.value || undefined })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {activitiesLoading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600 dark:text-gray-400">Loading activities...</span>
        </div>
      )}

      {/* Error state */}
      {activitiesError && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <span className="text-red-800 dark:text-red-300">{activitiesError}</span>
          </div>
        </div>
      )}

      {/* Activities Timeline */}
      {!activitiesLoading && !activitiesError && (
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No activities found. Start by adding your first activity!
            </div>
          ) : (
            activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.activityType);
              const isLast = index === activities.length - 1;
              const isExpanded = expandedActivities.has(activity.id);
              const comments = activityComments[activity.id] || [];

              return (
                <div key={activity.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="flex items-start space-x-4 p-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getActivityColor(activity.activityType, activity.status)}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      {!isLast && (
                        <div className="w-0.5 h-8 mt-2 bg-gray-200 dark:bg-gray-700" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            {activity.title}
                          </h4>
                          {activity.tags && activity.tags.map((tag: string) => (
                            <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                              <Tag className="w-3 h-3 mr-1" />
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(activity.createdAt).toLocaleDateString()} {new Date(activity.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                          <button
                            onClick={() => toggleActivityExpansion(activity.id)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {activity.description}
                      </p>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                          {activity.priority && (
                            <span className={`px-2 py-1 rounded ${
                              activity.priority === 'high' || activity.priority === 'critical'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                : activity.priority === 'medium'
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}>
                              {activity.priority}
                            </span>
                          )}
                          <span>{activity.activityType.replace('_', ' ')}</span>
                          {activity.userId && <span>by {activity.userId}</span>}
                          {comments.length > 0 && (
                            <span className="flex items-center">
                              <MessageSquare className="w-3 h-3 mr-1" />
                              {comments.length}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => addComment(activity.id, 'Great work on this activity!')}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs"
                        >
                          Add comment
                        </button>
                      </div>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          {/* Metadata */}
                          {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                            <div className="mb-4">
                              <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Details</h5>
                              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-xs text-gray-600 dark:text-gray-400">
                                <pre className="whitespace-pre-wrap">{JSON.stringify(activity.metadata, null, 2)}</pre>
                              </div>
                            </div>
                          )}

                          {/* Comments */}
                          <div className="space-y-3">
                            <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center">
                              <MessageSquare className="w-3 h-3 mr-1" />
                              Comments ({comments.length})
                            </h5>

                            {comments.length === 0 ? (
                              <p className="text-xs text-gray-500 dark:text-gray-400">No comments yet</p>
                            ) : (
                              comments.map((comment: any) => (
                                <div key={comment.id} className="flex space-x-2">
                                  <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-xs">
                                    {comment.userId?.[0] || 'U'}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs font-medium text-gray-900 dark:text-white">
                                        {comment.userId || 'Unknown User'}
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {new Date(comment.createdAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                                      {comment.content}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}

                            {/* Add comment input */}
                            <div className="flex space-x-2 mt-3">
                              <input
                                type="text"
                                placeholder="Add a comment..."
                                className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    const input = e.target as HTMLInputElement;
                                    if (input.value.trim()) {
                                      addComment(activity.id, input.value.trim());
                                      input.value = '';
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Activity Templates Quick Access */}
      {activityTemplates.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Quick Add from Templates</h4>
          <div className="flex flex-wrap gap-2">
            {activityTemplates.slice(0, 6).map((template: any) => (
              <button
                key={template.id}
                onClick={() => createActivityFromTemplate(template.id)}
                className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Activity Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-xl font-semibold text-gray-900 dark:text-white">Add Activity</h4>
              <button
                onClick={() => setShowAddEvent(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Activity Templates */}
              {activityTemplates.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Use Template (Optional)
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => {
                      setSelectedTemplate(e.target.value);
                      if (e.target.value) {
                        const template = activityTemplates.find(t => t.id === e.target.value);
                        if (template) {
                          setNewActivity(prev => ({
                            ...prev,
                            title: template.name,
                            description: template.description,
                            type: template.activity_type
                          }));
                        }
                      }
                    }}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Choose a template...</option>
                    {activityTemplates.map((template: any) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Activity Type
                </label>
                <select
                  value={newActivity.type}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="note_added">Note Added</option>
                  <option value="meeting_scheduled">Meeting Scheduled</option>
                  <option value="email_sent">Email Sent</option>
                  <option value="task_completed">Task Completed</option>
                  <option value="followup_created">Follow-up Created</option>
                  <option value="ai_analysis">AI Analysis</option>
                  <option value="attachment_added">Attachment Added</option>
                  <option value="contact_added">Contact Added</option>
                  <option value="stage_changed">Stage Changed</option>
                  <option value="updated">Updated</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={newActivity.title}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Brief title for this activity..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newActivity.description}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed description of this activity..."
                  rows={3}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={newActivity.priority}
                    onChange={(e) => setNewActivity(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={newActivity.tags.join(', ')}
                    onChange={(e) => setNewActivity(prev => ({
                      ...prev,
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                    }))}
                    placeholder="tag1, tag2, tag3"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
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
                onClick={createActivity}
                disabled={!newActivity.title.trim() || creatingActivity}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {creatingActivity && <RefreshCw className="w-4 h-4 animate-spin mr-2" />}
                Add Activity
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
  );
};