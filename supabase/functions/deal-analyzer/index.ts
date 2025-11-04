import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Deal Analyzer Edge Function loaded")

interface OpenAIMessage {
  role: string
  content: string
}

interface OpenAIRequest {
  messages: OpenAIMessage[]
  model: string
  max_tokens?: number
  temperature?: number
}

interface Deal {
  id: string
  title: string
  company: string
  contact: string
  value: number
  stage: string
  probability: number
  notes?: string
  tags?: string[]
  customFields?: Record<string, any>
}

serve(async (req) => {
  const { method } = req

  // Handle CORS
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    } })
  }

  try {
    if (method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { messages, taskType, modelId, deal, maxTokens = 1200 } = await req.json()

    // Get OpenAI API key from environment
    // Note: Use OPENAI_API_KEY for Supabase Edge Function secrets (not VITE_ prefix)
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not found in environment')
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY in Supabase Edge Function secrets.')
    }

    // Prepare OpenAI request
    const openaiRequest: OpenAIRequest = {
      messages,
      model: modelId || 'gpt-5',
      max_tokens: maxTokens,
      temperature: 0.7
    }

    console.log(`📊 Processing ${taskType} with ${modelId} for deal: ${deal?.title || 'Unknown'}`)

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify(openaiRequest),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json()
      console.error('OpenAI API error:', errorData)
      throw new Error(`OpenAI API error: ${errorData.error?.message || openaiResponse.statusText}`)
    }

    const openaiData = await openaiResponse.json()
    const content = openaiData.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content received from OpenAI')
    }

    console.log(`✅ Successfully processed ${taskType} for deal: ${deal?.title || 'Unknown'}`)

    return new Response(
      JSON.stringify({
        success: true,
        content,
        model: modelId,
        usage: openaiData.usage,
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )

  } catch (error) {
    console.error('Deal Analyzer error:', error)

    // Get deal from request body if available for fallback
    let dealData = null
    try {
      const body = await req.json()
      dealData = body.deal
    } catch {
      // Ignore if we can't parse the body
    }

    // Return fallback response for graceful degradation
    const fallbackResponse = getFallbackResponse(error.message, dealData)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        fallback: fallbackResponse,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})

function getFallbackResponse(errorMessage: string, deal?: Deal | null) {
  // Provide basic fallback analysis when OpenAI is unavailable
  if (!deal) {
    return {
      summary: 'Basic deal analysis available',
      nextActions: ['Schedule follow-up meeting', 'Review deal requirements'],
      insights: ['Deal information available for basic analysis']
    }
  }

  const summary = `## Deal Summary: ${deal.title}

**Company:** ${deal.company}
**Value:** $${deal.value?.toLocaleString() || 'N/A'}
**Stage:** ${deal.stage}
**Probability:** ${deal.probability}%

Basic analysis available. Enhanced AI analysis temporarily unavailable due to: ${errorMessage}.`

  const nextActions: string[] = []
  switch (deal.stage) {
    case 'qualification':
      nextActions.push('Schedule discovery call', 'Send qualification questionnaire', 'Research decision makers')
      break
    case 'proposal':
      nextActions.push('Follow up on proposal', 'Schedule presentation meeting', 'Address concerns')
      break
    case 'negotiation':
      nextActions.push('Review contract terms', 'Schedule stakeholder meeting', 'Prepare alternatives')
      break
    default:
      nextActions.push('Schedule follow-up', 'Send relevant materials', 'Connect with stakeholders')
  }

  return {
    summary,
    nextActions,
    insights: [
      `Deal is in ${deal.stage} stage`,
      `Probability of closure: ${deal.probability}%`,
      'AI analysis temporarily unavailable'
    ]
  }
}
