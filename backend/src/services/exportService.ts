import { supabase } from './database';
import { ExportRequest, ExportPolicy } from '../types';
import { featureFlags } from '../features/flags';
import { auditService } from './auditService';
import { permissionService } from './permissionService';

export class ExportService {
  /**
   * Request data export
   */
  async requestExport(
    userId: string,
    workspaceId: string,
    entityType: ExportRequest['entityType'],
    filters: any[] = [],
    fields: string[] = [],
    format: ExportRequest['format'] = 'csv'
  ): Promise<ExportRequest> {
    if (!featureFlags.isEnabled('data_export_controls')) {
      throw new Error('Data export controls are not enabled');
    }

    // Check export permissions
    const hasPermission = await permissionService.hasPermission(
      userId,
      workspaceId,
      'exports',
      'create'
    );

    if (!hasPermission) {
      throw new Error('Insufficient permissions for data export');
    }

    // Check export policy
    const policy = await this.getExportPolicy(workspaceId, entityType);
    if (policy) {
      await this.validateExportAgainstPolicy(userId, policy, fields.length);
    }

    const exportRequest: ExportRequest = {
      id: crypto.randomUUID(),
      userId,
      workspaceId,
      entityType,
      filters,
      fields,
      format,
      status: 'pending',
      requestedAt: new Date(),
    };

    const { error } = await supabase
      .from('export_requests')
      .insert([{
        id: exportRequest.id,
        user_id: exportRequest.userId,
        workspace_id: exportRequest.workspaceId,
        entity_type: exportRequest.entityType,
        filters: exportRequest.filters,
        fields: exportRequest.fields,
        format: exportRequest.format,
        status: exportRequest.status,
        requested_at: exportRequest.requestedAt.toISOString(),
      }]);

    if (error) throw error;

    // Log the export request
    await auditService.logEvent(
      'export_request',
      userId,
      workspaceId,
      'exports',
      'request',
      { entityType, format, recordCount: 0 },
      exportRequest.id
    );

    // Start processing the export asynchronously
    this.processExport(exportRequest);

    return exportRequest;
  }

  /**
   * Get export requests for a user
   */
  async getUserExportRequests(userId: string, workspaceId: string): Promise<ExportRequest[]> {
    const { data, error } = await supabase
      .from('export_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .order('requested_at', { ascending: false });

    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      entityType: row.entity_type,
      filters: row.filters || [],
      fields: row.fields || [],
      format: row.format,
      status: row.status,
      fileUrl: row.file_url,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      requestedAt: new Date(row.requested_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      recordCount: row.record_count,
      fileSize: row.file_size,
    }));
  }

  /**
   * Get export request by ID
   */
  async getExportRequest(requestId: string): Promise<ExportRequest | null> {
    const { data, error } = await supabase
      .from('export_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) return null;

    return {
      id: data.id,
      userId: data.user_id,
      workspaceId: data.workspace_id,
      entityType: data.entity_type,
      filters: data.filters || [],
      fields: data.fields || [],
      format: data.format,
      status: data.status,
      fileUrl: data.file_url,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      requestedAt: new Date(data.requested_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      recordCount: data.record_count,
      fileSize: data.file_size,
    };
  }

  /**
   * Create export policy
   */
  async createExportPolicy(
    name: string,
    description: string,
    entityType: string,
    maxRecords: number,
    maxFileSize: number,
    allowedFormats: string[],
    requiresApproval: boolean,
    approvalRoles: string[],
    retentionPeriod: number,
    rateLimit: { requests: number; period: number },
    workspaceId: string,
    createdBy: string
  ): Promise<ExportPolicy> {
    const policy: ExportPolicy = {
      id: crypto.randomUUID(),
      name,
      description,
      entityType,
      maxRecords,
      maxFileSize,
      allowedFormats,
      requiresApproval,
      approvalRoles,
      retentionPeriod,
      rateLimit,
      isActive: true,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { error } = await supabase
      .from('export_policies')
      .insert([{
        id: policy.id,
        name: policy.name,
        description: policy.description,
        entity_type: policy.entityType,
        max_records: policy.maxRecords,
        max_file_size: policy.maxFileSize,
        allowed_formats: policy.allowedFormats,
        requires_approval: policy.requiresApproval,
        approval_roles: policy.approvalRoles,
        retention_period: policy.retentionPeriod,
        rate_limit: policy.rateLimit,
        is_active: policy.isActive,
        created_by: policy.createdBy,
        created_at: policy.createdAt.toISOString(),
        updated_at: policy.updatedAt.toISOString(),
      }]);

    if (error) throw error;
    return policy;
  }

  /**
   * Get export policies for a workspace
   */
  async getExportPolicies(workspaceId: string): Promise<ExportPolicy[]> {
    const { data, error } = await supabase
      .from('export_policies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      entityType: row.entity_type,
      maxRecords: row.max_records,
      maxFileSize: row.max_file_size,
      allowedFormats: row.allowed_formats || [],
      requiresApproval: row.requires_approval,
      approvalRoles: row.approval_roles || [],
      retentionPeriod: row.retention_period,
      rateLimit: row.rate_limit || { requests: 10, period: 60 },
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Approve export request
   */
  async approveExportRequest(requestId: string, approvedBy: string): Promise<void> {
    const { error } = await supabase
      .from('export_requests')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) throw error;

    await auditService.logEvent(
      'export_request',
      approvedBy,
      '',
      'exports',
      'approve',
      { requestId },
      requestId
    );
  }

  /**
   * Reject export request
   */
  async rejectExportRequest(requestId: string, rejectedBy: string, reason?: string): Promise<void> {
    const { error } = await supabase
      .from('export_requests')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) throw error;

    await auditService.logEvent(
      'export_request',
      rejectedBy,
      '',
      'exports',
      'reject',
      { requestId, reason },
      requestId
    );
  }

  // Private methods

  private async getExportPolicy(workspaceId: string, entityType: string): Promise<ExportPolicy | null> {
    const policies = await this.getExportPolicies(workspaceId);
    return policies.find(p => p.entityType === entityType) || null;
  }

  private async validateExportAgainstPolicy(
    userId: string,
    policy: ExportPolicy,
    fieldCount: number
  ): Promise<void> {
    // Check rate limits
    const recentExports = await this.getRecentExports(userId, policy.rateLimit.period);
    if (recentExports >= policy.rateLimit.requests) {
      throw new Error('Export rate limit exceeded');
    }

    // Check if approval is required
    if (policy.requiresApproval) {
      // Check if user has required role for auto-approval
      const userRoles = await permissionService.getUserRoles(userId, ''); // Need workspace ID
      const hasApprovalRole = userRoles.some(role =>
        policy.approvalRoles.includes(role.roleId)
      );

      if (!hasApprovalRole) {
        throw new Error('Export requires approval');
      }
    }
  }

  private async getRecentExports(userId: string, minutes: number): Promise<number> {
    const since = new Date();
    since.setMinutes(since.getMinutes() - minutes);

    const { count, error } = await supabase
      .from('export_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('requested_at', since.toISOString());

    if (error) throw error;
    return count || 0;
  }

  private async processExport(exportRequest: ExportRequest): Promise<void> {
    try {
      // Update status to processing
      await supabase
        .from('export_requests')
        .update({ status: 'processing' })
        .eq('id', exportRequest.id);

      // Get data based on entity type
      let data: any[] = [];
      let query = supabase.from(exportRequest.entityType);

      // Apply filters
      for (const filter of exportRequest.filters) {
        if (filter.operator === 'equals') {
          query = (query as any).eq(filter.field, filter.value);
        } else if (filter.operator === 'contains') {
          query = (query as any).ilike(filter.field, `%${filter.value}%`);
        }
        // Add more filter operators as needed
      }

      // Apply workspace filter for security
      if (exportRequest.entityType === 'deals' || exportRequest.entityType === 'contacts') {
        query = (query as any).eq('workspace_id', exportRequest.workspaceId);
      }

      const { data: queryData, error } = await query.select(
        exportRequest.fields.length > 0 ? exportRequest.fields.join(',') : '*'
      );

      if (error) throw error;
      data = queryData;

      // Generate export file
      const exportData = await this.generateExportFile(data, exportRequest.format);

      // Upload file to storage (simplified - in real implementation use cloud storage)
      const fileName = `export-${exportRequest.id}.${exportRequest.format}`;
      const fileUrl = await this.uploadExportFile(fileName, exportData);

      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

      // Update export request
      await supabase
        .from('export_requests')
        .update({
          status: 'completed',
          file_url: fileUrl,
          expires_at: expiresAt.toISOString(),
          completed_at: new Date().toISOString(),
          record_count: data.length,
          file_size: exportData.length,
        })
        .eq('id', exportRequest.id);

      // Log completion
      await auditService.logEvent(
        'export_complete',
        exportRequest.userId,
        exportRequest.workspaceId,
        'exports',
        'complete',
        { recordCount: data.length, fileSize: exportData.length },
        exportRequest.id
      );

    } catch (error) {
      console.error('Export processing failed:', error);

      // Update status to failed
      await supabase
        .from('export_requests')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', exportRequest.id);
    }
  }

  private async generateExportFile(data: any[], format: string): Promise<string> {
    switch (format) {
      case 'csv':
        return this.generateCSV(data);
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'xlsx':
        return this.generateXLSX(data);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private generateCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        }).join(',')
      ),
    ];

    return csvRows.join('\n');
  }

  private generateXLSX(data: any[]): string {
    // Simplified XLSX generation - in real implementation use a library like exceljs
    // For now, return CSV as XLSX is complex
    return this.generateCSV(data);
  }

  private async uploadExportFile(fileName: string, content: string): Promise<string> {
    // In a real implementation, upload to cloud storage (S3, etc.)
    // For this demo, we'll store in a temporary location
    const fileUrl = `https://storage.example.com/exports/${fileName}`;

    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return fileUrl;
  }
}

export const exportService = new ExportService();