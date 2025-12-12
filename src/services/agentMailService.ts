/**
 * AgentMail Integration Service
 * Handles email and SMS sending through AgentMail API
 */

interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: any[];
}

interface SMSMessage {
  to: string;
  from: string;
  body: string;
  mediaUrl?: string;
}

interface AgentMailConfig {
  apiKey: string;
  baseUrl: string;
  inbox: string;
  webhookUrl?: string;
}

class AgentMailService {
  private config: AgentMailConfig;
  private rateLimits = {
    email: { perMinute: 50, perHour: 1000 },
    sms: { perMinute: 10, perHour: 100 }
  };

  constructor() {
    this.config = {
      apiKey: import.meta.env.VITE_AGENTMAIL_API_KEY || '',
      baseUrl: 'https://api.agentmail.to/v1',
      inbox: import.meta.env.VITE_AGENTMAIL_INBOX || 'your-inbox@agentmail.to'
    };
  }

  async sendEmail(message: EmailMessage): Promise<any> {
    try {
      // Check rate limits
      await this.checkRateLimit('email');

      const payload = {
        to: message.to,
        from: this.config.inbox,
        subject: message.subject,
        html: message.html,
        text: message.text || this.stripHtml(message.html),
        reply_to: message.replyTo,
        cc: message.cc,
        bcc: message.bcc,
        attachments: message.attachments
      };

      const response = await fetch(`${this.config.baseUrl}/emails/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`AgentMail API error: ${response.status}`);
      }

      const result = await response.json();

      // Log the send
      await this.logEmailSend(message, result);

      return result;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendSMS(message: SMSMessage): Promise<any> {
    try {
      // Check rate limits
      await this.checkRateLimit('sms');

      const payload = {
        to: message.to,
        from: message.from || this.config.inbox,
        body: message.body,
        media_url: message.mediaUrl
      };

      const response = await fetch(`${this.config.baseUrl}/sms/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`AgentMail SMS API error: ${response.status}`);
      }

      const result = await response.json();

      // Log the send
      await this.logSMSSend(message, result);

      return result;
    } catch (error) {
      console.error('Failed to send SMS:', error);
      throw error;
    }
  }

  async sendSequence(contactId: string, agentId: string, personaId: string, sequence: any[]): Promise<any> {
    try {
      const results = [];

      for (const step of sequence) {
        const delay = step.delay || 0;

        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }

        let result;
        if (step.type === 'email') {
          result = await this.sendEmail({
            to: step.recipient,
            from: this.config.inbox,
            subject: step.subject,
            html: step.content,
            replyTo: step.replyTo
          });
        } else if (step.type === 'sms') {
          result = await this.sendSMS({
            to: step.recipient,
            from: step.from,
            body: step.content
          });
        }

        results.push({
          step: step.step,
          type: step.type,
          result,
          timestamp: new Date().toISOString()
        });

        // Update sequence progress in database
        await this.updateSequenceProgress(contactId, step.step);
      }

      return {
        contactId,
        agentId,
        personaId,
        totalSteps: sequence.length,
        completedSteps: results.length,
        results
      };
    } catch (error) {
      console.error('Sequence execution failed:', error);
      throw error;
    }
  }

  async getInboxMessages(since?: string): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (since) params.append('since', since);

      const response = await fetch(`${this.config.baseUrl}/inbox/messages?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`AgentMail inbox API error: ${response.status}`);
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('Failed to get inbox messages:', error);
      throw error;
    }
  }

  async replyToMessage(messageId: string, replyContent: string, replyAll: boolean = false): Promise<any> {
    try {
      const payload = {
        message_id: messageId,
        content: replyContent,
        reply_all: replyAll
      };

      const response = await fetch(`${this.config.baseUrl}/emails/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`AgentMail reply API error: ${response.status}`);
      }

      const result = await response.json();

      // Log the reply
      await this.logEmailReply(messageId, replyContent, result);

      return result;
    } catch (error) {
      console.error('Failed to reply to message:', error);
      throw error;
    }
  }

  async getMessageThread(messageId: string): Promise<any> {
    try {
      const response = await fetch(`${this.config.baseUrl}/emails/thread/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`AgentMail thread API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get message thread:', error);
      throw error;
    }
  }

  private async checkRateLimit(type: 'email' | 'sms'): Promise<void> {
    // Simple rate limiting - in production, use Redis or similar
    const limits = this.rateLimits[type];
    const now = Date.now();
    const minuteAgo = now - 60000;
    const hourAgo = now - 3600000;

    // This is a simplified implementation
    // In production, you'd check against a Redis store or database
    const recentSends = await this.getRecentSends(type, minuteAgo);

    if (recentSends >= limits.perMinute) {
      throw new Error(`Rate limit exceeded: ${limits.perMinute} ${type}s per minute`);
    }
  }

  private async getRecentSends(type: 'email' | 'sms', since: number): Promise<number> {
    // Placeholder - implement actual rate limit tracking
    // In production, query database for recent sends
    return 0;
  }

  private stripHtml(html: string): string {
    // Simple HTML stripping - in production, use a proper HTML parser
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  private async logEmailSend(message: EmailMessage, result: any): Promise<void> {
    // Log to agent_logs table
    try {
      await fetch('/.netlify/functions/log-agent-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email_sent',
          contactId: this.extractContactId(message.to),
          details: {
            to: message.to,
            subject: message.subject,
            messageId: result.id,
            timestamp: new Date().toISOString()
          }
        })
      });
    } catch (error) {
      console.warn('Failed to log email send:', error);
    }
  }

  private async logSMSSend(message: SMSMessage, result: any): Promise<void> {
    try {
      await fetch('/.netlify/functions/log-agent-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sms_sent',
          contactId: this.extractContactId(message.to),
          details: {
            to: message.to,
            body: message.body.substring(0, 100) + '...',
            messageId: result.id,
            timestamp: new Date().toISOString()
          }
        })
      });
    } catch (error) {
      console.warn('Failed to log SMS send:', error);
    }
  }

  private async logEmailReply(messageId: string, replyContent: string, result: any): Promise<void> {
    try {
      await fetch('/.netlify/functions/log-agent-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email_reply',
          messageId,
          details: {
            replyContent: replyContent.substring(0, 100) + '...',
            timestamp: new Date().toISOString()
          }
        })
      });
    } catch (error) {
      console.warn('Failed to log email reply:', error);
    }
  }

  private async updateSequenceProgress(contactId: string, step: number): Promise<void> {
    try {
      await fetch('/.netlify/functions/update-sequence-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId,
          currentStep: step
        })
      });
    } catch (error) {
      console.warn('Failed to update sequence progress:', error);
    }
  }

  private extractContactId(email: string): string {
    // Placeholder - implement logic to extract contact ID from email
    // In production, you'd have a mapping or lookup
    return 'unknown';
  }

  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.inbox);
  }

  getConfig(): AgentMailConfig {
    return { ...this.config };
  }
}

// Singleton instance
let agentMailService: AgentMailService | null = null;

export const getAgentMailService = (): AgentMailService => {
  if (!agentMailService) {
    agentMailService = new AgentMailService();
  }
  return agentMailService;
};

export { AgentMailService };
export type { EmailMessage, SMSMessage, AgentMailConfig };