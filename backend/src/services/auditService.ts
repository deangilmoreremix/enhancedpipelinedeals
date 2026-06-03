import { supabase } from './database';
import { AuditEvent, AuditEventType } from '../types';
import { featureFlags } from '../features/flags';

export class AuditService {
  /**
   * Log an audit event
   */
  async logEvent(
    eventType: AuditEventType,
    userId: string | undefined,
    workspaceId: string,
    resource: string,
    action: string,
    details: Record<string, any> = {},
    resourceId?: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    if (!featureFlags.isEnabled('audit_trails')) return;

    const event: AuditEvent = {
      id: crypto.randomUUID(),
      eventType,
      userId,
      workspaceId,
      resource,
      resourceId,
      action,
      details,
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
      timestamp: new Date(),
      sessionId,
      complianceFlags: this.determineComplianceFlags(eventType, details),
    };

    const { error } = await supabase
      .from('audit_events')
      .insert([{
        id: event.id,
        event_type: event.eventType,
        user_id: event.userId,
        workspace_id: event.workspaceId,
        resource: event.resource,
        resource_id: event.resourceId,
        action: event.action,
        details: event.details,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        timestamp: event.timestamp.toISOString(),
        session_id: event.sessionId,
        compliance_flags: event.complianceFlags,
      }]);

    if (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw error to avoid breaking the main flow
    }

    // Check for security alerts
    await this.checkForSecurityAlerts(event);
  }

  /**
   * Get audit events for a workspace with filtering
   */
  async getAuditEvents(
    workspaceId: string,
    filters: {
      userId?: string;
      eventType?: AuditEventType;
      resource?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AuditEvent[]> {
    let query = supabase
      .from('audit_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('timestamp', { ascending: false });

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters.eventType) {
      query = query.eq('event_type', filters.eventType);
    }

    if (filters.resource) {
      query = query.eq('resource', filters.resource);
    }

    if (filters.startDate) {
      query = query.gte('timestamp', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('timestamp', filters.endDate.toISOString());
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      eventType: row.event_type,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      resource: row.resource,
      resourceId: row.resource_id,
      action: row.action,
      details: row.details || {},
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      timestamp: new Date(row.timestamp),
      sessionId: row.session_id,
      complianceFlags: row.compliance_flags || [],
    }));
  }

  /**
   * Get audit events for GDPR compliance reporting
   */
  async getGDPRComplianceEvents(
    workspaceId: string,
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AuditEvent[]> {
    const gdprEventTypes: AuditEventType[] = [
      'data_access', 'data_modify', 'data_delete', 'gdpr_request'
    ];

    return this.getAuditEvents(workspaceId, {
      userId,
      eventType: gdprEventTypes[0], // This is a simplified check
      startDate,
      endDate,
    });
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    workspaceId: string,
    reportType: 'gdpr' | 'security' | 'access',
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    let events: AuditEvent[];

    switch (reportType) {
      case 'gdpr':
        events = await this.getAuditEvents(workspaceId, {
          startDate,
          endDate,
          eventType: 'gdpr_request',
        });
        break;

      case 'security':
        const securityTypes: AuditEventType[] = [
          'user_login', 'user_logout', 'security_alert', 'permission_change'
        ];
        events = await this.getAuditEvents(workspaceId, {
          startDate,
          endDate,
        });
        events = events.filter(event => securityTypes.includes(event.eventType));
        break;

      case 'access':
        events = await this.getAuditEvents(workspaceId, {
          startDate,
          endDate,
          eventType: 'data_access',
        });
        break;

      default:
        events = [];
    }

    return {
      reportType,
      workspaceId,
      period: { startDate, endDate },
      totalEvents: events.length,
      events: events.slice(0, 1000), // Limit for performance
      generatedAt: new Date(),
    };
  }

  /**
   * Clean up old audit events based on retention policy
   */
  async cleanupOldEvents(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { data, error } = await supabase
      .from('audit_events')
      .delete()
      .lt('timestamp', cutoffDate.toISOString())
      .select('id');

    if (error) throw error;

    return data?.length || 0;
  }

  /**
   * Determine compliance flags for an event
   */
  private determineComplianceFlags(eventType: AuditEventType, details: Record<string, any>): string[] {
    const flags: string[] = [];

    switch (eventType) {
      case 'data_access':
        flags.push('data_access');
        if (details.sensitive) flags.push('sensitive_data');
        break;

      case 'data_modify':
        flags.push('data_modification');
        if (details.pii) flags.push('pii_modification');
        break;

      case 'data_delete':
        flags.push('data_deletion');
        flags.push('gdpr_right_to_erasure');
        break;

      case 'gdpr_request':
        flags.push('gdpr_request');
        break;

      case 'export_request':
        flags.push('data_export');
        break;

      case 'permission_change':
        flags.push('access_control_change');
        break;
    }

    return flags;
  }

  /**
   * Check for security alerts based on audit events
   */
  private async checkForSecurityAlerts(event: AuditEvent): Promise<void> {
    const alerts = [];

    // Check for suspicious login patterns
    if (event.eventType === 'user_login') {
      const recentLogins = await this.getRecentEvents(
        event.workspaceId,
        'user_login',
        event.userId!,
        10
      );

      if (recentLogins.length >= 5) {
        const uniqueIPs = new Set(recentLogins.map(e => e.ipAddress));
        if (uniqueIPs.size >= 3) {
          alerts.push({
            type: 'suspicious_login',
            severity: 'medium',
            details: {
              userId: event.userId,
              uniqueIPs: Array.from(uniqueIPs),
              loginCount: recentLogins.length,
            },
          });
        }
      }
    }

    // Check for unusual data access patterns
    if (event.eventType === 'data_access') {
      const recentAccess = await this.getRecentEvents(
        event.workspaceId,
        'data_access',
        event.userId,
        50
      );

      if (recentAccess.length >= 20) {
        alerts.push({
          type: 'unusual_activity',
          severity: 'low',
          details: {
            userId: event.userId,
            accessCount: recentAccess.length,
            timeWindow: '1 hour',
          },
        });
      }
    }

    // Create alerts in database
    for (const alert of alerts) {
      await this.createSecurityAlert(
        alert.type,
        alert.severity as 'low' | 'medium' | 'high' | 'critical',
        event.workspaceId,
        event.userId,
        alert.details
      );
    }
  }

  /**
   * Get recent events for security analysis
   */
  private async getRecentEvents(
    workspaceId: string,
    eventType: AuditEventType,
    userId: string | undefined,
    limit: number
  ): Promise<AuditEvent[]> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    return this.getAuditEvents(workspaceId, {
      userId,
      eventType,
      startDate: oneHourAgo,
      limit,
    });
  }

  /**
   * Create a security alert
   */
  private async createSecurityAlert(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    workspaceId: string,
    userId: string | undefined,
    details: Record<string, any>
  ): Promise<void> {
    const { error } = await supabase
      .from('security_alerts')
      .insert([{
        type,
        severity,
        workspace_id: workspaceId,
        user_id: userId,
        details,
        detected_at: new Date().toISOString(),
      }]);

    if (error) {
      console.error('Failed to create security alert:', error);
    }
  }

  /**
   * Log user login event
   */
  async logLogin(userId: string, workspaceId: string, ipAddress: string, userAgent: string): Promise<void> {
    await this.logEvent(
      'user_login',
      userId,
      workspaceId,
      'auth',
      'login',
      {},
      undefined,
      undefined,
      ipAddress,
      userAgent
    );
  }

  /**
   * Log user logout event
   */
  async logLogout(userId: string, workspaceId: string, sessionId: string): Promise<void> {
    await this.logEvent(
      'user_logout',
      userId,
      workspaceId,
      'auth',
      'logout',
      {},
      undefined,
      sessionId
    );
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    userId: string,
    workspaceId: string,
    resource: string,
    resourceId: string,
    action: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent(
      'data_access',
      userId,
      workspaceId,
      resource,
      action,
      details,
      resourceId
    );
  }

  /**
   * Log permission change event
   */
  async logPermissionChange(
    userId: string,
    workspaceId: string,
    targetUserId: string,
    changes: Record<string, any>
  ): Promise<void> {
    await this.logEvent(
      'permission_change',
      userId,
      workspaceId,
      'permissions',
      'modify',
      { targetUserId, changes },
      targetUserId
    );
  }
}

export const auditService = new AuditService();