import express from 'express';
import { DealService } from '../services/dealService';
import { ContactService } from '../services/contactService';
import { WebhookService } from '../webhooks/service';
import { IntegrationService } from '../integrations/service';
import { permissionService } from '../services/permissionService';
import { auditService } from '../services/auditService';
import { ssoService } from '../services/ssoService';
import { gdprService } from '../services/gdprService';
import { exportService } from '../services/exportService';
import { securityService } from '../services/securityService';
import { featureFlags } from '../features/flags';
import { authenticateToken, requirePermission, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Deal routes
router.get('/deals', async (req, res) => {
  try {
    const { filter, sort, pagination, search } = req.query;
    const deals = await DealService.getDeals({
      filter: filter ? JSON.parse(filter as string) : undefined,
      sort: sort ? JSON.parse(sort as string) : undefined,
      pagination: pagination ? JSON.parse(pagination as string) : undefined,
      search: search as string,
    }, req.context);

    res.json(deals);
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/deals/:id', async (req, res) => {
  try {
    const deal = await DealService.getDealById(req.params.id, req.context);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    res.json(deal);
  } catch (error) {
    console.error('Error fetching deal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/deals', async (req, res) => {
  try {
    const deal = await DealService.createDeal(req.body, req.context);
    res.status(201).json(deal);
  } catch (error) {
    console.error('Error creating deal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/deals/:id', async (req, res) => {
  try {
    const deal = await DealService.updateDeal({ ...req.body, id: req.params.id }, req.context);
    res.json(deal);
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/deals/:id', async (req, res) => {
  try {
    const result = await DealService.deleteDeal(req.params.id, req.context);
    if (!result) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk deal operations
router.post('/deals/bulk', async (req, res) => {
  try {
    const { ids, updates } = req.body;
    const result = await DealService.bulkUpdateDeals(ids, updates, req.context);
    res.json(result);
  } catch (error) {
    console.error('Error bulk updating deals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Contact routes
router.get('/contacts', async (req, res) => {
  try {
    const { filter, sort, pagination, search } = req.query;
    const contacts = await ContactService.getContacts({
      filter: filter ? JSON.parse(filter as string) : undefined,
      sort: sort ? JSON.parse(sort as string) : undefined,
      pagination: pagination ? JSON.parse(pagination as string) : undefined,
      search: search as string,
    }, req.context);

    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/contacts/:id', async (req, res) => {
  try {
    const contact = await ContactService.getContactById(req.params.id, req.context);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/contacts', async (req, res) => {
  try {
    const contact = await ContactService.createContact(req.body, req.context);
    res.status(201).json(contact);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/contacts/:id', async (req, res) => {
  try {
    const contact = await ContactService.updateContact({ ...req.body, id: req.params.id }, req.context);
    res.json(contact);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/contacts/:id', async (req, res) => {
  try {
    const result = await ContactService.deleteContact(req.params.id, req.context);
    if (!result) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Pipeline stats
router.get('/pipeline/stats', async (req, res) => {
  try {
    const stats = await DealService.getPipelineStats(req.context);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching pipeline stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook routes (admin only)
router.get('/webhooks', async (req, res) => {
  if (req.context!.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const webhooks = await WebhookService.getWebhooks(req.context);
    res.json(webhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/webhooks', async (req, res) => {
  if (req.context!.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const webhook = await WebhookService.createWebhook(req.body, req.context);
    res.status(201).json(webhook);
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/webhooks/:id', async (req, res) => {
  if (req.context!.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const webhook = await WebhookService.updateWebhook(req.params.id, req.body, req.context);
    res.json(webhook);
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/webhooks/:id', async (req, res) => {
  if (req.context!.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const result = await WebhookService.deleteWebhook(req.params.id, req.context);
    if (!result) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/webhooks/:id/test', async (req, res) => {
  if (req.context!.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const result = await WebhookService.testWebhook(req.params.id, req.context);
    res.json(result);
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Integration routes (admin only)
router.get('/integrations', async (req, res) => {
  if (req.context!.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const integrations = await IntegrationService.getIntegrations(req.context);
    res.json(integrations);
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/integrations', async (req, res) => {
  if (req.context!.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const integration = await IntegrationService.createIntegration(req.body, req.context);
    res.status(201).json(integration);
  } catch (error) {
    console.error('Error creating integration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/integrations/:id', async (req, res) => {
  if (req.context!.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const integration = await IntegrationService.updateIntegration(req.params.id, req.body, req.context);
    res.json(integration);
  } catch (error) {
    console.error('Error updating integration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/integrations/:id', async (req, res) => {
  if (req.context!.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const result = await IntegrationService.deleteIntegration(req.params.id, req.context);
    if (!result) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting integration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/integrations/:id/test', async (req, res) => {
  if (req.context!.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const result = await IntegrationService.testIntegration(req.params.id, req.context);
    res.json(result);
  } catch (error) {
    console.error('Error testing integration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export/import routes
router.post('/export/deals', async (req, res) => {
  try {
    const { format = 'json', filters } = req.body;
    const data = await DealService.exportDeals(filters, format, req.context);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=deals.${format}`);
    res.send(data);
  } catch (error) {
    console.error('Error exporting deals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/import/deals', async (req, res) => {
  try {
    const { data, format = 'json' } = req.body;
    const result = await DealService.importDeals(data, format, req.context);
    res.json(result);
  } catch (error) {
    console.error('Error importing deals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Security & Compliance Routes

// Permission routes
router.get('/permissions', requirePermission('permissions', 'read'), async (req, res) => {
  try {
    const permissions = await permissionService.getUserPermissions(
      req.context!.user!.id,
      req.context!.workspaceId!
    );
    res.json(permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/roles', requireAdmin, async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const role = await permissionService.createRole(
      name,
      description,
      permissions,
      req.context!.workspaceId,
      req.context!.user!.id
    );
    res.status(201).json(role);
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/roles', requirePermission('roles', 'read'), async (req, res) => {
  try {
    const roles = await permissionService.getWorkspaceRoles(req.context!.workspaceId!);
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/roles/:roleId/assign/:userId', requirePermission('roles', 'write'), async (req, res) => {
  try {
    const { expiresAt } = req.body;
    const userRole = await permissionService.assignRoleToUser(
      req.params.userId,
      req.params.roleId,
      req.context!.workspaceId!,
      req.context!.user!.id,
      expiresAt ? new Date(expiresAt) : undefined
    );
    res.status(201).json(userRole);
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Audit routes
router.get('/audit/events', requirePermission('audit', 'read'), async (req, res) => {
  try {
    const { userId, eventType, resource, startDate, endDate, limit, offset } = req.query;
    const events = await auditService.getAuditEvents(req.context!.workspaceId!, {
      userId: userId as string,
      eventType: eventType as any,
      resource: resource as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json(events);
  } catch (error) {
    console.error('Error fetching audit events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/audit/compliance-report', requireAdmin, async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    const report = await auditService.generateComplianceReport(
      req.context!.workspaceId!,
      type as 'gdpr' | 'security' | 'access',
      new Date(startDate as string),
      new Date(endDate as string)
    );
    res.json(report);
  } catch (error) {
    console.error('Error generating compliance report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SSO routes
router.post('/sso/config', requireAdmin, async (req, res) => {
  try {
    const { provider, config } = req.body;
    const ssoConfig = await ssoService.createSSOConfig(
      req.context!.workspaceId!,
      provider,
      config,
      req.context!.user!.id
    );
    res.status(201).json(ssoConfig);
  } catch (error) {
    console.error('Error creating SSO config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/sso/config', requireAdmin, async (req, res) => {
  try {
    const config = await ssoService.getSSOConfig(req.context!.workspaceId!);
    res.json(config);
  } catch (error) {
    console.error('Error fetching SSO config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/sso/config/:configId', requireAdmin, async (req, res) => {
  try {
    const { config, isActive } = req.body;
    await ssoService.updateSSOConfig(req.params.configId, { config, isActive });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating SSO config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GDPR routes
router.post('/gdpr/requests', async (req, res) => {
  try {
    const { requestType, notes } = req.body;
    const gdprRequest = await gdprService.submitGDPRRequest(
      req.context!.user!.id,
      req.context!.workspaceId!,
      requestType,
      notes
    );
    res.status(201).json(gdprRequest);
  } catch (error) {
    console.error('Error submitting GDPR request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/gdpr/requests', async (req, res) => {
  try {
    const requests = await gdprService.getUserGDPRRequests(
      req.context!.user!.id,
      req.context!.workspaceId!
    );
    res.json(requests);
  } catch (error) {
    console.error('Error fetching GDPR requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/gdpr/requests/:requestId/process', requireAdmin, async (req, res) => {
  try {
    const { status, data, notes } = req.body;
    await gdprService.processGDPRRequest(
      req.params.requestId,
      status,
      req.context!.user!.id,
      data,
      notes
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error processing GDPR request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Data export routes
router.post('/export/requests', requirePermission('exports', 'create'), async (req, res) => {
  try {
    const { entityType, filters, fields, format } = req.body;
    const exportRequest = await exportService.requestExport(
      req.context!.user!.id,
      req.context!.workspaceId!,
      entityType,
      filters,
      fields,
      format
    );
    res.status(201).json(exportRequest);
  } catch (error) {
    console.error('Error requesting export:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/export/requests', requirePermission('exports', 'read'), async (req, res) => {
  try {
    const requests = await exportService.getUserExportRequests(
      req.context!.user!.id,
      req.context!.workspaceId!
    );
    res.json(requests);
  } catch (error) {
    console.error('Error fetching export requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/export/policies', requireAdmin, async (req, res) => {
  try {
    const policy = await exportService.createExportPolicy(
      req.body.name,
      req.body.description,
      req.body.entityType,
      req.body.maxRecords,
      req.body.maxFileSize,
      req.body.allowedFormats,
      req.body.requiresApproval,
      req.body.approvalRoles,
      req.body.retentionPeriod,
      req.body.rateLimit,
      req.context!.workspaceId!,
      req.context!.user!.id
    );
    res.status(201).json(policy);
  } catch (error) {
    console.error('Error creating export policy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Security monitoring routes
router.get('/security/alerts', requirePermission('security', 'read'), async (req, res) => {
  try {
    const { severity, type, resolved, startDate, endDate, limit } = req.query;
    const alerts = await securityService.getSecurityAlerts(req.context!.workspaceId!, {
      severity: severity as string,
      type: type as string,
      resolved: resolved === 'true',
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching security alerts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/security/alerts/:alertId/resolve', requirePermission('security', 'write'), async (req, res) => {
  try {
    const { actions } = req.body;
    await securityService.resolveSecurityAlert(
      req.params.alertId,
      req.context!.user!.id,
      actions
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error resolving security alert:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/security/dashboard', requirePermission('security', 'read'), async (req, res) => {
  try {
    const dashboard = await securityService.getSecurityDashboard(req.context!.workspaceId!);
    res.json(dashboard);
  } catch (error) {
    console.error('Error fetching security dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Data retention routes
router.post('/retention/policies', requireAdmin, async (req, res) => {
  try {
    const policy = await gdprService.createRetentionPolicy(
      req.body.name,
      req.body.description,
      req.body.entityType,
      req.body.retentionPeriod,
      req.body.deletionMethod,
      req.body.conditions,
      req.context!.workspaceId!,
      req.context!.user!.id
    );
    res.status(201).json(policy);
  } catch (error) {
    console.error('Error creating retention policy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/retention/policies', requireAdmin, async (req, res) => {
  try {
    const policies = await gdprService.getRetentionPolicies(req.context!.workspaceId!);
    res.json(policies);
  } catch (error) {
    console.error('Error fetching retention policies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as restRoutes };