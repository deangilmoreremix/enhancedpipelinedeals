import express from 'express';
import { IntegrationService } from './service';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware
router.use(authenticateToken);

// All integration management routes require admin access
router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const integrations = await IntegrationService.getIntegrations(req.context);
    res.json(integrations);
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/types', async (req, res) => {
  try {
    const types = IntegrationService.getSupportedIntegrationTypes();
    res.json({ types });
  } catch (error) {
    console.error('Error fetching integration types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const integration = await IntegrationService.createIntegration(req.body, req.context);
    res.status(201).json(integration);
  } catch (error) {
    console.error('Error creating integration:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const integration = await IntegrationService.getIntegrationById(req.params.id, req.context);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    res.json(integration);
  } catch (error) {
    console.error('Error fetching integration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const integration = await IntegrationService.updateIntegration(req.params.id, req.body, req.context);
    res.json(integration);
  } catch (error) {
    console.error('Error updating integration:', error);
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
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

router.post('/:id/test', async (req, res) => {
  try {
    const result = await IntegrationService.testIntegration(req.params.id, req.context);
    res.json(result);
  } catch (error) {
    console.error('Error testing integration:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/sync', async (req, res) => {
  try {
    const result = await IntegrationService.syncIntegration(req.params.id, req.context);
    res.json(result);
  } catch (error) {
    console.error('Error syncing integration:', error);
    res.status(500).json({ error: error.message });
  }
});

// OAuth callback endpoints for integrations
router.get('/oauth/callback/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { code, state } = req.query;

    // Verify state parameter for security
    if (!state) {
      return res.status(400).json({ error: 'Missing state parameter' });
    }

    // Handle OAuth callback based on integration type
    const result = await IntegrationService.handleOAuthCallback(type, code as string, state as string, req.context);

    res.json({ success: true, message: 'Integration authorized successfully', data: result });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Authorization failed' });
  }
});

export { router as integrationRoutes };