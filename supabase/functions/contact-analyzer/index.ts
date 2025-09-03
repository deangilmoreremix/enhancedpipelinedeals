import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Contact Analyzer Edge Function loaded")

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

interface Contact {
  id: string
  name: string
  email: string
  title: string
  company: string
  industry?: string
  status: string
  interestLevel: string
  sources: string[]
  notes?: string
  aiScore?: number
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

    const { messages, taskType, modelId, contact, maxTokens = 1500 } = await req.json()

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('VITE_OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Prepare OpenAI request
    const openaiRequest: OpenAIRequest = {
      messages,
      model: modelId || 'gpt-5',
      max_tokens: maxTokens,
      temperature: 0.7
    }

    console.log(`🤖 Processing ${taskType} with ${modelId} for contact: ${contact?.name || 'Unknown'}`)

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

    console.log(`✅ Successfully processed ${taskType} for contact: ${contact?.name || 'Unknown'}`)

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
    console.error('Contact Analyzer error:', error)

    // Get contact from request body if available for fallback
    let contactData = null
    try {
      const body = await req.json()
      contactData = body.contact
    } catch {
      // Ignore if we can't parse the body
    }

    // Return fallback response for graceful degradation
    const fallbackResponse = getFallbackResponse(error.message, contactData)

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

function getFallbackResponse(errorMessage: string, contact?: Contact | null) {
  // Provide basic fallback analysis when OpenAI is unavailable
  if (!contact) {
    return {
      score: 50,
      insights: ['Basic analysis available'],
      recommendations: ['Schedule follow-up meeting'],
      riskFactors: ['AI analysis temporarily unavailable'],
      reasoningPath: `Fallback due to: ${errorMessage}`,
      confidenceLevel: 30
    }
  }

  let score = 50
  if (contact.interestLevel === 'hot') score += 20
  if (contact.status === 'customer') score += 15
  if (contact.sources?.includes('Referral')) score += 10

  return {
    score: Math.min(100, score),
    insights: [
      'Contact information available for basic analysis',
      `Interest level: ${contact.interestLevel}`,
      `Status: ${contact.status}`
    ],
    recommendations: [
      'Schedule follow-up meeting',
      'Research company background',
      'Send personalized introduction'
    ],
    riskFactors: [
      'AI analysis temporarily unavailable',
      'Limited data for comprehensive scoring'
    ],
    reasoningPath: `Basic heuristic analysis due to: ${errorMessage}`,
    confidenceLevel: 40
  }
}