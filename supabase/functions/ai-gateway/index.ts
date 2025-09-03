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
  reasoning_effort?: 'low' | 'medium' | 'high'
  tools?: any[]
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

    const {
      messages,
      taskType,
      modelId,
      maxTokens = 1000,
      reasoningEffort = 'medium',
      tools = []
    } = await req.json()

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('VITE_OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Prepare OpenAI request with GPT-5 enhancements
    const openaiRequest: OpenAIRequest = {
      messages,
      model: modelId || 'gpt-5',
      max_tokens: maxTokens,
      temperature: 0.7,
      reasoning_effort: reasoningEffort,
      ...(tools.length > 0 && { tools })
    }

    console.log(`🤖 Processing ${taskType} with ${modelId} via AI Gateway`)

    // Implement intelligent model fallback cascade
    const modelCascade = getModelCascade(modelId)
    let lastError: string | null = null

    for (const model of modelCascade) {
      try {
        console.log(`🔄 Trying model: ${model}`)

        const currentRequest = { ...openaiRequest, model }

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify(currentRequest),
        })

        if (!openaiResponse.ok) {
          const errorData = await openaiResponse.json()
          console.warn(`⚠️ Model ${model} failed:`, errorData.error?.message || openaiResponse.statusText)
          lastError = errorData.error?.message || openaiResponse.statusText

          // Continue to next model in cascade
          continue
        }

        const openaiData = await openaiResponse.json()
        const content = openaiData.choices?.[0]?.message?.content

        if (!content) {
          console.warn(`⚠️ Model ${model} returned no content`)
          lastError = 'No content received'
          continue
        }

        console.log(`✅ Successfully processed ${taskType} with ${model} via AI Gateway`)

        return new Response(
          JSON.stringify({
            success: true,
            content,
            model: model,
            fallbackUsed: model !== modelId,
            originalModel: modelId,
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
        console.warn(`⚠️ Model ${model} error:`, error.message)
        lastError = error.message
        continue
      }
    }

    // All models in cascade failed
    console.error('❌ All models in cascade failed')
    throw new Error(`All AI models failed. Last error: ${lastError}`)

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

function getModelCascade(primaryModel: string): string[] {
  // Intelligent model fallback cascade for GPT-5
  const cascades: Record<string, string[]> = {
    'gpt-5': ['gpt-5', 'gpt-5-mini', 'gpt-4o-mini'],
    'gpt-5-mini': ['gpt-5-mini', 'gpt-5', 'gpt-4o-mini'],
    'gpt-5-nano': ['gpt-5-nano', 'gpt-5-mini', 'gpt-4o-mini'],
    'gpt-4o-mini': ['gpt-4o-mini', 'gpt-5-mini', 'gpt-5']
  };

  return cascades[primaryModel] || [primaryModel, 'gpt-5', 'gpt-5-mini', 'gpt-4o-mini'];
}

function getFallbackResponse(errorMessage: string) {
  return {
    content: `AI analysis temporarily unavailable. Error: ${errorMessage}. Please try again later or contact support.`,
    model: 'fallback',
    usage: null,
    timestamp: new Date().toISOString()
  }
}