/**
 * Deal AI Model Router
 * Routes deal AI tasks to a gateway tier (fast | default | deep) by complexity.
 * The server maps tiers to concrete models (gpt-6-luna / gpt-6.1-sol / gpt-6-astra).
 */

import { DealAiTask } from './types';

export const MODEL_ROUTING = {
  // Fast responses for simple tasks
  fast: [
    // Primary actions - quick insights
    'deal_favorite_insights', 'deal_share_summary',

    // Simple SDR tasks
    'sdr_bump_message',

    // Basic modal features
    'email_ai_generate', 'contact_selector_suggestions', 'tag_suggestions',
    'custom_field_helper',

    // Simple automation
    'automation_meeting_times'
  ],

  // Balanced reasoning for complex workflows
  default: [
    // Deal analysis
    'deal_analyze', 'deal_edit_helper', 'sidebar_deal_analyze',

    // SDR sequences and objection handling
    'sdr_follow_up', 'sdr_objection_handler', 'sdr_high_intent', 'sdr_competitor',
    'sdr_reactivation', 'sdr_winback', 'sdr_linkedin', 'sdr_whatsapp',
    'sdr_event_based', 'sdr_referral', 'sdr_newsletter_lead_in', 'sdr_cold_email',

    // Contact intelligence
    'sdr_enrich_contact', 'sidebar_contact_analysis', 'sidebar_contact_enrichment',

    // AI chat agents
    'agent_sales_assistant', 'agent_calendar_assistant', 'agent_contact_intelligence',
    'agent_lead_qualifier', 'agent_communication_manager',

    // Navigation tabs
    'tab_journey_summary', 'tab_communication_summary', 'tab_automation_summary',

    // Automation features
    'automation_followups', 'automation_stage_progression', 'automation_email_sequences',
    'automation_call_scheduling', 'automation_progress_tracking'
  ],

  // Advanced reasoning for predictions and intelligence
  deep: [
    // Intelligence layer
    'intel_next_best_actions', 'intel_risk_assessment', 'intel_value_prediction',
    'intel_timeline_estimation', 'intel_deal_scoring', 'intel_stakeholder_analysis',
    'intel_company_intelligence', 'intel_competitive_analysis',

    // Advanced analytics
    'tab_ai_insights', 'tab_analytics_summary',

    // Advanced agents
    'agent_analytics_expert', 'agent_risk_assessor', 'agent_achievement_coach',
    'agent_deal_analyst',

    // Advanced automation
    'automation_risk_alerts', 'automation_deal_status_updates',

    // Complex features
    'sidebar_find_new_image', 'sidebar_ai_goals', 'email_ai_with_persona'
  ]
};

export type DealAiTier = 'fast' | 'default' | 'deep';

export function getOptimalModel(task: DealAiTask): DealAiTier {
  for (const [tier, tasks] of Object.entries(MODEL_ROUTING)) {
    if ((tasks as string[]).includes(task)) return tier as DealAiTier;
  }
  return 'default';
}

export function getModelCapabilities(tier: string): {
  maxTokens: number;
  reasoningEffort: 'none' | 'low' | 'medium' | 'high';
  supportsTools: boolean;
  costPerToken: number;
} {
  // costPerToken is 0 until pricing is configured for the account.
  const capabilities: Record<DealAiTier, {
    maxTokens: number;
    reasoningEffort: 'none' | 'low' | 'medium' | 'high';
    supportsTools: boolean;
    costPerToken: number;
  }> = {
    fast: { maxTokens: 4096, reasoningEffort: 'none', supportsTools: true, costPerToken: 0 },
    default: { maxTokens: 8192, reasoningEffort: 'medium', supportsTools: true, costPerToken: 0 },
    deep: { maxTokens: 16384, reasoningEffort: 'high', supportsTools: true, costPerToken: 0 },
  };
  return capabilities[tier as DealAiTier] || capabilities.default;
}

export function getFallbackModels(primaryTier: string): string[] {
  const fallbacks: Record<DealAiTier, DealAiTier[]> = {
    deep: ['deep', 'default'],
    default: ['default', 'fast'],
    fast: ['fast', 'default'],
  };
  return fallbacks[primaryTier as DealAiTier] || ['default', 'fast'];
}
