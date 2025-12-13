/**
 * Deal AI Orchestrator - Type Definitions
 * Comprehensive AI system for deal management and sales automation
 */

export type DealAiTask =
  // Primary Action Buttons
  | "deal_analyze" | "deal_favorite_insights" | "deal_share_summary" | "deal_edit_helper"

  // SDR Agent Buttons (15 agents)
  | "sdr_enrich_contact" | "sdr_competitor" | "sdr_objection_handler" | "sdr_follow_up"
  | "sdr_high_intent" | "sdr_bump_message" | "sdr_reactivation" | "sdr_winback"
  | "sdr_linkedin" | "sdr_whatsapp" | "sdr_event_based" | "sdr_referral"
  | "sdr_newsletter_lead_in" | "sdr_cold_email"

  // AI Chat Agents (10 agents)
  | "agent_sales_assistant" | "agent_analytics_expert" | "agent_calendar_assistant"
  | "agent_risk_assessor" | "agent_achievement_coach" | "agent_contact_intelligence"
  | "agent_lead_qualifier" | "agent_communication_manager" | "agent_deal_analyst"

  // Navigation Tabs (5 tabs)
  | "tab_ai_insights" | "tab_journey_summary" | "tab_communication_summary"
  | "tab_analytics_summary" | "tab_automation_summary"

  // Sidebar Features
  | "sidebar_deal_analyze" | "sidebar_contact_analysis" | "sidebar_contact_enrichment"
  | "sidebar_find_new_image" | "sidebar_ai_goals"

  // Modal Features
  | "email_ai_generate" | "email_ai_with_persona" | "contact_selector_suggestions"
  | "custom_field_helper" | "tag_suggestions"

  // Automation Features
  | "automation_meeting_times" | "automation_followups" | "automation_stage_progression"
  | "automation_risk_alerts" | "automation_deal_status_updates" | "automation_email_sequences"
  | "automation_call_scheduling" | "automation_progress_tracking"

  // Intelligence Layer (8 features)
  | "intel_next_best_actions" | "intel_risk_assessment" | "intel_value_prediction"
  | "intel_timeline_estimation" | "intel_deal_scoring" | "intel_stakeholder_analysis"
  | "intel_company_intelligence" | "intel_competitive_analysis";

export interface DealAiRequest {
  task: DealAiTask;
  dealId: string;
  workspaceId: string;
  options?: Record<string, any>;
  userId?: string;
  context?: DealContext;
}

export interface DealContext {
  deal: any;
  contact: any;
  activities: any[];
  analytics: any;
  memory: any;
  settings: any;
}

export interface DealAiResponse {
  success: boolean;
  result: any;
  metadata: {
    model: string;
    tokens: number;
    cost: number;
    executionTime: number;
  };
}

export interface SDRSequence {
  sequence: SDRStep[];
  totalDuration: number;
  expectedEngagement: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface SDRStep {
  dayOffset: number;
  channel: 'email' | 'linkedin' | 'whatsapp' | 'call';
  subject?: string;
  content: string;
  goal: string;
  followUpAction?: string;
}

export interface IntelligenceResult {
  score?: number;
  confidence: number;
  insights: string[];
  recommendations: string[];
  riskFactors?: string[];
  timeline?: {
    estimated: number;
    confidence: number;
    factors: string[];
  };
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  conditions: any[];
  actions: any[];
  isActive: boolean;
  performance: {
    triggered: number;
    successful: number;
    failed: number;
  };
}