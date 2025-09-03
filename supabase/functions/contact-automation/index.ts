import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Contact automation function loaded")

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
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'test':
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Contact automation function is working!',
            timestamp: new Date().toISOString()
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        )

      case 'health':
        return new Response(
          JSON.stringify({
            status: 'healthy',
            function: 'contact-automation',
            version: '1.0.0'
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        )

      default:
        return new Response(
          JSON.stringify({
            error: 'Invalid action',
            availableActions: ['test', 'health']
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        )
    }
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
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