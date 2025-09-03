import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("AI Gateway Edge Function loaded")

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

    const { messages, taskType, modelId, maxTokens = 1000 } = await req.json()

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

    console.log(`🤖 Processing ${taskType} with ${modelId} via AI Gateway`)

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

    console.log(`✅ Successfully processed ${taskType} via AI Gateway`)

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
    console.error('AI Gateway error:', error)

    // Return fallback response for graceful degradation
    const fallbackResponse = getFallbackResponse(error.message)

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

function getFallbackResponse(errorMessage: string) {
  return {
    content: `AI analysis temporarily unavailable. Error: ${errorMessage}. Please try again later or contact support.`,
    model: 'fallback',
    usage: null,
    timestamp: new Date().toISOString()
  }
}