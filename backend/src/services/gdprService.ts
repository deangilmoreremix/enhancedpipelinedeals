import { supabase } from './database';
import { GDPRRequest, DataRetentionPolicy, DataProcessingRecord } from '../types/index';
import { featureFlags } from '../features/flags';
import { auditService } from './auditService';

export class GDPRService {
  /**
   * Submit a GDPR request
   */
  async submitGDPRRequest(
    userId: string,
    workspaceId: string,
    requestType: GDPRRequest['requestType'],
    notes?: string
  ): Promise<GDPRRequest> {
    if (!featureFlags.isEnabled('gdpr_compliance')) {
      throw new Error('GDPR compliance features are not enabled');
    }

    const request: GDPRRequest = {
      id: crypto.randomUUID(),
      userId,
      workspaceId,
      requestType,
      status: 'pending',
      requestedAt: new Date(),
      notes,
    };

    const { error } = await supabase
      .from('gdpr_requests')
      .insert([{
        id: request.id,
        user_id: request.userId,
        workspace_id: request.workspaceId,
        request_type: request.requestType,
        status: request.status,
        requested_at: request.requestedAt.toISOString(),
        notes: request.notes,
      }]);

    if (error) throw error;

    // Log the GDPR request
    await auditService.logEvent(
      'gdpr_request',
      userId,
      workspaceId,
      'gdpr',
      'request_submitted',
      { requestType, requestId: request.id },
      request.id
    );

    return request;
  }

  /**
   * Get GDPR requests for a user
   */
  async getUserGDPRRequests(userId: string, workspaceId: string): Promise<GDPRRequest[]> {
    const { data, error } = await supabase
      .from('gdpr_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .order('requested_at', { ascending: false });

    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      requestType: row.request_type,
      status: row.status,
      data: row.data,
      requestedAt: new Date(row.requested_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      completedBy: row.completed_by,
      notes: row.notes,
    }));
  }

  /**
   * Process a GDPR request
   */
  async processGDPRRequest(
    requestId: string,
    status: 'processing' | 'completed' | 'rejected',
    processedBy: string,
    data?: any,
    notes?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      completed_at: status === 'completed' || status === 'rejected' ? new Date().toISOString() : null,
      completed_by: processedBy,
      notes,
    };

    if (data) updateData.data = data;

    const { error } = await supabase
      .from('gdpr_requests')
      .update(updateData)
      .eq('id', requestId);

    if (error) throw error;

    // Log the processing
    await auditService.logEvent(
      'gdpr_request',
      processedBy,
      '', // We'll need to get workspace from request
      'gdpr',
      'request_processed',
      { requestId, status, notes },
      requestId
    );
  }

  /**
   * Handle right to access request
   */
  async handleAccessRequest(userId: string, workspaceId: string): Promise<any> {
    // Gather all user data
    const userData = {
      profile: await this.getUserProfile(userId),
      deals: await this.getUserDeals(userId, workspaceId),
      activities: await this.getUserActivities(userId, workspaceId),
      auditLogs: await auditService.getGDPRComplianceEvents(workspaceId, userId, new Date(2020, 0, 1), new Date()),
    };

    return userData;
  }

  /**
   * Handle right to rectification request
   */
  async handleRectificationRequest(
    userId: string,
    workspaceId: string,
    corrections: Record<string, any>
  ): Promise<void> {
    // Update user profile
    if (corrections.profile) {
      await supabase
        .from('users')
        .update(corrections.profile)
        .eq('id', userId);
    }

    // Update deals if specified
    if (corrections.deals) {
      for (const dealUpdate of corrections.deals) {
        await supabase
          .from('deals')
          .update(dealUpdate.data)
          .eq('id', dealUpdate.id)
          .eq('workspace_id', workspaceId);
      }
    }

    await auditService.logEvent(
      'data_modify',
      userId,
      workspaceId,
      'user_data',
      'rectify',
      corrections
    );
  }

  /**
   * Handle right to erasure request
   */
  async handleErasureRequest(userId: string, workspaceId: string): Promise<void> {
    // Anonymize or delete user data based on retention policies
    const retentionPolicy = await this.getRetentionPolicy(workspaceId, 'contacts');

    if (retentionPolicy?.deletionMethod === 'anonymize') {
      // Anonymize user data
      await this.anonymizeUserData(userId, workspaceId);
    } else {
      // Delete user data
      await this.deleteUserData(userId, workspaceId);
    }

    await auditService.logEvent(
      'data_delete',
      userId,
      workspaceId,
      'user_data',
      'erase',
      { method: retentionPolicy?.deletionMethod || 'hard_delete' }
    );
  }

  /**
   * Handle right to data portability request
   */
  async handlePortabilityRequest(userId: string, workspaceId: string): Promise<any> {
    const userData = await this.handleAccessRequest(userId, workspaceId);

    // Convert to portable format (JSON)
    const portableData = {
      exportDate: new Date().toISOString(),
      userId,
      workspaceId,
      data: userData,
      format: 'JSON',
      version: '1.0',
    };

    return portableData;
  }

  /**
   * Handle right to restriction request
   */
  async handleRestrictionRequest(userId: string, workspaceId: string, restrict: boolean): Promise<void> {
    // Implement data processing restriction
    // This might involve setting a flag on the user record
    await supabase
      .from('users')
      .update({
        data_processing_restricted: restrict,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    await auditService.logEvent(
      'data_modify',
      userId,
      workspaceId,
      'user_data',
      restrict ? 'restrict_processing' : 'lift_restriction',
      {}
    );
  }

  /**
   * Create data retention policy
   */
  async createRetentionPolicy(
    name: string,
    description: string,
    entityType: DataRetentionPolicy['entityType'],
    retentionPeriod: number,
    deletionMethod: DataRetentionPolicy['deletionMethod'],
    conditions: Record<string, any>,
    workspaceId: string,
    createdBy: string
  ): Promise<DataRetentionPolicy> {
    const policy: DataRetentionPolicy = {
      id: crypto.randomUUID(),
      name,
      description,
      entityType,
      retentionPeriod,
      deletionMethod,
      conditions,
      isActive: true,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { error } = await supabase
      .from('data_retention_policies')
      .insert([{
        id: policy.id,
        name: policy.name,
        description: policy.description,
        entity_type: policy.entityType,
        retention_period: policy.retentionPeriod,
        deletion_method: policy.deletionMethod,
        conditions: policy.conditions,
        is_active: policy.isActive,
        created_by: policy.createdBy,
        created_at: policy.createdAt.toISOString(),
        updated_at: policy.updatedAt.toISOString(),
      }]);

    if (error) throw error;
    return policy;
  }

  /**
   * Get retention policies for a workspace
   */
  async getRetentionPolicies(workspaceId: string): Promise<DataRetentionPolicy[]> {
    const { data, error } = await supabase
      .from('data_retention_policies')
      .select('*')
      .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
      .eq('is_active', true);

    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      entityType: row.entity_type,
      retentionPeriod: row.retention_period,
      deletionMethod: row.deletion_method,
      conditions: row.conditions || {},
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Apply data retention policies
   */
  async applyRetentionPolicies(): Promise<void> {
    const policies = await this.getRetentionPolicies('');

    for (const policy of policies) {
      await this.applyRetentionPolicy(policy);
    }
  }

  /**
   * Create data processing record for GDPR Article 30
   */
  async createProcessingRecord(
    purpose: string,
    legalBasis: DataProcessingRecord['legalBasis'],
    dataCategories: string[],
    recipients: string[],
    retentionPeriod: number,
    securityMeasures: string[],
    workspaceId: string
  ): Promise<DataProcessingRecord> {
    const record: DataProcessingRecord = {
      id: crypto.randomUUID(),
      purpose,
      legalBasis,
      dataCategories,
      recipients,
      retentionPeriod,
      securityMeasures,
      workspaceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { error } = await supabase
      .from('data_processing_records')
      .insert([{
        id: record.id,
        purpose: record.purpose,
        legal_basis: record.legalBasis,
        data_categories: record.dataCategories,
        recipients: record.recipients,
        retention_period: record.retentionPeriod,
        security_measures: record.securityMeasures,
        workspace_id: record.workspaceId,
        created_at: record.createdAt.toISOString(),
        updated_at: record.updatedAt.toISOString(),
      }]);

    if (error) throw error;
    return record;
  }

  /**
   * Get data processing records for a workspace
   */
  async getProcessingRecords(workspaceId: string): Promise<DataProcessingRecord[]> {
    const { data, error } = await supabase
      .from('data_processing_records')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      purpose: row.purpose,
      legalBasis: row.legal_basis,
      dataCategories: row.data_categories,
      recipients: row.recipients,
      retentionPeriod: row.retention_period,
      securityMeasures: row.security_measures,
      workspaceId: row.workspace_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  // Private helper methods

  private async getUserProfile(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  private async getUserDeals(userId: string, workspaceId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('workspace_id', workspaceId)
      .or(`assigned_to_id.eq.${userId},created_by.eq.${userId}`);

    if (error) throw error;
    return data;
  }

  private async getUserActivities(userId: string, workspaceId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('deal_activities')
      .select('*')
      .eq('created_by', userId);

    if (error) throw error;
    return data;
  }

  private async getRetentionPolicy(workspaceId: string, entityType: string): Promise<DataRetentionPolicy | null> {
    const policies = await this.getRetentionPolicies(workspaceId);
    return policies.find(p => p.entityType === entityType) || null;
  }

  private async applyRetentionPolicy(policy: DataRetentionPolicy): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriod);

    let tableName: string;
    let dateField: string;

    switch (policy.entityType) {
      case 'deals':
        tableName = 'deals';
        dateField = 'created_at';
        break;
      case 'contacts':
        tableName = 'contacts';
        dateField = 'created_at';
        break;
      case 'activities':
        tableName = 'deal_activities';
        dateField = 'created_at';
        break;
      case 'audit_logs':
        tableName = 'audit_events';
        dateField = 'timestamp';
        break;
      default:
        return;
    }

    if (policy.deletionMethod === 'hard_delete') {
      await supabase
        .from(tableName)
        .delete()
        .lt(dateField, cutoffDate.toISOString());
    } else if (policy.deletionMethod === 'anonymize') {
      // Implement anonymization logic based on entity type
      await this.anonymizeOldData(tableName, dateField, cutoffDate);
    }
  }

  private async anonymizeUserData(userId: string, workspaceId: string): Promise<void> {
    // Anonymize user profile
    await supabase
      .from('users')
      .update({
        name: 'Anonymous User',
        email: `anonymous-${userId}@deleted.local`,
        avatar: null,
        custom_fields: {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // Anonymize deals
    await supabase
      .from('deals')
      .update({
        company: 'Anonymous Company',
        contact: 'Anonymous Contact',
        notes: null,
        custom_fields: {},
      })
      .eq('workspace_id', workspaceId)
      .or(`assigned_to_id.eq.${userId},created_by.eq.${userId}`);
  }

  private async deleteUserData(userId: string, workspaceId: string): Promise<void> {
    // Delete user data in correct order (respecting foreign keys)
    await supabase.from('user_roles').delete().eq('user_id', userId);
    await supabase.from('gdpr_requests').delete().eq('user_id', userId);
    await supabase.from('export_requests').delete().eq('user_id', userId);

    // Anonymize deals instead of deleting (to maintain referential integrity)
    await this.anonymizeUserData(userId, workspaceId);
  }

  private async anonymizeOldData(tableName: string, dateField: string, cutoffDate: Date): Promise<void> {
    // Implement table-specific anonymization
    const anonymizationRules: Record<string, Record<string, any>> = {
      deals: {
        company: 'Anonymous Company',
        contact: 'Anonymous Contact',
        notes: null,
        custom_fields: {},
      },
      contacts: {
        name: 'Anonymous Contact',
        email: 'anonymous@deleted.local',
        phone: null,
        custom_fields: {},
      },
      deal_activities: {
        description: 'Activity data anonymized',
        metadata: {},
      },
    };

    const rules = anonymizationRules[tableName];
    if (rules) {
      await supabase
        .from(tableName)
        .update({ ...rules, updated_at: new Date().toISOString() })
        .lt(dateField, cutoffDate.toISOString());
    }
  }
}

export const gdprService = new GDPRService();