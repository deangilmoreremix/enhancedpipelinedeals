/**
 * Production Configuration for SDR Agents
 * OpenAI Agents SDK Integration
 */

export interface SDRProductionConfig {
  // OpenAI Configuration
  openai: {
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
    rateLimit: {
      requestsPerMinute: number;
      requestsPerHour: number;
    };
  };

  };

  // Database Configuration
  database: {
    tablePrefix: string;
    metricsRetentionDays: number;
    activityRetentionDays: number;
  };

  // Agent-specific configurations
  agents: {
    [agentId: string]: {
      enabled: boolean;
      maxConcurrency: number;
      cooldownMs: number;
      customPrompts?: Record<string, string>;
      rateLimits?: {
        perContactPerDay: number;
        perContactPerWeek: number;
      };
    };
  };

  // Monitoring and Alerting
  monitoring: {
    enableMetrics: boolean;
    alertThresholds: {
      errorRatePercent: number;
      responseTimeMs: number;
      successRatePercent: number;
    };
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };

  // Feature Flags
  features: {
    enableDatabasePersistence: boolean;
    enableRealTimeMetrics: boolean;
    enableAIFallback: boolean;
    enableRateLimiting: boolean;
  };
}

export const defaultProductionConfig: SDRProductionConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000,
    rateLimit: {
      requestsPerMinute: 50,
      requestsPerHour: 1000,
    },
  },

  // Note: AgentMail email service has been removed

  database: {
    tablePrefix: 'sdr_',
    metricsRetentionDays: 90,
    activityRetentionDays: 365,
  },

  agents: {
    'sdr-data-enrichment': {
      enabled: true,
      maxConcurrency: 5,
      cooldownMs: 1000,
      rateLimits: {
        perContactPerDay: 1,
        perContactPerWeek: 3,
      },
    },
    'sdr-competitor-aware': {
      enabled: true,
      maxConcurrency: 3,
      cooldownMs: 2000,
      rateLimits: {
        perContactPerDay: 2,
        perContactPerWeek: 5,
      },
    },
    'sdr-cold-email': {
      enabled: true,
      maxConcurrency: 10,
      cooldownMs: 500,
      rateLimits: {
        perContactPerDay: 1,
        perContactPerWeek: 2,
      },
    },
    'sdr-follow-up': {
      enabled: true,
      maxConcurrency: 8,
      cooldownMs: 1000,
      rateLimits: {
        perContactPerDay: 2,
        perContactPerWeek: 5,
      },
    },
    'sdr-objection-handling': {
      enabled: true,
      maxConcurrency: 5,
      cooldownMs: 1500,
      rateLimits: {
        perContactPerDay: 3,
        perContactPerWeek: 10,
      },
    },
  },

  monitoring: {
    enableMetrics: true,
    alertThresholds: {
      errorRatePercent: 10,
      responseTimeMs: 30000,
      successRatePercent: 80,
    },
    logLevel: 'info',
  },

  features: {
    enableDatabasePersistence: true,
    enableRealTimeMetrics: true,
    enableAIFallback: true,
    enableRateLimiting: true,
  },
};

/**
 * Load production configuration with environment variable overrides
 */
export function loadProductionConfig(): SDRProductionConfig {
  const config = { ...defaultProductionConfig };

  // Override with environment variables
  if (process.env.OPENAI_API_KEY) {
    config.openai.apiKey = process.env.OPENAI_API_KEY;
  }

  // Note: AgentMail email service has been removed

  // Override rate limits from environment
  if (process.env.SDR_OPENAI_RPM) {
    config.openai.rateLimit.requestsPerMinute = parseInt(process.env.SDR_OPENAI_RPM);
  }

  return config;
}

/**
 * Validate production configuration
 */
export function validateProductionConfig(config: SDRProductionConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate OpenAI
  if (!config.openai.apiKey) {
    errors.push('OpenAI API key is required');
  }

  // Email service validation (AgentMail removed)
  // Note: Email sending is not configured

  // Validate rate limits
  if (config.openai.rateLimit.requestsPerMinute < 1) {
    errors.push('OpenAI requests per minute must be at least 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}