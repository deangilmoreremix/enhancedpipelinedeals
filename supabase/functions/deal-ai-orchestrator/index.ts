/**
 * Deal AI Orchestrator - Main Edge Function
 * Routes and executes all AI tasks for deal management and sales automation
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("🤖 Deal AI Orchestrator Edge Function loaded")

interface DealAiRequest {
  task: string;
  dealId: string;
  workspaceId: string;
  options?: Record<string, any>;
  userId?: string;
  context?: any;
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const request: DealAiRequest = await req.json()
    const { task, dealId, workspaceId, options, userId, context } = request

    console.log(`🎯 Processing Deal AI task: ${task} for deal ${dealId}`)

    // Validate required fields
    if (!task || !dealId || !workspaceId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: task, dealId, workspaceId'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Route to appropriate engine based on task type
    const result = await routeToEngine(task, {
      dealId,
      workspaceId,
      options: options || {},
      userId,
      context
    }, supabase)

    console.log(`✅ Successfully processed ${task} for deal ${dealId}`)

    return new Response(
      JSON.stringify({
        success: true,
        result,
        metadata: {
          task,
          dealId,
          workspaceId,
          timestamp: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Deal AI Orchestrator error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function routeToEngine(task: string, params: any, supabase: any) {
  const { dealId, workspaceId, options, userId, context } = params

  // Primary action buttons
  if (['deal_analyze', 'deal_favorite_insights', 'deal_share_summary', 'deal_edit_helper'].includes(task)) {
    return await handlePrimaryActions(task, dealId, workspaceId, supabase)
  }

  // SDR agents (15 agents)
  if (task.startsWith('sdr_')) {
    return await handleSDRAgents(task, dealId, workspaceId, options, supabase)
  }

  // AI chat agents (10 agents)
  if (task.startsWith('agent_')) {
    return await handleAgentChat(task, dealId, workspaceId, options, supabase)
  }

  // Navigation tabs
  if (task.startsWith('tab_')) {
    return await handleIntelligence(task, dealId, workspaceId, supabase)
  }

  // Sidebar features
  if (task.startsWith('sidebar_')) {
    return await handleIntelligence(task, dealId, workspaceId, supabase)
  }

  // Modal features
  if (['email_ai_generate', 'email_ai_with_persona', 'contact_selector_suggestions', 'custom_field_helper', 'tag_suggestions'].includes(task)) {
    return await handleModalFeatures(task, dealId, workspaceId, options, supabase)
  }

  // Automation features
  if (task.startsWith('automation_')) {
    return await handleAutomation(task, dealId, workspaceId, supabase)
  }

  // Intelligence layer
  if (['intel_next_best_actions', 'intel_risk_assessment', 'intel_value_prediction', 'intel_timeline_estimation', 'intel_deal_scoring', 'intel_stakeholder_analysis', 'intel_company_intelligence', 'intel_competitive_analysis'].includes(task)) {
    return await handleIntelligence(task, dealId, workspaceId, supabase)
  }

  // Default fallback
  return await handleDefault(task, dealId, workspaceId, supabase)
}

async function handlePrimaryActions(task: string, dealId: string, workspaceId: string, supabase: any) {
  // Build context
  const context = await buildDealContext(dealId, workspaceId, supabase)

  let prompt = ''
  switch (task) {
    case 'deal_analyze':
      prompt = buildDealAnalysisPrompt(context)
      break
    case 'deal_favorite_insights':
      prompt = `Analyze this deal and provide 1-2 bullet points explaining why it should be favorited: ${summarizeContext(context)}`
      break
    case 'deal_share_summary':
      prompt = `Generate a professional deal summary suitable for sharing: ${summarizeContext(context)}`
      break
    case 'deal_edit_helper':
      prompt = `Based on this deal context, suggest what should be edited or improved: ${summarizeContext(context)}`
      break
  }

  return await callOpenAI(prompt, 'gpt-5.2-thinking')
}

async function handleSDRAgents(task: string, dealId: string, workspaceId: string, options: any, supabase: any) {
  // Route to SDR sequence engine
  const sdrEngineUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sdr-sequence-engine`

  const response = await fetch(sdrEngineUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
    },
    body: JSON.stringify({
      task,
      dealId,
      workspaceId,
      options
    })
  })

  if (!response.ok) {
    throw new Error(`SDR engine failed: ${response.statusText}`)
  }

  return await response.json()
}

async function handleAgentChat(task: string, dealId: string, workspaceId: string, options: any, supabase: any) {
  // Route to agent chat engine
  const agentEngineUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-chat-engine`

  const response = await fetch(agentEngineUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
    },
    body: JSON.stringify({
      task,
      dealId,
      workspaceId,
      options
    })
  })

  if (!response.ok) {
    throw new Error(`Agent chat engine failed: ${response.statusText}`)
  }

  return await response.json()
}

async function handleIntelligence(task: string, dealId: string, workspaceId: string, supabase: any) {
  // Route to intelligence engine
  const intelEngineUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/intelligence-engine`

  const response = await fetch(intelEngineUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
    },
    body: JSON.stringify({
      task,
      dealId,
      workspaceId
    })
  })

  if (!response.ok) {
    throw new Error(`Intelligence engine failed: ${response.statusText}`)
  }

  return await response.json()
}

async function handleAutomation(task: string, dealId: string, workspaceId: string, supabase: any) {
  // Route to automation engine
  const autoEngineUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/automation-engine`

  const response = await fetch(autoEngineUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
    },
    body: JSON.stringify({
      task,
      dealId,
      workspaceId
    })
  })

  if (!response.ok) {
    throw new Error(`Automation engine failed: ${response.statusText}`)
  }

  return await response.json()
}

async function handleModalFeatures(task: string, dealId: string, workspaceId: string, options: any, supabase: any) {
  const context = await buildDealContext(dealId, workspaceId, supabase)

  let prompt = ''
  switch (task) {
    case 'email_ai_generate':
    case 'email_ai_with_persona':
      prompt = buildEmailPrompt(task, context, options)
      break
    case 'contact_selector_suggestions':
      prompt = `Suggest relevant contacts for this deal: ${summarizeContext(context)}`
      break
    case 'custom_field_helper':
      prompt = `Suggest appropriate custom fields for this deal: ${summarizeContext(context)}`
      break
    case 'tag_suggestions':
      prompt = `Suggest relevant tags for this deal: ${summarizeContext(context)}`
      break
  }

  return await callOpenAI(prompt, 'gpt-5.2-instant')
}

async function handleDefault(task: string, dealId: string, workspaceId: string, supabase: any) {
  const context = await buildDealContext(dealId, workspaceId, supabase)
  const prompt = `Process this ${task} request with context: ${summarizeContext(context)}`
  return await callOpenAI(prompt, 'gpt-5.2-thinking')
}

// Helper Functions
async function buildDealContext(dealId: string, workspaceId: string, supabase: any) {
  // Get deal data
  const { data: deal } = await supabase
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .single()

  // Get contact data
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', deal.contact_id)
    .single()

  // Get recent activities
  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('contact_id', deal.contact_id)
    .order('created_at', { ascending: false })
    .limit(20)

  return { deal, contact, activities: activities || [] }
}

function summarizeContext(context: any): string {
  const { deal, contact, activities } = context
  let summary = ''

  if (deal) {
    summary += `Deal: ${deal.title || 'Untitled'} - $${deal.value || 0} in ${deal.stage || 'unknown'} stage. `
  }

  if (contact) {
    summary += `Contact: ${contact.name || 'Unknown'} at ${contact.company || 'Unknown company'}. `
  }

  if (activities?.length > 0) {
    const recentActivity = activities[0]
    const daysSinceActivity = Math.floor((Date.now() - new Date(recentActivity.created_at).getTime()) / (1000 * 60 * 60 * 24))
    summary += `Last activity ${daysSinceActivity} days ago: ${recentActivity.type}. `
  }

  return summary.trim()
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
5. Timeline expectations`
}

function buildEmailPrompt(task: string, context: any, options?: any): string {
  const persona = options?.persona || 'professional'
  const tone = options?.tone || 'professional'

  return `Generate a ${persona} email in ${tone} tone for this deal:

Deal: ${context.deal?.title || 'Unknown Deal'}
Contact: ${context.contact?.name || 'Unknown'} at ${context.contact?.company || 'Unknown'}
Stage: ${context.deal?.stage || 'Unknown'}

Context: ${summarizeContext(context)}

${options?.customInstructions || 'Generate an appropriate email for this situation.'}`
}

async function callOpenAI(prompt: string, model: string): Promise<any> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured')
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
      max_tokens: 1000,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
  }

  return await response.json()
}