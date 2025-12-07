// SDR Agent User Configuration Types

export type SDRTone = 'professional' | 'conversational' | 'enthusiastic' | 'formal' | 'casual';
export type SDRStyle = 'brief' | 'detailed' | 'comprehensive';
export type SDRChannel = 'email' | 'linkedin' | 'whatsapp' | 'phone';
export type SDRSuccessMetric = 'opened' | 'clicked' | 'replied' | 'unsubscribed' | 'converted';
export type SDRTiming = 'immediate' | 'business-hours' | 'daily' | 'weekly' | 'custom';

export interface SDRCampaignStep {
  id: string;
  day: number; // Day in sequence (0 = immediate)
  channel: SDRChannel;
  template: string;
  subject?: string;
  delay: number; // Hours after previous step
  conditions?: string[]; // Conditions to trigger this step
}

export interface SDRBranding {
  companyName: string;
  signature: string;
  logo?: string;
  website?: string;
  tagline?: string;
}

export interface SDRSuccessCriteria {
  metric: SDRSuccessMetric;
  weight: number; // 0-1, importance weight
  action: 'continue' | 'escalate' | 'stop' | 'handover';
  threshold?: number; // For metrics with values
}

export interface SDRChannelPreferences {
  primary: SDRChannel;
  secondary: SDRChannel[];
  conditions: Record<SDRChannel, string>; // When to use each channel
  limits: Record<SDRChannel, number>; // Max messages per channel
}

export interface SDRAgentPreferences {
  // Basic Settings
  campaignLength: number; // 3-10 messages
  timing: SDRTiming;
  customSchedule?: number[]; // Custom delays in hours

  // Content & Style
  tone: SDRTone;
  style: SDRStyle;
  personalizationLevel: 'low' | 'medium' | 'high';

  // Branding
  branding: SDRBranding;

  // Channels
  channels: SDRChannelPreferences;

  // Success & Performance
  successCriteria: SDRSuccessCriteria[];
  followUpRules: Record<string, string>; // Dynamic follow-up logic

  // Advanced AI Settings
  aiModel?: string;
  temperature?: number; // 0-1
  maxTokens?: number;
  customPrompts?: Record<string, string>;

  // Campaign Sequence
  campaignSequence?: SDRCampaignStep[];

  // Performance Tuning
  performanceSettings?: {
    maxRetries: number;
    backoffMultiplier: number;
    successThreshold: number;
    abandonmentRules: Record<string, any>;
  };
}

export interface SDRUserPreferences {
  id?: string;
  userId: string;
  agentId: string;
  preferences: SDRAgentPreferences;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SDRCampaignTemplate {
  id?: string;
  userId: string;
  name: string;
  agentId: string;
  description?: string;
  sequence: SDRCampaignStep[];
  settings: SDRAgentPreferences;
  isPublic: boolean;
  tags: string[];
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SDRPresetConfiguration {
  id: string;
  name: string;
  description: string;
  agentId: string;
  category: 'conservative' | 'aggressive' | 'balanced' | 'industry-specific';
  preferences: SDRAgentPreferences;
  recommendedFor: string[];
  successRate?: number;
}

// Default configurations for each agent
export const SDR_AGENT_DEFAULTS: Record<string, Partial<SDRAgentPreferences>> = {
  'sdr-follow-up': {
    campaignLength: 5,
    timing: 'business-hours',
    tone: 'professional',
    style: 'detailed',
    personalizationLevel: 'medium',
    channels: {
      primary: 'email',
      secondary: ['linkedin'],
      conditions: {
        email: 'always',
        linkedin: 'after_3_emails',
        whatsapp: 'never',
        phone: 'never'
      },
      limits: {
        email: 5,
        linkedin: 2,
        whatsapp: 1,
        phone: 0
      }
    }
  },
  'sdr-cold-email': {
    campaignLength: 7,
    timing: 'weekly',
    tone: 'enthusiastic',
    style: 'comprehensive',
    personalizationLevel: 'high',
    channels: {
      primary: 'email',
      secondary: ['linkedin'],
      conditions: {
        email: 'always',
        linkedin: 'after_5_emails',
        whatsapp: 'never',
        phone: 'never'
      },
      limits: {
        email: 7,
        linkedin: 3,
        whatsapp: 0,
        phone: 0
      }
    }
  },
  'sdr-data-enrichment': {
    campaignLength: 1, // Single enrichment action
    timing: 'immediate',
    tone: 'professional',
    style: 'brief',
    personalizationLevel: 'low'
  }
};