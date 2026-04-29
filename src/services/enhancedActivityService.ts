import { supabase } from '../supabaseService';
import { Deal } from '../../types';
import { Contact } from '../../types/contact';

export interface EnhancedActivity {
  id: string;
  dealId?: string;
  contactId?: string;
  userId?: string;
  activityType: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  durationMinutes?: number;
  relatedRecords?: Array<{type: string, id: string}>;
  aiInsights?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityComment {
  id: string;
  activityId: string;
  userId?: string;
  content: string;
  mentions?: string[];
  attachments?: any[];
  isInternal?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityFilter {
  activityTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
  priorities?: string[];
  statuses?: string[];
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface ActivitySubscription {
  id: string;
  userId: string;
  entityType: 'deal' | 'contact' | 'company';
  entityId: string;
  subscriptionType: 'all' | 'mentions' | 'high_priority' | 'none';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

class EnhancedActivityService {
  // Activity CRUD operations
  async createActivity(activity: Omit<EnhancedActivity, 'id' | 'createdAt' | 'updatedAt'>): Promise<EnhancedActivity> {
    const { data, error } = await supabase
      .from('enhanced_activities')
      .insert([{
        deal_id: activity.dealId,
        contact_id: activity.contactId,
        user_id: activity.userId,
        activity_type: activity.activityType,
        title: activity.title,
        description: activity.description,
        metadata: activity.metadata || {},
        tags: activity.tags || [],
        priority: activity.priority || 'medium',
        status: activity.status || 'completed',
        duration_minutes: activity.durationMinutes,
        related_records: activity.relatedRecords || [],
        ai_insights: activity.aiInsights || {}
      }])
      .select()
      .single();

    if (error) throw error;

    return this.transformActivity(data);
  }

  async getActivitiesForDeal(dealId: string, filter?: ActivityFilter): Promise<{
    activities: EnhancedActivity[];
    totalCount: number;
    hasMore: boolean;
  }> {
    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;

    // Use the database function for optimized querying
    const { data, error } = await supabase
      .rpc('get_deal_activities', {
        p_deal_id: dealId,
        p_limit: limit,
        p_offset: offset,
        p_activity_types: filter?.activityTypes || null,
        p_date_from: filter?.dateFrom || null,
        p_date_to: filter?.dateTo || null
      });

    if (error) throw error;

    // Apply additional client-side filtering if needed
    let activities = data || [];

    if (filter?.priorities && filter.priorities.length > 0) {
      activities = activities.filter(a => filter.priorities!.includes(a.priority));
    }

    if (filter?.statuses && filter.statuses.length > 0) {
      activities = activities.filter(a => filter.statuses!.includes(a.status));
    }

    if (filter?.tags && filter.tags.length > 0) {
      activities = activities.filter(a =>
        a.tags && a.tags.some(tag => filter.tags!.includes(tag))
      );
    }

    return {
      activities: activities.map(this.transformActivityFromFunction),
      totalCount: activities.length, // This is approximate since we're using a function
      hasMore: activities.length === limit
    };
  }

  async updateActivity(id: string, updates: Partial<EnhancedActivity>): Promise<EnhancedActivity> {
    const { data, error } = await supabase
      .from('enhanced_activities')
      .update({
        deal_id: updates.dealId,
        contact_id: updates.contactId,
        user_id: updates.userId,
        activity_type: updates.activityType,
        title: updates.title,
        description: updates.description,
        metadata: updates.metadata,
        tags: updates.tags,
        priority: updates.priority,
        status: updates.status,
        duration_minutes: updates.durationMinutes,
        related_records: updates.relatedRecords,
        ai_insights: updates.aiInsights,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.transformActivity(data);
  }

  async deleteActivity(id: string): Promise<void> {
    const { error } = await supabase
      .from('enhanced_activities')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Activity comments
  async addComment(activityId: string, content: string, options?: {
    mentions?: string[];
    attachments?: any[];
    isInternal?: boolean;
  }): Promise<ActivityComment> {
    const { data, error } = await supabase
      .from('activity_comments')
      .insert([{
        activity_id: activityId,
        content,
        mentions: options?.mentions || [],
        attachments: options?.attachments || [],
        is_internal: options?.isInternal || false
      }])
      .select()
      .single();

    if (error) throw error;

    return this.transformComment(data);
  }

  async getComments(activityId: string): Promise<ActivityComment[]> {
    const { data, error } = await supabase
      .from('activity_comments')
      .select('*')
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(this.transformComment);
  }

  // Activity templates
  async getActivityTemplates(): Promise<any[]> {
    const { data, error } = await supabase
      .from('activity_templates')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    return data || [];
  }

  async createActivityFromTemplate(templateId: string, dealId: string, contactId?: string): Promise<EnhancedActivity> {
    const { data: template, error: templateError } = await supabase
      .from('activity_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError) throw templateError;

    return this.createActivity({
      dealId,
      contactId,
      activityType: template.activity_type,
      title: template.name,
      description: template.description,
      metadata: template.default_metadata,
      tags: ['template-generated']
    });
  }

  // Real-time synchronization
  async getSyncVersion(entityType: 'deal' | 'contact' | 'activity', entityId: string): Promise<number> {
    const { data, error } = await supabase
      .from('realtime_sync_status')
      .select('last_sync_version')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

    return data?.last_sync_version || 0;
  }

  async incrementSyncVersion(entityType: 'deal' | 'contact' | 'activity', entityId: string): Promise<number> {
    const { data, error } = await supabase
      .rpc('increment_sync_version', {
        entity_type: entityType,
        entity_id: entityId
      });

    if (error) throw error;

    return data;
  }

  // Activity subscriptions
  async getSubscriptions(userId: string): Promise<ActivitySubscription[]> {
    const { data, error } = await supabase
      .from('activity_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;

    return (data || []).map(this.transformSubscription);
  }

  async updateSubscription(subscriptionId: string, updates: Partial<ActivitySubscription>): Promise<ActivitySubscription> {
    const { data, error } = await supabase
      .from('activity_subscriptions')
      .update({
        subscription_type: updates.subscriptionType,
        is_active: updates.isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) throw error;

    return this.transformSubscription(data);
  }

  // Bulk operations
  async createBulkActivities(activities: Array<Omit<EnhancedActivity, 'id' | 'createdAt' | 'updatedAt'>>): Promise<EnhancedActivity[]> {
    const { data, error } = await supabase
      .from('enhanced_activities')
      .insert(activities.map(activity => ({
        deal_id: activity.dealId,
        contact_id: activity.contactId,
        user_id: activity.userId,
        activity_type: activity.activityType,
        title: activity.title,
        description: activity.description,
        metadata: activity.metadata || {},
        tags: activity.tags || [],
        priority: activity.priority || 'medium',
        status: activity.status || 'completed',
        duration_minutes: activity.durationMinutes,
        related_records: activity.relatedRecords || [],
        ai_insights: activity.aiInsights || {}
      })))
      .select();

    if (error) throw error;

    return (data || []).map(this.transformActivity);
  }

  // Analytics and insights
  async getActivityStats(dealId: string, dateRange?: { from: string; to: string }): Promise<{
    totalActivities: number;
    activitiesByType: Record<string, number>;
    activitiesByPriority: Record<string, number>;
    recentActivity: EnhancedActivity[];
    avgActivitiesPerDay: number;
  }> {
    const { data, error } = await supabase
      .from('enhanced_activities')
      .select('*')
      .eq('deal_id', dealId)
      .gte('created_at', dateRange?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .lte('created_at', dateRange?.to || new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const activities = (data || []).map(this.transformActivity);
    const activitiesByType: Record<string, number> = {};
    const activitiesByPriority: Record<string, number> = {};

    activities.forEach(activity => {
      activitiesByType[activity.activityType] = (activitiesByType[activity.activityType] || 0) + 1;
      activitiesByPriority[activity.priority || 'medium'] = (activitiesByPriority[activity.priority || 'medium'] || 0) + 1;
    });

    const daysDiff = dateRange
      ? Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24))
      : 30;

    return {
      totalActivities: activities.length,
      activitiesByType,
      activitiesByPriority,
      recentActivity: activities.slice(0, 10),
      avgActivitiesPerDay: activities.length / daysDiff
    };
  }

  // Transform functions
  private transformActivity(data: any): EnhancedActivity {
    return {
      id: data.id,
      dealId: data.deal_id,
      contactId: data.contact_id,
      userId: data.user_id,
      activityType: data.activity_type,
      title: data.title,
      description: data.description,
      metadata: data.metadata,
      tags: data.tags,
      priority: data.priority,
      status: data.status,
      durationMinutes: data.duration_minutes,
      relatedRecords: data.related_records,
      aiInsights: data.ai_insights,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  private transformActivityFromFunction(data: any): EnhancedActivity {
    return {
      id: data.id,
      activityType: data.activity_type,
      title: data.title,
      description: data.description,
      metadata: data.metadata,
      tags: data.tags,
      priority: data.priority,
      status: data.status,
      createdAt: data.created_at,
      userId: data.user_name // This comes from the function
    };
  }

  private transformComment(data: any): ActivityComment {
    return {
      id: data.id,
      activityId: data.activity_id,
      userId: data.user_id,
      content: data.content,
      mentions: data.mentions,
      attachments: data.attachments,
      isInternal: data.is_internal,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  private transformSubscription(data: any): ActivitySubscription {
    return {
      id: data.id,
      userId: data.user_id,
      entityType: data.entity_type,
      entityId: data.entity_id,
      subscriptionType: data.subscription_type,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
}

export const enhancedActivityService = new EnhancedActivityService();