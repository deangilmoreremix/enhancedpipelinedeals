import React, { useState, useEffect } from 'react';
import { DealActivity } from '../../types';
import { getDealActivities } from '../../services/dealTimelineService';
import { Clock, User, Mail, Phone, Calendar, FileText, Paperclip, MoreHorizontal, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DealTimelineProps {
  dealId: string;
  isLoading?: boolean;
  maxItems?: number;
  showFilters?: boolean;
}

const DealTimeline: React.FC<DealTimelineProps> = ({
  dealId,
  isLoading = false,
  maxItems = 20,
  showFilters = false
}) => {
  const [activities, setActivities] = useState<DealActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<DealActivity[]>([]);
  const [loading, setLoading] = useState(isLoading);
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    loadActivities();
  }, [dealId]);

  useEffect(() => {
    filterActivities();
  }, [activities, selectedType]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const data = await getDealActivities(dealId, maxItems * 2); // Load more for filtering
      setActivities(data);
    } catch (error) {
      console.error('Error loading deal activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterActivities = () => {
    if (selectedType === 'all') {
      setFilteredActivities(activities.slice(0, maxItems));
    } else {
      const filtered = activities.filter(activity => activity.type === selectedType);
      setFilteredActivities(filtered.slice(0, maxItems));
    }
  };

  const getActivityIcon = (type: DealActivity['type']) => {
    switch (type) {
      case 'created': return <FileText className="w-4 h-4" />;
      case 'updated': return <FileText className="w-4 h-4" />;
      case 'stage_changed': return <TrendingUp className="w-4 h-4" />;
      case 'contact_added': return <User className="w-4 h-4" />;
      case 'email_sent': return <Mail className="w-4 h-4" />;
      case 'meeting_scheduled': return <Calendar className="w-4 h-4" />;
      case 'note_added': return <FileText className="w-4 h-4" />;
      case 'attachment_added': return <Paperclip className="w-4 h-4" />;
      case 'bulk_action': return <MoreHorizontal className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: DealActivity['type']) => {
    switch (type) {
      case 'created': return 'bg-blue-100 text-blue-600';
      case 'stage_changed': return 'bg-green-100 text-green-600';
      case 'email_sent': return 'bg-purple-100 text-purple-600';
      case 'meeting_scheduled': return 'bg-orange-100 text-orange-600';
      case 'bulk_action': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getActivityTypeLabel = (type: DealActivity['type']) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const activityTypes = Array.from(new Set(activities.map(a => a.type)));

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex space-x-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Deal Timeline
          </h3>
          {showFilters && activityTypes.length > 1 && (
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="all">All Activities</option>
              {activityTypes.map(type => (
                <option key={type} value={type}>
                  {getActivityTypeLabel(type)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="p-4">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No activities found</p>
            {selectedType !== 'all' && (
              <p className="text-sm">Try selecting "All Activities" to see all timeline events</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredActivities.map((activity, index) => (
              <div key={activity.id} className="flex space-x-3">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  {index < filteredActivities.length - 1 && (
                    <div className="w-0.5 h-12 bg-gray-200 mt-2"></div>
                  )}
                </div>

                {/* Activity content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        {activity.title}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {activity.description}
                      </p>
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          {Object.entries(activity.metadata).map(([key, value]) => (
                            <span key={key} className="mr-3">
                              {key}: {String(value)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 ml-4">
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  {activity.createdBy && (
                    <div className="text-xs text-gray-500 mt-1">
                      by {activity.createdBy}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activities.length > maxItems && filteredActivities.length === maxItems && (
          <div className="text-center mt-4">
            <button
              onClick={() => setFilteredActivities(activities)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Load more activities
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DealTimeline;