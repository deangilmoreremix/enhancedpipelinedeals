import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    const { event_type, message } = payload;

    if (event_type === 'message.sent') {
      return new Response('OK', { status: 200 });
    }

    if (!message || !message.message_id || !message.inbox_id || (!message.from_ && !message.from)) {
      return new Response('OK', { status: 200 });
    }

    const from = message.from_ || message.from;
    let senderEmail = from;
    let senderName = '';

    const match = from.match(/^(.+?)\s*<(.+)>$/);
    if (match) {
      senderName = match[1].trim();
      senderEmail = match[2];
    }

    const body = message.text || message.body || message.html || '';

    console.log({
      event_type,
      senderEmail,
      subject: message.subject || '',
      thread_id: message.thread_id || '',
      body
    });

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('OK', { status: 200 });
  }
});