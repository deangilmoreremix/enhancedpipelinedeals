/**
 * SDR Sequence Engine - Handles all SDR agent tasks
 * Manages multi-step sequences for sales development representatives
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("🎯 SDR Sequence Engine Edge Function loaded")

interface SDRRequest {
  task: string;
  dealId: string;
  workspaceId: string;
  options?: Record<string, any>;
}

const SDR_SEQUENCES = {
  'sdr_enrich_contact': {
    name: 'Contact Enrichment',
    steps: [
      { day: 0, channel: 'database', action: 'Enrich contact data from web sources' },
      { day: 1, channel: 'email', action: 'Send enrichment confirmation' }
    ]
  },
  'sdr_competitor': {
    name: 'Competitor SDR',
    steps: [
      { day: 0, channel: 'research', action: 'Analyze competitor positioning' },
      { day: 2, channel: 'email', action: 'Send differentiation email' },
      { day: 5, channel: 'linkedin', action: 'Connect on LinkedIn with competitor insights' }
    ]
  },
  'sdr_objection_handler': {
    name: 'Objection Handler',
    steps: [
      { day: 0, channel: 'analysis', action: 'Analyze objection patterns' },
      { day: 1, channel: 'email', action: 'Send objection response' },
      { day: 3, channel: 'call', action: 'Follow up call to address concerns' }
    ]
  },
  'sdr_follow_up': {
    name: 'Follow-Up SDR',
    steps: [
      { day: 0, channel: 'analysis', action: 'Analyze engagement patterns' },
      { day: 1, channel: 'email', action: 'Send personalized follow-up' },
      { day: 4, channel: 'email', action: 'Send value-add content' },
      { day: 7, channel: 'call', action: 'Attempt connection call' }
    ]
  },
  'sdr_high_intent': {
    name: 'High-Intent SDR',
    steps: [
      { day: 0, channel: 'analysis', action: 'Identify high-intent signals' },
      { day: 0, channel: 'email', action: 'Send urgent response' },
      { day: 1, channel: 'call', action: 'Schedule immediate demo' }
    ]
  },
  'sdr_bump_message': {
    name: 'Bump Message',
    steps: [
      { day: 0, channel: 'email', action: 'Send polite re-engagement message' }
    ]
  },
  'sdr_reactivation': {
    name: 'Reactivation SDR',
    steps: [
      { day: 0, channel: 'analysis', action: 'Analyze dormant contact' },
      { day: 1, channel: 'email', action: 'Send reactivation sequence' },
      { day: 5, channel: 'email', action: 'Send value update' },
      { day: 10, channel: 'call', action: 'Attempt reconnection' }
    ]
  },
  'sdr_winback': {
    name: 'Winback SDR',
    steps: [
      { day: 0, channel: 'analysis', action: 'Analyze lost deal reasons' },
      { day: 2, channel: 'email', action: 'Send winback proposal' },
      { day: 7, channel: 'call', action: 'Discuss new opportunities' }
    ]
  },
  'sdr_linkedin': {
    name: 'LinkedIn SDR',
    steps: [
      { day: 0, channel: 'linkedin', action: 'Send connection request' },
      { day: 3, channel: 'linkedin', action: 'Send follow-up message' },
      { day: 7, channel: 'email', action: 'Send email follow-up' }
    ]
  },
  'sdr_whatsapp': {
    name: 'WhatsApp SDR',
    steps: [
      { day: 0, channel: 'whatsapp', action: 'Send business message' },
      { day: 1, channel: 'whatsapp', action: 'Follow up if no response' }
    ]
  },
  'sdr_event_based': {
    name: 'Event SDR',
    steps: [
      { day: 0, channel: 'analysis', action: 'Monitor company events' },
      { day: 0, channel: 'email', action: 'Send timely event-based message' },
      { day: 2, channel: 'call', action: 'Follow up on event discussion' }
    ]
  },
  'sdr_referral': {
    name: 'Referral SDR',
    steps: [
      { day: 0, channel: 'analysis', action: 'Identify referral opportunities' },
      { day: 1, channel: 'email', action: 'Request referrals politely' },
      { day: 5, channel: 'email', action: 'Follow up on referral request' }
    ]
  },
  'sdr_newsletter_lead_in': {
    name: 'Newsletter SDR',
    steps: [
      { day: 0, channel: 'analysis', action: 'Analyze subscriber engagement' },
      { day: 1, channel: 'email', action: 'Send personalized lead nurturing' },
      { day: 5, channel: 'email', action: 'Send case study or success story' }
    ]
  },
  'sdr_cold_email': {
    name: 'Cold Email SDR',
    steps: [
      { day: 0, channel: 'research', action: 'Research prospect thoroughly' },
      { day: 0, channel: 'email', action: 'Send personalized cold email' },
      { day: 3, channel: 'email', action: 'Send follow-up value add' },
      { day: 7, channel: 'linkedin', action: 'Connect on LinkedIn' },
      { day: 10, channel: 'call', action: 'Attempt connection call' }
    ]
  }
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

    const request: SDRRequest = await req.json()
    const { task, dealId, workspaceId, options } = request

    console.log(`🎯 Processing SDR task: ${task} for deal ${dealId}`)

    // Get deal and contact context
    const context = await buildSDRContext(dealId, workspaceId, supabase)

    // Get SDR sequence
    const sequence = SDR_SEQUENCES[task as keyof typeof SDR_SEQUENCES]
    if (!sequence) {
      throw new Error(`Unknown SDR task: ${task}`)
    }

    // Generate SDR content using AI
    const sdrContent = await generateSDRContent(task, sequence, context, options)

    // Log SDR execution
    await logSDRExecution(task, dealId, workspaceId, sdrContent, supabase)

    return new Response(
      JSON.stringify({
        success: true,
        sequence: sdrContent,
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
    console.error('❌ SDR Sequence Engine error:', error)

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

async function buildSDRContext(dealId: string, workspaceId: string, supabase: any) {
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
    .limit(10)

  return { deal, contact, activities: activities || [] }
}

async function generateSDRContent(task: string, sequence: any, context: any, options?: any) {
  const prompt = buildSDRContentPrompt(task, sequence, context, options)
  const response = await callOpenAI(prompt, 'gpt-5.2-thinking')

  return {
    sequenceName: sequence.name,
    steps: sequence.steps,
    generatedContent: response.choices?.[0]?.message?.content || 'Content generation failed',
    context: {
      deal: context.deal?.title,
      contact: context.contact?.name,
      company: context.contact?.company
    }
  }
}

function buildSDRContentPrompt(task: string, sequence: any, context: any, options?: any): string {
  const { deal, contact, activities } = context

  return `Generate SDR content for: ${sequence.name}

Deal Context:
- Deal: ${deal?.title || 'Unknown'} ($${deal?.value || 0})
- Stage: ${deal?.stage || 'Unknown'}
- Contact: ${contact?.name || 'Unknown'} at ${contact?.company || 'Unknown'}
- Recent Activity: ${activities?.slice(0, 3).map((a: any) => a.message).join(', ') || 'None'}

SDR Task: ${task}
Sequence Steps: ${sequence.steps.map((s: any) => `Day ${s.day}: ${s.action}`).join(', ')}

${options?.customInstructions || ''}

Generate personalized, professional SDR content that would be effective for this specific deal and contact. Focus on value, timing, and relationship building.`
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
      max_tokens: 1500,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
  }

  return await response.json()
}

async function logSDRExecution(task: string, dealId: string, workspaceId: string, content: any, supabase: any) {
  try {
    await supabase.from('ai_usage_metrics').insert({
      user_id: workspaceId,
      service_name: 'sdr-sequence-engine',
      operation: task,
      model_used: 'gpt-5.2-thinking',
      tokens_used: content?.usage?.total_tokens || 0,
      cost_usd: (content?.usage?.total_tokens || 0) * 0.0003,
      duration_ms: 0, // Would track this in production
      success: true,
      metadata: {
        dealId,
        sequenceName: content?.sequenceName,
        stepCount: content?.steps?.length
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to log SDR execution:', error)
  }
}