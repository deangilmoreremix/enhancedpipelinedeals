import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Email Generator Edge Function loaded")

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
  firstName?: string
  lastName?: string
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

    const { messages, taskType, modelId, contact, context, maxTokens = 800 } = await req.json()

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

    console.log(`✉️ Processing ${taskType} with ${modelId} for contact: ${contact?.name || 'Unknown'}`)

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

    console.log(`✅ Successfully generated email for contact: ${contact?.name || 'Unknown'}`)

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
    console.error('Email Generator error:', error)

    // Get contact from request body if available for fallback
    let contactData = null
    try {
      const body = await req.json()
      contactData = body.contact
    } catch {
      // Ignore if we can't parse the body
    }

    // Return fallback response for graceful degradation
    const fallbackResponse = getFallbackEmail(error.message, contactData)

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

function getFallbackEmail(errorMessage: string, contact?: Contact | null) {
  if (!contact) {
    return `Subject: Following up on our conversation

Hi there,

I wanted to follow up on our recent discussion. I'd love to learn more about your needs and explore how we can work together.

Would you be available for a brief call this week?

Best regards,
[Your Name]`
  }

  const firstName = contact.firstName || contact.name.split(' ')[0]

  return `Subject: Following up on our conversation

Hi ${firstName},

I hope this email finds you well. I wanted to follow up on our recent discussion about ${contact.company}'s needs.

Given your role as ${contact.title}, I believe our solution could provide significant value to your team.

Would you be available for a brief 15-minute call this week to explore how we can help ${contact.company} achieve its objectives?

Best regards,
[Your Name]

---
AI email generation temporarily unavailable due to: ${errorMessage}`
}