/**
 * Deal AI Context Builder
 * Builds comprehensive context for AI processing from database and memory
 */

import { DealContext } from './types';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function buildDealContext(dealId: string, workspaceId: string): Promise<DealContext> {
  console.log(`Building context for deal ${dealId} in workspace ${workspaceId}`);

  // Parallel data fetching for performance
  const [
    dealResult,
    contactResult,
    activitiesResult,
    analyticsResult,
    memoryResult,
    settingsResult
  ] = await Promise.allSettled([
    getDealData(dealId),
    getContactData(dealId),
    getActivities(dealId),
    getAnalytics(dealId),
    getMemory(dealId),
    getSettings(workspaceId)
  ]);

  // Extract results with fallbacks
  const deal = dealResult.status === 'fulfilled' ? dealResult.value : null;
  const contact = contactResult.status === 'fulfilled' ? contactResult.value : null;
  const activities = activitiesResult.status === 'fulfilled' ? activitiesResult.value : [];
  const analytics = analyticsResult.status === 'fulfilled' ? analyticsResult.value : {};
  const memory = memoryResult.status === 'fulfilled' ? memoryResult.value : [];
  const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : [];

  // Log any failures for debugging
  [dealResult, contactResult, activitiesResult, analyticsResult, memoryResult, settingsResult]
    .forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`Context building failed for ${['deal', 'contact', 'activities', 'analytics', 'memory', 'settings'][index]}:`, result.reason);
      }
    });

  return {
    deal,
    contact,
    activities,
    analytics,
    memory,
    settings
  };
}

async function getDealData(dealId: string) {
  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      contacts (
        id,
        name,
        email,
        company,
        title,
        lead_score,
        persona,
        autopilot_state
      )
    `)
    .eq('id', dealId)
    .single();

  if (error) throw error;
  return data;
}

async function getContactData(dealId: string) {
  // Get contact ID from deal first
  const { data: deal } = await supabase
    .from('deals')
    .select('contact_id')
    .eq('id', dealId)
    .single();

  if (!deal?.contact_id) return null;

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', deal.contact_id)
    .single();

  if (error) throw error;
  return data;
}

async function getActivities(dealId: string) {
  // Get contact ID first
  const { data: deal } = await supabase
    .from('deals')
    .select('contact_id')
    .eq('id', dealId)
    .single();

  if (!deal?.contact_id) return [];

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('contact_id', deal.contact_id)
    .order('created_at', { ascending: false })
    .limit(50); // Last 50 activities for context

  if (error) throw error;
  return data || [];
}

async function getAnalytics(dealId: string) {
  // Get deal analytics from various sources
  const [
    dealHistory,
    riskData,
    predictionData,
    usageMetrics
  ] = await Promise.allSettled([
    getDealHistory(dealId),
    getRiskData(dealId),
    getPredictionData(dealId),
    getUsageMetrics(dealId)
  ]);

  return {
    history: dealHistory.status === 'fulfilled' ? dealHistory.value : [],
    risk: riskData.status === 'fulfilled' ? riskData.value : null,
    predictions: predictionData.status === 'fulfilled' ? predictionData.value : null,
    usage: usageMetrics.status === 'fulfilled' ? usageMetrics.value : []
  };
}

async function getDealHistory(dealId: string) {
  const { data, error } = await supabase
    .from('deal_history')
    .select('*')
    .eq('deal_id', dealId)
    .order('changed_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
}

async function getRiskData(dealId: string) {
  const { data, error } = await supabase
    .from('deal_risk_daily')
    .select('*')
    .eq('deal_id', dealId)
    .order('date', { ascending: false })
    .limit(30); // Last 30 days

  if (error) throw error;
  return data?.[0] || null; // Most recent risk data
}

async function getPredictionData(dealId: string) {
  // This would integrate with prediction models
  // For now, return basic structure
  return {
    winProbability: null,
    expectedValue: null,
    timeline: null,
    lastUpdated: new Date().toISOString()
  };
}

async function getUsageMetrics(dealId: string) {
  // Get contact ID first
  const { data: deal } = await supabase
    .from('deals')
    .select('contact_id')
    .eq('id', dealId)
    .single();

  if (!deal?.contact_id) return [];

  const { data, error } = await supabase
    .from('ai_usage_metrics')
    .select('*')
    .eq('metadata->>dealId', dealId)
    .order('timestamp', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
}

async function getMemory(dealId: string) {
  // Get contact ID first
  const { data: deal } = await supabase
    .from('deals')
    .select('contact_id')
    .eq('id', dealId)
    .single();

  if (!deal?.contact_id) return [];

  const { data, error } = await supabase
    .from('agent_memory')
    .select('*')
    .eq('contact_id', deal.contact_id)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function getSettings(workspaceId: string) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .or(`user_id.eq.${workspaceId},user_id.is.null`)
    .order('user_id', { ascending: false }); // User settings first, then global

  if (error) throw error;
  return data || [];
}

export function summarizeContext(context: DealContext): string {
  const { deal, contact, activities, analytics } = context;

  let summary = '';

  // Deal summary
  if (deal) {
    summary += `Deal: ${deal.title || 'Untitled'} - $${deal.value || 0} in ${deal.stage || 'unknown'} stage. `;
  }

  // Contact summary
  if (contact) {
    summary += `Contact: ${contact.name || 'Unknown'} at ${contact.company || 'Unknown company'}. `;
    if (contact.lead_score) {
      summary += `Lead score: ${contact.lead_score}/100. `;
    }
  }

  // Activity summary
  if (activities?.length > 0) {
    const recentActivity = activities[0];
    const daysSinceActivity = Math.floor((Date.now() - new Date(recentActivity.created_at).getTime()) / (1000 * 60 * 60 * 24));
    summary += `Last activity ${daysSinceActivity} days ago: ${recentActivity.type}. `;
  }

  // Risk summary
  if (analytics?.risk) {
    summary += `Current risk score: ${analytics.risk.risk_score}/100. `;
  }

  return summary.trim();
}