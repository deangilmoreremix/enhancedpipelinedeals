import { supabase, isSupabaseConfigured } from './supabaseService';
import { Deal } from '../types';
import { Contact } from '../types/contact';
import { assertRowsAffected } from '../utils/rlsError';
import { getCurrentUserId, isUuid } from './dealRecordShared';

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
  /**
   * Deal-scoped activities are written to `deal_activities` (clients have RLS write access there; the
   * richer fields ride in `metadata`). Activities without a deal go to `enhanced_activities`.
   */
  async createActivity(activity: Omit<EnhancedActivity, 'id' | 'createdAt' | 'updatedAt'>): Promise<EnhancedActivity> {
    if (activity.dealId) {
      const uid = await getCurrentUserId();
      const { data, error } = await supabase
        .from('deal_activities')
        .insert(this.toDealActivityRow(activity, uid))
        .select()
        .single();
      if (error) throw error;
      return this.transformDealActivity(data);
    }
    const { data, error } = await supabase
      .from('enhanced_activities')
      .insert([this.toEnhancedRow(activity)])
      .select()
      .single();

    if (error) throw error;

    return this.transformActivity(data);
  }

  private toEnhancedRow(activity: Partial<EnhancedActivity>) {
    return {
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
    };
  }

  /** EnhancedActivity -> deal_activities row (only real columns; extras live in metadata). */
  toDealActivityRow(activity: Partial<EnhancedActivity>, uid?: string | null) {
    return {
      deal_id: activity.dealId,
      type: activity.activityType,
      title: activity.title,
      description: activity.description,
      metadata: {
        ...(activity.metadata || {}),
        tags: activity.tags || [],
        priority: activity.priority || 'medium',
        status: activity.status || 'completed',
        durationMinutes: activity.durationMinutes,
        relatedRecords: activity.relatedRecords || [],
        aiInsights: activity.aiInsights || {},
        contactId: activity.contactId
      },
      ...(isUuid(uid ?? undefined) ? { created_by: uid } : {})
    };
  }

  async getActivitiesForDeal(dealId: string, filter?: ActivityFilter): Promise<{
    activities: EnhancedActivity[];
    totalCount: number;
    hasMore: boolean;
  }> {
    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;

    if (!isSupabaseConfigured) {
      return { activities: [], totalCount: 0, hasMore: false };
    }

    try {
      let query = supabase
        .from('deal_activities')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(offset + limit);
      if (filter?.activityTypes?.length) query = query.in('type', filter.activityTypes);
      if (filter?.dateFrom) query = query.gte('created_at', filter.dateFrom);
      if (filter?.dateTo) query = query.lte('created_at', filter.dateTo);

      // Legacy rows written to enhanced_activities before this change are merged in read-only
      let legacyQ = supabase
        .from('enhanced_activities')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(offset + limit);
      if (filter?.activityTypes?.length) legacyQ = legacyQ.in('activity_type', filter.activityTypes);
      if (filter?.dateFrom) legacyQ = legacyQ.gte('created_at', filter.dateFrom);
      if (filter?.dateTo) legacyQ = legacyQ.lte('created_at', filter.dateTo);

      const [primary, legacy] = await Promise.all([query, legacyQ]);
      if (primary.error) throw primary.error;
      if (legacy.error) console.warn('Legacy enhanced_activities read failed:', legacy.error);

      let activities = [
        ...(primary.data || []).map(r => this.transformDealActivity(r)),
        ...((legacy.error ? [] : legacy.data) || []).map(r => this.transformActivity(r)),
      ].sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || ''));

      if (filter?.priorities?.length) activities = activities.filter(a => filter.priorities!.includes(a.priority as string));
      if (filter?.statuses?.length) activities = activities.filter(a => filter.statuses!.includes(a.status as string));
      if (filter?.tags?.length) activities = activities.filter(a => a.tags?.some(t => filter.tags!.includes(t)));

      const page = activities.slice(offset, offset + limit);
      return {
        activities: page,
        totalCount: activities.length,
        hasMore: activities.length > offset + limit
      };
    } catch (error) {
      console.warn('Could not load deal activities:', error);
      return { activities: [], totalCount: 0, hasMore: false };
    }
  }

  async updateActivity(id: string, updates: Partial<EnhancedActivity>): Promise<EnhancedActivity> {
    // Newer rows live in deal_activities; fall back to the legacy table when the id is not there
    const dealPatch: Record<string, unknown> = {};
    if (updates.activityType !== undefined) dealPatch.type = updates.activityType;
    if (updates.title !== undefined) dealPatch.title = updates.title;
    if (updates.description !== undefined) dealPatch.description = updates.description;
    const extras: Record<string, unknown> = {
      ...(updates.metadata || {}),
      ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
      ...(updates.priority !== undefined ? { priority: updates.priority } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.durationMinutes !== undefined ? { durationMinutes: updates.durationMinutes } : {}),
      ...(updates.relatedRecords !== undefined ? { relatedRecords: updates.relatedRecords } : {}),
      ...(updates.aiInsights !== undefined ? { aiInsights: updates.aiInsights } : {}),
    };
    if (Object.keys(extras).length > 0) {
      const { data: cur } = await supabase.from('deal_activities').select('metadata').eq('id', id).maybeSingle();
      dealPatch.metadata = { ...((cur?.metadata as Record<string, unknown>) || {}), ...extras };
    }
    if (Object.keys(dealPatch).length > 0) {
      const { data, error } = await supabase.from('deal_activities').update(dealPatch).eq('id', id).select();
      if (error) throw error;
      if (data && data.length > 0) return this.transformDealActivity(data[0]);
    }

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
      .select();

    if (error) throw error;
    assertRowsAffected(data); // RLS filters UPDATEs silently

    return this.transformActivity(data![0]);
  }

  async deleteActivity(id: string): Promise<void> {
    const primary = await supabase.from('deal_activities').delete().eq('id', id).select('id');
    if (primary.error) throw primary.error;
    if (primary.data && primary.data.length > 0) return;
    const { data, error } = await supabase.from('enhanced_activities').delete().eq('id', id).select('id');
    if (error) throw error;
    assertRowsAffected(data);
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
    const dealOnes = activities.filter(a => a.dealId);
    const others = activities.filter(a => !a.dealId);
    const out: EnhancedActivity[] = [];
    if (dealOnes.length) {
      const uid = await getCurrentUserId();
      const { data, error } = await supabase
        .from('deal_activities')
        .insert(dealOnes.map(a => this.toDealActivityRow(a, uid)))
        .select();
      if (error) throw error;
      out.push(...(data || []).map(r => this.transformDealActivity(r)));
    }
    if (others.length) {
      const { data, error } = await supabase
        .from('enhanced_activities')
        .insert(others.map(a => this.toEnhancedRow(a)))
        .select();
      if (error) throw error;
      out.push(...(data || []).map(r => this.transformActivity(r)));
    }
    return out;
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
      .from('deal_activities')
      .select('*')
      .eq('deal_id', dealId)
      .gte('created_at', dateRange?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .lte('created_at', dateRange?.to || new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const activities = (data || []).map(r => this.transformDealActivity(r));
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

  /** deal_activities row -> EnhancedActivity (extras are stored in metadata). */
  private transformDealActivity(data: any): EnhancedActivity {
    const m = (data.metadata || {}) as Record<string, any>;
    return {
      id: data.id,
      dealId: data.deal_id,
      contactId: m.contactId,
      userId: data.created_by ?? undefined,
      activityType: data.type,
      title: data.title ?? data.type,
      description: data.description ?? undefined,
      metadata: m,
      tags: m.tags,
      priority: m.priority,
      status: m.status,
      durationMinutes: m.durationMinutes,
      relatedRecords: m.relatedRecords,
      aiInsights: m.aiInsights,
      createdAt: data.created_at,
      updatedAt: data.updated_at ?? data.created_at
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