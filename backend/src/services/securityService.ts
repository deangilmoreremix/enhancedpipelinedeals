import { supabase } from './database';
import { SecurityAlert, SecurityPolicy } from '../types';
import { featureFlags } from '../features/flags';
import { auditService } from './auditService';

export class SecurityService {
  /**
   * Create security alert
   */
  async createSecurityAlert(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    workspaceId: string,
    userId?: string,
    details: Record<string, any> = {}
  ): Promise<SecurityAlert> {
    if (!featureFlags.isEnabled('security_monitoring')) return null as any;

    const alert: SecurityAlert = {
      id: crypto.randomUUID(),
      type,
      severity,
      workspaceId,
      userId,
      details,
      detectedAt: new Date(),
    };

    const { error } = await supabase
      .from('security_alerts')
      .insert([{
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        workspace_id: alert.workspaceId,
        user_id: alert.userId,
        details: alert.details,
        detected_at: alert.detectedAt.toISOString(),
      }]);

    if (error) {
      console.error('Failed to create security alert:', error);
    }

    // Log the security alert
    await auditService.logEvent(
      'security_alert',
      userId,
      workspaceId,
      'security',
      'alert_created',
      { alertType: type, severity },
      alert.id
    );

    return alert;
  }

  /**
   * Get security alerts for a workspace
   */
  async getSecurityAlerts(
    workspaceId: string,
    filters: {
      severity?: string;
      type?: string;
      resolved?: boolean;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<SecurityAlert[]> {
    let query = supabase
      .from('security_alerts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('detected_at', { ascending: false });

    if (filters.severity) {
      query = query.eq('severity', filters.severity);
    }

    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    if (filters.resolved !== undefined) {
      if (filters.resolved) {
        query = query.not('resolved_at', 'is', null);
      } else {
        query = query.is('resolved_at', null);
      }
    }

    if (filters.startDate) {
      query = query.gte('detected_at', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('detected_at', filters.endDate.toISOString());
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      details: row.details || {},
      detectedAt: new Date(row.detected_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      resolvedBy: row.resolved_by,
      actions: row.actions || [],
    }));
  }

  /**
   * Resolve security alert
   */
  async resolveSecurityAlert(
    alertId: string,
    resolvedBy: string,
    actions: string[] = []
  ): Promise<void> {
    const { error } = await supabase
      .from('security_alerts')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
        actions,
      })
      .eq('id', alertId);

    if (error) throw error;

    await auditService.logEvent(
      'security_alert',
      resolvedBy,
      '',
      'security',
      'alert_resolved',
      { alertId, actions }
    );
  }

  /**
   * Create security policy
   */
  async createSecurityPolicy(
    name: string,
    description: string,
    rules: any[],
    actions: any[],
    workspaceId: string,
    createdBy: string
  ): Promise<SecurityPolicy> {
    const policy: SecurityPolicy = {
      id: crypto.randomUUID(),
      name,
      description,
      rules,
      actions,
      isActive: true,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { error } = await supabase
      .from('security_policies')
      .insert([{
        id: policy.id,
        name: policy.name,
        description: policy.description,
        rules: policy.rules,
        actions: policy.actions,
        is_active: policy.isActive,
        created_by: policy.createdBy,
        created_at: policy.createdAt.toISOString(),
        updated_at: policy.updatedAt.toISOString(),
      }]);

    if (error) throw error;
    return policy;
  }

  /**
   * Get security policies for a workspace
   */
  async getSecurityPolicies(workspaceId: string): Promise<SecurityPolicy[]> {
    const { data, error } = await supabase
      .from('security_policies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      rules: row.rules || [],
      actions: row.actions || [],
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Monitor security events and create alerts
   */
  async monitorSecurityEvents(): Promise<void> {
    if (!featureFlags.isEnabled('security_monitoring')) return;

    // Check for suspicious login patterns
    await this.monitorSuspiciousLogins();

    // Check for unusual data access patterns
    await this.monitorUnusualDataAccess();

    // Check for failed authentication attempts
    await this.monitorFailedAuthAttempts();

    // Check for data export violations
    await this.monitorExportViolations();

    // Check for permission violations
    await this.monitorPermissionViolations();
  }

  /**
   * Get security dashboard data
   */
  async getSecurityDashboard(workspaceId: string): Promise<any> {
    const [
      alerts,
      recentEvents,
      topAlertTypes,
      severityBreakdown,
    ] = await Promise.all([
      this.getSecurityAlerts(workspaceId, { resolved: false, limit: 10 }),
      auditService.getAuditEvents(workspaceId, { limit: 50 }),
      this.getTopAlertTypes(workspaceId),
      this.getSeverityBreakdown(workspaceId),
    ]);

    return {
      activeAlerts: alerts,
      recentSecurityEvents: recentEvents.filter(event =>
        ['user_login', 'user_logout', 'security_alert', 'permission_change'].includes(event.eventType)
      ),
      alertStats: {
        topAlertTypes,
        severityBreakdown,
        totalActiveAlerts: alerts.length,
      },
      lastUpdated: new Date(),
    };
  }

  // Private monitoring methods

  private async monitorSuspiciousLogins(): Promise<void> {
    // Get all workspaces
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id');

    if (error) return;

    for (const workspace of workspaces) {
      // Check for multiple login attempts from different IPs
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const loginEvents = await auditService.getAuditEvents(workspace.id, {
        eventType: 'user_login',
        startDate: oneHourAgo,
      });

      const loginPatterns = new Map<string, Set<string>>();
      for (const event of loginEvents) {
        if (!loginPatterns.has(event.userId!)) {
          loginPatterns.set(event.userId!, new Set());
        }
        loginPatterns.get(event.userId!)!.add(event.ipAddress);
      }

      // Alert if user logged in from more than 3 different IPs in an hour
      for (const [userId, ips] of loginPatterns) {
        if (ips.size >= 3) {
          await this.createSecurityAlert(
            'suspicious_login',
            'medium',
            workspace.id,
            userId,
            {
              uniqueIPs: Array.from(ips),
              timeWindow: '1 hour',
              loginCount: loginEvents.filter(e => e.userId === userId).length,
            }
          );
        }
      }
    }
  }

  private async monitorUnusualDataAccess(): Promise<void> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    // Get all workspaces
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id');

    if (error) return;

    for (const workspace of workspaces) {
      const accessEvents = await auditService.getAuditEvents(workspace.id, {
        eventType: 'data_access',
        startDate: oneHourAgo,
      });

      const userAccessCounts = new Map<string, number>();
      for (const event of accessEvents) {
        const count = userAccessCounts.get(event.userId!) || 0;
        userAccessCounts.set(event.userId!, count + 1);
      }

      // Alert if user accessed more than 100 records in an hour
      for (const [userId, count] of userAccessCounts) {
        if (count > 100) {
          await this.createSecurityAlert(
            'unusual_activity',
            'low',
            workspace.id,
            userId,
            {
              accessCount: count,
              timeWindow: '1 hour',
              threshold: 100,
            }
          );
        }
      }
    }
  }

  private async monitorFailedAuthAttempts(): Promise<void> {
    // This would typically monitor failed login attempts
    // For this implementation, we'll check for suspicious patterns in audit logs
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    // Get all workspaces
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id');

    if (error) return;

    for (const workspace of workspaces) {
      // Look for failed authentication patterns
      const authEvents = await auditService.getAuditEvents(workspace.id, {
        startDate: oneHourAgo,
      });

      const failedAttempts = authEvents.filter(event =>
        event.details?.failed === true || event.eventType.includes('failed')
      );

      if (failedAttempts.length > 10) {
        await this.createSecurityAlert(
          'failed_auth_attempts',
          'medium',
          workspace.id,
          undefined,
          {
            failedAttemptCount: failedAttempts.length,
            timeWindow: '1 hour',
          }
        );
      }
    }
  }

  private async monitorExportViolations(): Promise<void> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Get all workspaces
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id');

    if (error) return;

    for (const workspace of workspaces) {
      const exportEvents = await auditService.getAuditEvents(workspace.id, {
        eventType: 'export_request',
        startDate: oneDayAgo,
      });

      const userExportCounts = new Map<string, number>();
      for (const event of exportEvents) {
        const count = userExportCounts.get(event.userId!) || 0;
        userExportCounts.set(event.userId!, count + 1);
      }

      // Alert if user made more than 5 exports in a day
      for (const [userId, count] of userExportCounts) {
        if (count > 5) {
          await this.createSecurityAlert(
            'export_violation',
            'low',
            workspace.id,
            userId,
            {
              exportCount: count,
              timeWindow: '1 day',
              threshold: 5,
            }
          );
        }
      }
    }
  }

  private async monitorPermissionViolations(): Promise<void> {
    // Monitor for permission-related security events
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    // Get all workspaces
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id');

    if (error) return;

    for (const workspace of workspaces) {
      const permissionEvents = await auditService.getAuditEvents(workspace.id, {
        eventType: 'permission_change',
        startDate: oneHourAgo,
      });

      // Alert if there are many permission changes in a short time
      if (permissionEvents.length > 20) {
        await this.createSecurityAlert(
          'permission_violation',
          'high',
          workspace.id,
          undefined,
          {
            permissionChangeCount: permissionEvents.length,
            timeWindow: '1 hour',
          }
        );
      }
    }
  }

  private async getTopAlertTypes(workspaceId: string): Promise<Record<string, number>> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const alerts = await this.getSecurityAlerts(workspaceId, {
      startDate: thirtyDaysAgo,
    });

    const typeCounts: Record<string, number> = {};
    for (const alert of alerts) {
      typeCounts[alert.type] = (typeCounts[alert.type] || 0) + 1;
    }

    return typeCounts;
  }

  private async getSeverityBreakdown(workspaceId: string): Promise<Record<string, number>> {
    const alerts = await this.getSecurityAlerts(workspaceId, { resolved: false });

    const severityCounts: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const alert of alerts) {
      severityCounts[alert.severity]++;
    }

    return severityCounts;
  }
}

export const securityService = new SecurityService();