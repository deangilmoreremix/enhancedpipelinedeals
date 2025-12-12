/**
 * Multi-Channel Orchestration Service
 * Coordinates outreach across email, SMS, LinkedIn, WhatsApp, and other channels
 */

interface Channel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'social' | 'messaging' | 'voice';
  connected: boolean;
  settings: Record<string, any>;
  rateLimits: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
  capabilities: string[];
}

interface OrchestrationStrategy {
  id: string;
  name: string;
  description: string;
  channels: string[]; // Channel IDs to use
  sequence: OrchestrationStep[];
  conditions: OrchestrationCondition[];
  enabled: boolean;
}

interface OrchestrationStep {
  id: string;
  channelId: string;
  delay: number; // minutes from previous step
  template: string;
  conditions: string[]; // Conditions that must be met
  fallbackChannel?: string; // If primary channel fails
}

interface OrchestrationCondition {
  id: string;
  type: 'time' | 'response' | 'engagement' | 'stage' | 'custom';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains';
  value: any;
  field?: string;
}

interface ContactChannelPreferences {
  contactId: string;
  preferredChannels: string[];
  quietHours: { start: string; end: string };
  timezone: string;
  unsubscribed: string[]; // Channel IDs
  lastContacted: Record<string, string>; // Channel ID -> ISO timestamp
}

interface OrchestrationResult {
  contactId: string;
  strategyId: string;
  steps: OrchestrationStepResult[];
  status: 'completed' | 'partial' | 'failed';
  nextAction?: {
    channelId: string;
    scheduledTime: string;
    reason: string;
  };
}

interface OrchestrationStepResult {
  stepId: string;
  channelId: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'failed';
  timestamp: string;
  messageId?: string;
  error?: string;
  metrics?: Record<string, any>;
}

class MultiChannelOrchestrationService {
  private channels = new Map<string, Channel>();
  private strategies = new Map<string, OrchestrationStrategy>();
  private contactPreferences = new Map<string, ContactChannelPreferences>();

  constructor() {
    this.initializeChannels();
    this.initializeStrategies();
  }

  private initializeChannels() {
    // Email channels
    this.channels.set('agentmail', {
      id: 'agentmail',
      name: 'AgentMail',
      type: 'email',
      connected: true,
      settings: {
        inbox: 'your-inbox@agentmail.to',
        signature: 'Best regards,\nAI Sales Agent'
      },
      rateLimits: { perMinute: 50, perHour: 1000, perDay: 5000 },
      capabilities: ['html', 'attachments', 'tracking', 'replies']
    });

    // SMS channels
    this.channels.set('twilio', {
      id: 'twilio',
      name: 'Twilio SMS',
      type: 'sms',
      connected: false,
      settings: {},
      rateLimits: { perMinute: 10, perHour: 100, perDay: 1000 },
      capabilities: ['text', 'media', 'delivery_tracking']
    });

    // Social channels
    this.channels.set('linkedin', {
      id: 'linkedin',
      name: 'LinkedIn',
      type: 'social',
      connected: false,
      settings: {},
      rateLimits: { perMinute: 5, perHour: 50, perDay: 100 },
      capabilities: ['connection_requests', 'messages', 'posts']
    });

    // Messaging channels
    this.channels.set('whatsapp', {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      type: 'messaging',
      connected: false,
      settings: {},
      rateLimits: { perMinute: 20, perHour: 200, perDay: 1000 },
      capabilities: ['text', 'media', 'templates', 'interactive']
    });

    // Voice channels
    this.channels.set('twilio_voice', {
      id: 'twilio_voice',
      name: 'Twilio Voice',
      type: 'voice',
      connected: false,
      settings: {},
      rateLimits: { perMinute: 5, perHour: 50, perDay: 200 },
      capabilities: ['calls', 'voicemail', 'recording']
    });
  }

  private initializeStrategies() {
    // Cold outreach strategy
    this.strategies.set('cold_outreach', {
      id: 'cold_outreach',
      name: 'Cold Outreach Sequence',
      description: 'Multi-channel cold outreach with email, LinkedIn, and SMS',
      channels: ['agentmail', 'linkedin', 'twilio'],
      enabled: true,
      sequence: [
        {
          id: 'email_1',
          channelId: 'agentmail',
          delay: 0,
          template: 'cold_email_intro',
          conditions: []
        },
        {
          id: 'linkedin_connect',
          channelId: 'linkedin',
          delay: 1440, // 24 hours
          template: 'linkedin_connection',
          conditions: ['no_response_email_1']
        },
        {
          id: 'sms_followup',
          channelId: 'twilio',
          delay: 2880, // 48 hours from LinkedIn
          template: 'sms_followup',
          conditions: ['no_response_linkedin']
        }
      ],
      conditions: [
        {
          id: 'no_response_email_1',
          type: 'response',
          operator: 'equals',
          value: false,
          field: 'email_1_opened'
        },
        {
          id: 'no_response_linkedin',
          type: 'engagement',
          operator: 'equals',
          value: false,
          field: 'linkedin_accepted'
        }
      ]
    });

    // Nurture strategy
    this.strategies.set('nurture_sequence', {
      id: 'nurture_sequence',
      name: 'Lead Nurture Sequence',
      description: 'Educational content delivery across multiple channels',
      channels: ['agentmail', 'whatsapp'],
      enabled: true,
      sequence: [
        {
          id: 'email_nurture_1',
          channelId: 'agentmail',
          delay: 0,
          template: 'nurture_content_1',
          conditions: []
        },
        {
          id: 'whatsapp_nurture',
          channelId: 'whatsapp',
          delay: 4320, // 72 hours
          template: 'whatsapp_nurture',
          conditions: ['email_opened']
        }
      ],
      conditions: [
        {
          id: 'email_opened',
          type: 'engagement',
          operator: 'equals',
          value: true,
          field: 'email_opened'
        }
      ]
    });
  }

  async orchestrateContact(contactId: string, strategyId: string, context: any = {}): Promise<OrchestrationResult> {
    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy || !strategy.enabled) {
        throw new Error(`Strategy ${strategyId} not found or disabled`);
      }

      const preferences = await this.getContactPreferences(contactId);
      const results: OrchestrationStepResult[] = [];

      for (const step of strategy.sequence) {
        // Check if step conditions are met
        if (!await this.checkStepConditions(step, results, context)) {
          continue;
        }

        // Check channel availability and preferences
        if (!this.isChannelAvailable(step.channelId, preferences)) {
          // Try fallback channel
          if (step.fallbackChannel && this.isChannelAvailable(step.fallbackChannel, preferences)) {
            step.channelId = step.fallbackChannel;
          } else {
            continue;
          }
        }

        // Check rate limits
        if (!await this.checkRateLimit(step.channelId, contactId)) {
          continue;
        }

        // Calculate execution time
        const executeAt = this.calculateExecutionTime(step, results, preferences);

        // Execute the step
        const result = await this.executeStep(step, contactId, executeAt, context);
        results.push(result);

        // Update contact preferences with last contacted time
        await this.updateLastContacted(contactId, step.channelId);
      }

      // Determine next action
      const nextAction = await this.determineNextAction(contactId, strategy, results);

      return {
        contactId,
        strategyId,
        steps: results,
        status: results.length === strategy.sequence.length ? 'completed' : 'partial',
        nextAction
      };
    } catch (error) {
      console.error('Orchestration failed:', error);
      throw error;
    }
  }

  private async checkStepConditions(step: OrchestrationStep, previousResults: OrchestrationStepResult[], context: any): Promise<boolean> {
    for (const conditionId of step.conditions) {
      const condition = this.findCondition(conditionId);
      if (!condition) continue;

      if (!this.evaluateCondition(condition, previousResults, context)) {
        return false;
      }
    }
    return true;
  }

  private findCondition(conditionId: string): OrchestrationCondition | undefined {
    for (const strategy of this.strategies.values()) {
      const condition = strategy.conditions.find(c => c.id === conditionId);
      if (condition) return condition;
    }
    return undefined;
  }

  private evaluateCondition(condition: OrchestrationCondition, results: OrchestrationStepResult[], context: any): boolean {
    let value: any;

    switch (condition.type) {
      case 'response':
      case 'engagement':
        // Check if any previous step matches the condition
        const relevantResult = results.find(r => r.stepId === condition.field?.replace('_opened', '').replace('_accepted', ''));
        if (relevantResult) {
          value = relevantResult.status === 'opened' || relevantResult.status === 'replied';
        }
        break;
      case 'time':
        value = Date.now();
        break;
      case 'stage':
        value = context.dealStage;
        break;
      case 'custom':
        value = context[condition.field || ''];
        break;
    }

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'greater_than':
        return value > condition.value;
      case 'less_than':
        return value < condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'not_contains':
        return !String(value).includes(String(condition.value));
      default:
        return false;
    }
  }

  private isChannelAvailable(channelId: string, preferences: ContactChannelPreferences): boolean {
    const channel = this.channels.get(channelId);
    if (!channel?.connected) return false;

    // Check if contact has unsubscribed from this channel
    if (preferences.unsubscribed.includes(channelId)) return false;

    // Check if channel is in preferred channels
    if (preferences.preferredChannels.length > 0 && !preferences.preferredChannels.includes(channelId)) {
      return false;
    }

    return true;
  }

  private async checkRateLimit(channelId: string, contactId: string): Promise<boolean> {
    // Simplified rate limiting - in production, use Redis or database
    const channel = this.channels.get(channelId);
    if (!channel) return false;

    try {
      const response = await fetch('/.netlify/functions/check-rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          contactId,
          limits: channel.rateLimits
        })
      });

      const data = await response.json();
      return data.allowed;
    } catch (error) {
      console.warn('Rate limit check failed:', error);
      return true; // Allow if check fails
    }
  }

  private calculateExecutionTime(step: OrchestrationStep, previousResults: OrchestrationStepResult[], preferences: ContactChannelPreferences): Date {
    const now = new Date();

    // Add delay from previous step
    if (previousResults.length > 0) {
      const lastResult = previousResults[previousResults.length - 1];
      const lastTime = new Date(lastResult.timestamp);
      now.setTime(lastTime.getTime() + (step.delay * 60 * 1000)); // delay in minutes
    }

    // Respect quiet hours
    if (preferences.quietHours) {
      now.setTime(this.adjustForQuietHours(now, preferences.quietHours, preferences.timezone));
    }

    return now;
  }

  private adjustForQuietHours(time: Date, quietHours: { start: string; end: string }, timezone: string): number {
    // Simplified quiet hours adjustment
    // In production, use proper timezone handling
    const hour = time.getHours();
    const quietStart = parseInt(quietHours.start.split(':')[0]);
    const quietEnd = parseInt(quietHours.end.split(':')[0]);

    if (hour >= quietStart && hour < quietEnd) {
      // Move to end of quiet hours
      time.setHours(quietEnd, 0, 0, 0);
    }

    return time.getTime();
  }

  private async executeStep(step: OrchestrationStep, contactId: string, executeAt: Date, context: any): Promise<OrchestrationStepResult> {
    try {
      const channel = this.channels.get(step.channelId);
      if (!channel) throw new Error(`Channel ${step.channelId} not found`);

      // Get contact details
      const contact = await this.getContactDetails(contactId);

      // Prepare message content
      const content = await this.prepareMessageContent(step.template, contact, context);

      // Send through appropriate channel
      const result = await this.sendThroughChannel(channel, contact, content, executeAt);

      return {
        stepId: step.id,
        channelId: step.channelId,
        status: result.status,
        timestamp: new Date().toISOString(),
        messageId: result.messageId,
        metrics: result.metrics
      };
    } catch (error) {
      console.error(`Step execution failed: ${step.id}`, error);
      return {
        stepId: step.id,
        channelId: step.channelId,
        status: 'failed',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async getContactDetails(contactId: string): Promise<any> {
    try {
      const response = await fetch(`/api/contacts/${contactId}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to get contact details:', error);
      return { id: contactId, name: 'Contact', email: 'contact@example.com' };
    }
  }

  private async prepareMessageContent(templateId: string, contact: any, context: any): Promise<string> {
    // Template system - in production, use a proper template engine
    const templates: Record<string, string> = {
      cold_email_intro: `Hi ${contact.name},

I noticed ${context.company || 'your company'} is doing great work in ${context.industry || 'your industry'}.

I'd love to learn more about your current challenges and see if we can help.

Best regards,
AI Sales Agent`,

      linkedin_connection: `Hi ${contact.name}, I'd like to connect and learn more about ${context.company || 'your company'}.`,

      sms_followup: `Hi ${contact.name}, following up on my previous message. Would love to chat about how we can help ${context.company || 'your company'}.`,

      nurture_content_1: `Hi ${contact.name}, here's some valuable content about ${context.topic || 'industry trends'}...`,

      whatsapp_nurture: `Hi ${contact.name}! Here's a quick tip about ${context.topic || 'your industry'}: [content]`
    };

    return templates[templateId] || `Default message for ${contact.name}`;
  }

  private async sendThroughChannel(channel: Channel, contact: any, content: string, executeAt: Date): Promise<any> {
    const payload = {
      channelId: channel.id,
      contact,
      content,
      scheduledTime: executeAt.toISOString()
    };

    const response = await fetch('/.netlify/functions/send-channel-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Channel send failed: ${response.status}`);
    }

    return await response.json();
  }

  private async getContactPreferences(contactId: string): Promise<ContactChannelPreferences> {
    if (this.contactPreferences.has(contactId)) {
      return this.contactPreferences.get(contactId)!;
    }

    try {
      const response = await fetch(`/api/contacts/${contactId}/preferences`);
      const data = await response.json();

      const preferences: ContactChannelPreferences = {
        contactId,
        preferredChannels: data.preferredChannels || ['agentmail'],
        quietHours: data.quietHours || { start: '20:00', end: '08:00' },
        timezone: data.timezone || 'UTC',
        unsubscribed: data.unsubscribed || [],
        lastContacted: data.lastContacted || {}
      };

      this.contactPreferences.set(contactId, preferences);
      return preferences;
    } catch (error) {
      // Return defaults if fetch fails
      return {
        contactId,
        preferredChannels: ['agentmail'],
        quietHours: { start: '20:00', end: '08:00' },
        timezone: 'UTC',
        unsubscribed: [],
        lastContacted: {}
      };
    }
  }

  private async updateLastContacted(contactId: string, channelId: string): Promise<void> {
    const preferences = await this.getContactPreferences(contactId);
    preferences.lastContacted[channelId] = new Date().toISOString();
    this.contactPreferences.set(contactId, preferences);
  }

  private async determineNextAction(contactId: string, strategy: OrchestrationStrategy, results: OrchestrationStepResult[]): Promise<any> {
    // Analyze results to determine next best action
    const lastResult = results[results.length - 1];

    if (!lastResult || lastResult.status === 'failed') {
      return {
        channelId: 'agentmail', // Fallback to email
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        reason: 'Previous step failed, retrying with email'
      };
    }

    // Check for engagement
    const hasEngagement = results.some(r => ['opened', 'clicked', 'replied'].includes(r.status));

    if (hasEngagement) {
      return {
        channelId: 'agentmail',
        scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
        reason: 'Engagement detected, follow up quickly'
      };
    }

    // No engagement, try different channel
    const usedChannels = new Set(results.map(r => r.channelId));
    const availableChannels = strategy.channels.filter(c => !usedChannels.has(c));

    if (availableChannels.length > 0) {
      return {
        channelId: availableChannels[0],
        scheduledTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
        reason: 'No engagement, trying different channel'
      };
    }

    return undefined; // No next action
  }

  // Public API methods
  getChannels(): Channel[] {
    return Array.from(this.channels.values());
  }

  getStrategies(): OrchestrationStrategy[] {
    return Array.from(this.strategies.values());
  }

  async updateContactPreferences(contactId: string, preferences: Partial<ContactChannelPreferences>): Promise<void> {
    const existing = await this.getContactPreferences(contactId);
    const updated = { ...existing, ...preferences };
    this.contactPreferences.set(contactId, updated);

    // Persist to database
    await fetch('/.netlify/functions/update-contact-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
  }

  async connectChannel(channelId: string, credentials: any): Promise<boolean> {
    try {
      const response = await fetch('/.netlify/functions/connect-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, credentials })
      });

      if (response.ok) {
        const channel = this.channels.get(channelId);
        if (channel) {
          channel.connected = true;
          channel.settings = { ...channel.settings, ...credentials };
        }
        return true;
      }
    } catch (error) {
      console.error('Failed to connect channel:', error);
    }
    return false;
  }

  async getOrchestrationAnalytics(timeRange: { start: string; end: string }): Promise<any> {
    try {
      const response = await fetch('/.netlify/functions/get-orchestration-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeRange })
      });

      return await response.json();
    } catch (error) {
      console.error('Failed to get orchestration analytics:', error);
      return {
        totalSequences: 0,
        successRate: 0,
        channelPerformance: {},
        engagementRates: {}
      };
    }
  }
}

// Singleton instance
let multiChannelOrchestrationService: MultiChannelOrchestrationService | null = null;

export const getMultiChannelOrchestrationService = (): MultiChannelOrchestrationService => {
  if (!multiChannelOrchestrationService) {
    multiChannelOrchestrationService = new MultiChannelOrchestrationService();
  }
  return multiChannelOrchestrationService;
};

export { MultiChannelOrchestrationService };
export type {
  Channel,
  OrchestrationStrategy,
  OrchestrationStep,
  OrchestrationCondition,
  ContactChannelPreferences,
  OrchestrationResult,
  OrchestrationStepResult
};