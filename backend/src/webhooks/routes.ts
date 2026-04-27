import express from 'express';
import crypto from 'crypto';
import { WebhookService } from './service';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware
router.use(authenticateToken);

// All webhook management routes require admin access
router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const webhooks = await WebhookService.getWebhooks(req.context);
    res.json(webhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const webhook = await WebhookService.createWebhook(req.body, req.context);
    res.status(201).json(webhook);
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const webhook = await WebhookService.getWebhookById(req.params.id, req.context);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.json(webhook);
  } catch (error) {
    console.error('Error fetching webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const webhook = await WebhookService.updateWebhook(req.params.id, req.body, req.context);
    res.json(webhook);
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
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

router.post('/:id/test', async (req, res) => {
  try {
    const result = await WebhookService.testWebhook(req.params.id, req.context);
    res.json(result);
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook receiver endpoint (no auth required, validates signature)
router.post('/receive/:webhookId', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const { webhookId } = req.params;
    const signature = req.headers['x-webhook-signature'] as string;
    const event = req.headers['x-webhook-event'] as string;
    const payload = req.body;

    if (!signature || !event) {
      return res.status(400).json({ error: 'Missing signature or event header' });
    }

    // Verify webhook signature
    const webhook = await WebhookService.getWebhookById(webhookId, { workspaceId: null });
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const expectedSignature = WebhookService.generateSignature(
      JSON.stringify(payload),
      webhook.secret
    );

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook payload
    console.log(`Webhook ${webhookId} received event: ${event}`, payload);

    // Here you could add custom webhook processing logic
    // For now, just acknowledge receipt
    res.json({ status: 'received', event, webhookId });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as webhookRoutes };