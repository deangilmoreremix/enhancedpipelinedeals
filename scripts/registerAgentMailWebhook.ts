import { createWebhook } from '../src/lib/agentmailClient';

async function main() {
  try {
    const url = `${process.env.PUBLIC_API_URL}/api/agentmail/webhook`;
    await createWebhook({
      url,
      clientId: "smartcrm-main-webhook"
    });
    console.log('Webhook registered successfully');
  } catch (error) {
    console.error('Failed to register webhook:', error);
  }
}

main();