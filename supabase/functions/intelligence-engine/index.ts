/**
 * Intelligence Engine - Advanced AI analytics and predictions
 * Handles intelligence layer tasks for deal insights and predictions
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("🧠 Intelligence Engine Edge Function loaded")

interface IntelligenceRequest {
  task: string;
  dealId: string;
  workspaceId: string;
}

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

    const request: IntelligenceRequest = await req.json()
    const { task, dealId, workspaceId } = request

    console.log(`🧠 Processing intelligence task: ${task} for deal ${dealId}`)

    // Build comprehensive context
    const context = await buildIntelligenceContext(dealId, workspaceId, supabase)

    // Route to specific intelligence task
    const result = await processIntelligenceTask(task, context)

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
    console.error('❌ Intelligence Engine error:', error)

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

async function buildIntelligenceContext(dealId: string, workspaceId: string, supabase: any) {
  // Get deal data with full context
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      *,
      contacts (*)
    `)
    .eq('id', dealId)
    .single()

  // Get deal history
  const { data: history } = await supabase
    .from('deal_history')
    .select('*')
    .eq('deal_id', dealId)
    .order('changed_at', { ascending: false })
    .limit(20)

  // Get risk data
  const { data: risk } = await supabase
    .from('deal_risk_daily')
    .select('*')
    .eq('deal_id', dealId)
    .order('date', { ascending: false })
    .limit(7)

  // Get activities
  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('contact_id', deal.contact_id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Get prediction data
  const predictions = await getPredictions(dealId, supabase)

  return {
    deal,
    history: history || [],
    risk: risk || [],
    activities: activities || [],
    predictions
  }
}

async function getPredictions(dealId: string, supabase: any) {
  // Get prediction models data
  const { data: models } = await supabase
    .from('prediction_models')
    .select('*')
    .eq('status', 'active')

  return models || []
}

async function processIntelligenceTask(task: string, context: any) {
  const prompt = buildIntelligencePrompt(task, context)
  const model = getIntelligenceModel(task)

  const response = await callOpenAI(prompt, model)

  return {
    task,
    analysis: response.choices?.[0]?.message?.content || 'Analysis failed',
    confidence: calculateConfidence(task, context),
    recommendations: extractRecommendations(response.choices?.[0]?.message?.content),
    metadata: {
      model,
      tokens: response.usage?.total_tokens || 0
    }
  }
}

function buildIntelligencePrompt(task: string, context: any): string {
  const { deal, history, risk, activities, predictions } = context

  const baseContext = `
Deal: ${deal.title || 'Unknown'} ($${deal.value || 0})
Stage: ${deal.stage || 'Unknown'}
Contact: ${deal.contacts?.name || 'Unknown'} at ${deal.contacts?.company || 'Unknown'}
Age: ${Math.floor((Date.now() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24))} days
Activities: ${activities.length} total interactions
Risk Score: ${risk[0]?.risk_score || 'Unknown'}
  `

  switch (task) {
    case 'intel_next_best_actions':
      return `Analyze this deal and recommend the 3-5 most impactful next actions: ${baseContext}

History: ${history.slice(0, 5).map((h: any) => `${h.field}: ${h.old_value} → ${h.new_value}`).join(', ')}

Focus on actions that will move the deal forward most effectively.`

    case 'intel_risk_assessment':
      return `Assess risks for this deal on a scale of 0-100: ${baseContext}

Risk Factors: ${risk.map((r: any) => r.reason).join(', ') || 'None identified'}

Provide risk score, key risk factors, and mitigation strategies.`

    case 'intel_value_prediction':
      return `Predict the final deal value and expansion opportunities: ${baseContext}

Current Value: $${deal.value || 0}

Estimate final contract value and potential add-on revenue.`

    case 'intel_timeline_estimation':
      return `Estimate time to close for this deal: ${baseContext}

Stage History: ${history.filter((h: any) => h.field === 'stage').map((h: any) => `${h.new_value} (${new Date(h.changed_at).toLocaleDateString()})`).join(' → ')}

Provide realistic close date estimate with confidence level.`

    case 'intel_deal_scoring':
      return `Score this deal across multiple dimensions: ${baseContext}

Score (0-100) for: Fit, Intent, Engagement, Champion Strength, Competition, Budget, Timeline

Provide overall score and breakdown.`

    case 'intel_stakeholder_analysis':
      return `Analyze stakeholder landscape: ${baseContext}

Activities: ${activities.slice(0, 10).map((a: any) => `${a.type}: ${a.message}`).join(', ')}

Identify key stakeholders, their roles, and influence levels.`

    case 'intel_company_intelligence':
      return `Provide company intelligence: ${baseContext}

Analyze company signals, growth trajectory, and strategic priorities.`

    case 'intel_competitive_analysis':
      return `Analyze competitive landscape: ${baseContext}

Compare against similar deals and identify competitive advantages/disadvantages.`

    default:
      return `Provide intelligence analysis for ${task}: ${baseContext}`
  }
}

function getIntelligenceModel(task: string): string {
  // Use Pro model for complex predictions and analysis
  if (['intel_risk_assessment', 'intel_value_prediction', 'intel_timeline_estimation', 'intel_deal_scoring', 'intel_stakeholder_analysis', 'intel_company_intelligence', 'intel_competitive_analysis'].includes(task)) {
    return 'gpt-5.2-pro'
  }
  return 'gpt-5.2-thinking'
}

function calculateConfidence(task: string, context: any): number {
  // Calculate confidence based on data completeness
  let confidence = 0.5 // Base confidence

  if (context.deal) confidence += 0.1
  if (context.history?.length > 0) confidence += 0.1
  if (context.activities?.length > 5) confidence += 0.1
  if (context.risk?.length > 0) confidence += 0.1
  if (context.predictions?.length > 0) confidence += 0.1

  return Math.min(confidence, 0.95) // Cap at 95%
}

function extractRecommendations(content: string): string[] {
  // Simple extraction of recommendations from AI response
  const lines = content.split('\n')
  const recommendations: string[] = []

  for (const line of lines) {
    if (line.toLowerCase().includes('recommend') ||
        line.toLowerCase().includes('should') ||
        line.toLowerCase().includes('action') ||
        line.startsWith('-') ||
        line.startsWith('•')) {
      recommendations.push(line.trim())
    }
  }

  return recommendations.slice(0, 5) // Limit to 5 recommendations
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
      max_tokens: 2000,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
  }

  return await response.json()
}