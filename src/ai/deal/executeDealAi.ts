/**
 * Deal AI Orchestrator - Main Execution Engine
 * Routes and executes all AI tasks for deal management
 */

import { DealAiRequest, DealAiResponse, DealAiTask } from './types';
import { getOptimalModel, getModelCapabilities, getFallbackModels } from './modelRouter';
import { buildDealContext, summarizeContext } from './contextBuilder';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../lib/core/logger';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function executeDealAi(request: DealAiRequest): Promise<DealAiResponse> {
  const startTime = Date.now();

  try {
    logger.info(`Executing Deal AI task: ${request.task}`, { dealId: request.dealId, workspaceId: request.workspaceId });

    // Build context if not provided
    const context = request.context || await buildDealContext(request.dealId, request.workspaceId);

    // Get optimal model for this task
    const model = getOptimalModel(request.task);
    const capabilities = getModelCapabilities(model);

    logger.info(`Selected model for task`, { model, reasoningEffort: capabilities.reasoningEffort, task: request.task });

    // Get task handler
    const handler = getTaskHandler(request.task);
    if (!handler) {
      throw new Error(`No handler found for task: ${request.task}`);
    }

    // Execute with fallback models if needed
    let result;
    const modelsToTry = [model, ...getFallbackModels(model)];

    for (const modelToTry of modelsToTry) {
      try {
        logger.info(`Trying fallback model`, { model: modelToTry, task: request.task });
        result = await handler(request, context, modelToTry, capabilities);
        logger.info(`Model execution successful`, { model: modelToTry, task: request.task });
        break; // Success, exit loop
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`Model execution failed`, { model: modelToTry, error: errorMessage, task: request.task });
        if (modelToTry === modelsToTry[modelsToTry.length - 1]) {
          throw error; // All models failed
        }
        continue; // Try next model
      }
    }

    // Calculate cost and log usage
    const tokens = result?.usage?.total_tokens || 0;
    const cost = calculateCost(model, tokens);

    await logUsage(request, result, startTime, cost);

    return {
      success: true,
      result,
      metadata: {
        model,
        tokens,
        cost,
        executionTime: Date.now() - startTime
      }
    };

  } catch (error) {
    logger.error('Deal AI execution failed', { error: error instanceof Error ? error.message : String(error), task: request.task, dealId: request.dealId });

    // Log failed execution
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logUsage(request, { error: errorMessage }, startTime, 0);

    return {
      success: false,
      result: { error: errorMessage },
      metadata: {
        model: 'error',
        tokens: 0,
        cost: 0,
        executionTime: Date.now() - startTime
      }
    };
  }
}

function getTaskHandler(task: DealAiTask) {
  const handlers: Record<string, Function> = {
    // Primary actions
    deal_analyze: handleDealAnalyze,
    deal_favorite_insights: handleFavoriteInsights,
    deal_share_summary: handleShareSummary,
    deal_edit_helper: handleEditHelper,

    // SDR agents (route to SDR engine)
    sdr_enrich_contact: handleSDRAgent,
    sdr_competitor: handleSDRAgent,
    sdr_objection_handler: handleSDRAgent,
    sdr_follow_up: handleSDRAgent,
    sdr_high_intent: handleSDRAgent,
    sdr_bump_message: handleSDRAgent,
    sdr_reactivation: handleSDRAgent,
    sdr_winback: handleSDRAgent,
    sdr_linkedin: handleSDRAgent,
    sdr_whatsapp: handleSDRAgent,
    sdr_event_based: handleSDRAgent,
    sdr_referral: handleSDRAgent,
    sdr_newsletter_lead_in: handleSDRAgent,
    sdr_cold_email: handleSDRAgent,

    // AI chat agents (route to agent engine)
    agent_sales_assistant: handleAgentChat,
    agent_analytics_expert: handleAgentChat,
    agent_calendar_assistant: handleAgentChat,
    agent_risk_assessor: handleAgentChat,
    agent_achievement_coach: handleAgentChat,
    agent_contact_intelligence: handleAgentChat,
    agent_lead_qualifier: handleAgentChat,
    agent_communication_manager: handleAgentChat,
    agent_deal_analyst: handleAgentChat,

    // Navigation tabs
    tab_ai_insights: handleIntelligence,
    tab_journey_summary: handleIntelligence,
    tab_communication_summary: handleIntelligence,
    tab_analytics_summary: handleIntelligence,
    tab_automation_summary: handleIntelligence,

    // Sidebar features
    sidebar_deal_analyze: handleDealAnalyze,
    sidebar_contact_analysis: handleIntelligence,
    sidebar_contact_enrichment: handleSDRAgent,
    sidebar_find_new_image: handleIntelligence,
    sidebar_ai_goals: handleIntelligence,

    // Modal features
    email_ai_generate: handleEmailGenerate,
    email_ai_with_persona: handleEmailGenerate,
    contact_selector_suggestions: handleIntelligence,
    custom_field_helper: handleIntelligence,
    tag_suggestions: handleIntelligence,

    // Automation features
    automation_meeting_times: handleAutomation,
    automation_followups: handleAutomation,
    automation_stage_progression: handleAutomation,
    automation_risk_alerts: handleAutomation,
    automation_deal_status_updates: handleAutomation,
    automation_email_sequences: handleAutomation,
    automation_call_scheduling: handleAutomation,
    automation_progress_tracking: handleAutomation,

    // Intelligence layer
    intel_next_best_actions: handleIntelligence,
    intel_risk_assessment: handleIntelligence,
    intel_value_prediction: handleIntelligence,
    intel_timeline_estimation: handleIntelligence,
    intel_deal_scoring: handleIntelligence,
    intel_stakeholder_analysis: handleIntelligence,
    intel_company_intelligence: handleIntelligence,
    intel_competitive_analysis: handleIntelligence
  };

  return handlers[task] || handleDefault;
}

// Task Handlers
async function handleDealAnalyze(request: DealAiRequest, context: any, model: string, capabilities: any) {
  const prompt = buildDealAnalysisPrompt(context);
  return await callOpenAI(prompt, model, capabilities);
}

async function handleFavoriteInsights(request: DealAiRequest, context: any, model: string, capabilities: any) {
  const prompt = `Analyze this deal and provide 1-2 bullet points explaining why it should be favorited: ${summarizeContext(context)}`;
  return await callOpenAI(prompt, model, capabilities);
}

async function handleShareSummary(request: DealAiRequest, context: any, model: string, capabilities: any) {
  const prompt = `Generate a professional deal summary suitable for sharing: ${summarizeContext(context)}`;
  return await callOpenAI(prompt, model, capabilities);
}

async function handleEditHelper(request: DealAiRequest, context: any, model: string, capabilities: any) {
  const prompt = `Based on this deal context, suggest what should be edited or improved: ${summarizeContext(context)}`;
  return await callOpenAI(prompt, model, capabilities);
}

async function handleSDRAgent(request: DealAiRequest, context: any, model: string, capabilities: any) {
  logger.info(`Executing SDR agent task`, { task: request.task, dealId: request.dealId });
  // Route to SDR sequence engine via sdrOrchestrator when available
  // For now, use basic handler with contextual prompt
  const prompt = `Execute SDR agent task ${request.task} with context: ${summarizeContext(context)}`;
  return await callOpenAI(prompt, model, capabilities);
}

async function handleAgentChat(request: DealAiRequest, context: any, model: string, capabilities: any) {
  logger.info(`Executing agent chat task`, { task: request.task, dealId: request.dealId });
  // Route to agent chat engine when available
  // For now, use basic handler with contextual prompt
  const prompt = `Handle agent chat for ${request.task} with context: ${summarizeContext(context)}`;
  return await callOpenAI(prompt, model, capabilities);
}

async function handleIntelligence(request: DealAiRequest, context: any, model: string, capabilities: any) {
  logger.info(`Executing intelligence task`, { task: request.task, dealId: request.dealId });
  // Route to intelligence engine when available
  // For now, use basic handler with contextual prompt
  const prompt = `Process intelligence task ${request.task} with context: ${summarizeContext(context)}`;
  return await callOpenAI(prompt, model, capabilities);
}

async function handleAutomation(request: DealAiRequest, context: any, model: string, capabilities: any) {
  logger.info(`Executing automation task`, { task: request.task, dealId: request.dealId });
  // Route to automation engine when available
  // For now, use basic handler with contextual prompt
  const prompt = `Process automation task ${request.task} with context: ${summarizeContext(context)}`;
  return await callOpenAI(prompt, model, capabilities);
}

async function handleEmailGenerate(request: DealAiRequest, context: any, model: string, capabilities: any) {
  const prompt = buildEmailPrompt(request.task, context, request.options);
  return await callOpenAI(prompt, model, capabilities);
}

async function handleDefault(request: DealAiRequest, context: any, model: string, capabilities: any) {
  const prompt = `Process this ${request.task} request with context: ${summarizeContext(context)}`;
  return await callOpenAI(prompt, model, capabilities);
}

// Helper Functions
async function callOpenAI(prompt: string, model: string, capabilities: any) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: capabilities.maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }

  return await response.json();
}

function buildDealAnalysisPrompt(context: any): string {
  return `Analyze this sales deal comprehensively:

Deal: ${context.deal?.title || 'Unknown'}
Value: $${context.deal?.value || 0}
Stage: ${context.deal?.stage || 'Unknown'}
Contact: ${context.contact?.name || 'Unknown'} at ${context.contact?.company || 'Unknown'}

Recent Activity: ${context.activities?.slice(0, 5).map((a: any) => a.message).join(', ') || 'None'}

Provide:
1. Deal health assessment (1-10 scale)
2. Key risks and opportunities
3. Recommended next actions
4. Win probability estimate
5. Timeline expectations`;
}

function buildEmailPrompt(task: string, context: any, options?: any): string {
  const persona = options?.persona || 'professional';
  const tone = options?.tone || 'professional';

  return `Generate a ${persona} email in ${tone} tone for this deal:

Deal: ${context.deal?.title || 'Unknown Deal'}
Contact: ${context.contact?.name || 'Unknown'} at ${context.contact?.company || 'Unknown'}
Stage: ${context.deal?.stage || 'Unknown'}

Context: ${summarizeContext(context)}

${options?.customInstructions || 'Generate an appropriate email for this situation.'}`;
}

function calculateCost(model: string, tokens: number): number {
  const rates: Record<string, number> = {
    'gpt-5.2-instant': 0.00015,
    'gpt-5.2-thinking': 0.0003,
    'gpt-5.2-pro': 0.0006
  };

  return (rates[model] || rates['gpt-5.2-thinking']) * tokens;
}

async function logUsage(request: DealAiRequest, result: any, startTime: number, cost: number) {
  try {
    await supabase.from('ai_usage_metrics').insert({
      user_id: request.userId || request.workspaceId,
      service_name: 'deal-ai-orchestrator',
      operation: request.task,
      model_used: result?.model || 'unknown',
      tokens_used: result?.usage?.total_tokens || 0,
      cost_usd: cost,
      duration_ms: Date.now() - startTime,
      success: !result?.error,
      error_message: result?.error || null,
      metadata: {
        dealId: request.dealId,
        workspaceId: request.workspaceId,
        options: request.options
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to log AI usage', { error: error instanceof Error ? error.message : String(error) });
  }
}