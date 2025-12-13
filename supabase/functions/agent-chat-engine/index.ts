/**
 * Agent Chat Engine - Conversational AI agents for sales assistance
 * Handles 10 different AI chat agents with memory and context
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("🤖 Agent Chat Engine Edge Function loaded")

interface AgentChatRequest {
  task: string;
  dealId: string;
  workspaceId: string;
  options?: Record<string, any>;
  message?: string;
  conversationHistory?: any[];
}

const AGENT_PROMPTS = {
  'agent_sales_assistant': `You are an expert sales assistant. Analyze deals and provide actionable next steps to move them forward. Focus on timing, stakeholder management, and deal progression strategies.`,

  'agent_analytics_expert': `You are a sales analytics expert. Provide deep insights into pipeline performance, conversion rates, and predictive analytics. Use data-driven recommendations.`,

  'agent_calendar_assistant': `You are a calendar and scheduling expert. Help optimize meeting times, follow-up schedules, and time management for sales activities.`,

  'agent_risk_assessor': `You are a deal risk assessment specialist. Evaluate deal health, identify red flags, and provide risk mitigation strategies.`,

  'agent_achievement_coach': `You are a sales performance coach. Help users achieve their goals through motivation, strategy, and habit formation.`,

  'agent_contact_intelligence': `You are a contact relationship expert. Analyze communication patterns, relationship strength, and provide insights about stakeholder dynamics.`,

  'agent_lead_qualifier': `You are a lead qualification specialist. Use BANT, MEDDIC, or other frameworks to assess lead quality and readiness.`,

  'agent_communication_manager': `You are a communication strategist. Optimize messaging, timing, and channel selection for sales interactions.`,

  'agent_deal_analyst': `You are a deal analysis expert. Provide "what would you do with this deal" style analysis with specific recommendations.`
};

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const request: AgentChatRequest = await req.json()
    const { task, dealId, workspaceId, options, message, conversationHistory } = request

    console.log(`🤖 Processing agent chat: ${task} for deal ${dealId}`)

    // Build comprehensive context
    const context = await buildAgentContext(dealId, workspaceId, supabase)

    // Get agent prompt
    const agentPrompt = AGENT_PROMPTS[task as keyof typeof AGENT_PROMPTS] || 'You are a helpful sales assistant.'

    // Generate response
    const response = await generateAgentResponse(agentPrompt, context, message, conversationHistory, options)

    return new Response(
      JSON.stringify({
        success: true,
        response,
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
    console.error('❌ Agent Chat Engine error:', error)

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

async function buildAgentContext(dealId: string, workspaceId: string, supabase: any) {
  // Get deal with full context
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      *,
      contacts (*)
    `)
    .eq('id', dealId)
    .single()

  // Get recent activities
  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('contact_id', deal.contact_id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Get agent memory
  const { data: memory } = await supabase
    .from('agent_memory')
    .select('*')
    .eq('contact_id', deal.contact_id)
    .order('updated_at', { ascending: false })

  // Get analytics
  const analytics = await getDealAnalytics(dealId, supabase)

  return {
    deal,
    activities: activities || [],
    memory: memory || [],
    analytics
  }
}

async function getDealAnalytics(dealId: string, supabase: any) {
  // Get deal history for velocity metrics
  const { data: history } = await supabase
    .from('deal_history')
    .select('*')
    .eq('deal_id', dealId)
    .order('changed_at', { ascending: false })
    .limit(10)

  // Get risk data
  const { data: risk } = await supabase
    .from('deal_risk_daily')
    .select('*')
    .eq('deal_id', dealId)
    .order('date', { ascending: false })
    .limit(7)

  return {
    history: history || [],
    risk: risk || [],
    velocity: calculateVelocity(history || [])
  }
}

function calculateVelocity(history: any[]): any {
  if (history.length < 2) return { avgDaysPerStage: null, totalStages: history.length }

  const stageChanges = history.filter(h => h.field === 'stage')
  if (stageChanges.length < 2) return { avgDaysPerStage: null, totalStages: stageChanges.length }

  const firstChange = new Date(stageChanges[stageChanges.length - 1].changed_at)
  const lastChange = new Date(stageChanges[0].changed_at)
  const totalDays = (lastChange.getTime() - firstChange.getTime()) / (1000 * 60 * 60 * 24)

  return {
    avgDaysPerStage: totalDays / (stageChanges.length - 1),
    totalStages: stageChanges.length,
    totalDays: totalDays
  }
}

async function generateAgentResponse(agentPrompt: string, context: any, message: string = '', conversationHistory: any[] = [], options: any = {}) {
  const { deal, activities, analytics } = context

  // Build conversation context
  let conversationContext = ''
  if (conversationHistory?.length > 0) {
    conversationContext = '\n\nRecent conversation:\n' +
      conversationHistory.slice(-3).map((msg: any) =>
        `${msg.role}: ${msg.content}`
      ).join('\n')
  }

  // Build deal context summary
  const dealContext = `
Deal: ${deal.title || 'Untitled'} ($${deal.value || 0})
Stage: ${deal.stage || 'Unknown'}
Contact: ${deal.contacts?.name || 'Unknown'} at ${deal.contacts?.company || 'Unknown'}
Age: ${Math.floor((Date.now() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24))} days

Recent Activity: ${activities.slice(0, 3).map((a: any) => `${a.type}: ${a.message}`).join(', ') || 'None'}

Analytics: ${analytics.velocity.avgDaysPerStage ?
    `Avg ${analytics.velocity.avgDaysPerStage.toFixed(1)} days per stage` :
    'Insufficient data for velocity analysis'}
  `.trim()

  // Build full prompt
  const fullPrompt = `${agentPrompt}

Deal Context:
${dealContext}
${conversationContext}

${message ? `User Message: ${message}` : 'Please provide insights and recommendations for this deal.'}

Respond as a helpful, professional AI sales assistant. Be specific, actionable, and focused on moving the deal forward.`

  // Call OpenAI
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
      model: 'gpt-5.2-thinking',
      messages: [{ role: 'user', content: fullPrompt }],
      max_tokens: 1500,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
  }

  const data = await response.json()
  return {
    message: data.choices?.[0]?.message?.content || 'Response generation failed',
    usage: data.usage,
    model: data.model
  }
}