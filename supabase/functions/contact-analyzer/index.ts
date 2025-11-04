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
  lastConnected?: string
  customFields?: Record<string, any>
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const { method } = req

  // Handle CORS
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    console.log(`🧠 Processing ${taskType} with ${modelId} for contact: ${contact?.name || 'Unknown'}`)

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

    console.log(`✅ Successfully processed ${taskType}`)

    // Return in Edge Function format
    return new Response(
      JSON.stringify({
        success: true,
        content,
        taskType,
        modelUsed: modelId || 'gpt-5'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Contact Analyzer error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
