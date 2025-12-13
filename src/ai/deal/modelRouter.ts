/**
 * Deal AI Model Router
 * Intelligent routing to optimal GPT-5.2 variants based on task complexity
 */

import { DealAiTask } from './types';

export const MODEL_ROUTING = {
  // GPT-5.2 Instant - Fast responses for simple tasks
  'gpt-5.2-instant': [
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

  // GPT-5.2 Thinking - Balanced reasoning for complex workflows
  'gpt-5.2-thinking': [
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

  // GPT-5.2 Pro - Advanced reasoning for predictions and intelligence
  'gpt-5.2-pro': [
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

export function getOptimalModel(task: DealAiTask): string {
  for (const [model, tasks] of Object.entries(MODEL_ROUTING)) {
    if (tasks.includes(task)) {
      return model;
    }
  }
  return 'gpt-5.2-thinking'; // Default fallback
}

export function getModelCapabilities(model: string): {
  maxTokens: number;
  reasoningEffort: 'low' | 'medium' | 'high';
  supportsTools: boolean;
  costPerToken: number;
} {
  const capabilities: Record<string, {
    maxTokens: number;
    reasoningEffort: 'low' | 'medium' | 'high';
    supportsTools: boolean;
    costPerToken: number;
  }> = {
    'gpt-5.2-instant': {
      maxTokens: 4096,
      reasoningEffort: 'low',
      supportsTools: false,
      costPerToken: 0.00015
    },
    'gpt-5.2-thinking': {
      maxTokens: 8192,
      reasoningEffort: 'medium',
      supportsTools: true,
      costPerToken: 0.0003
    },
    'gpt-5.2-pro': {
      maxTokens: 16384,
      reasoningEffort: 'high',
      supportsTools: true,
      costPerToken: 0.0006
    }
  };

  return capabilities[model] || capabilities['gpt-5.2-thinking'];
}

export function getFallbackModels(primaryModel: string): string[] {
  const fallbacks: Record<string, string[]> = {
    'gpt-5.2-pro': ['gpt-5.2-thinking', 'gpt-5.2-instant'],
    'gpt-5.2-thinking': ['gpt-5.2-pro', 'gpt-5.2-instant'],
    'gpt-5.2-instant': ['gpt-5.2-thinking', 'gpt-5.2-pro']
  };

  return fallbacks[primaryModel] || ['gpt-5.2-thinking', 'gpt-5.2-instant'];
}