import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Parse the request body from the frontend
    const { provider, model, taskType, aiRequestData } = await req.json();

    console.log(`🤖 AI Gateway: ${provider} ${model} for ${taskType}`);

    let apiKey;
    let apiUrl;

    // Determine the AI provider and retrieve the corresponding API key from Supabase secrets
    if (provider === "openai") {
      apiKey = Deno.env.get("OPENAI_API_KEY")?.trim() || Deno.env.get("VITE_OPENAI_API_KEY")?.trim();
      apiUrl = "https://api.openai.com/v1/chat/completions";
    } else if (provider === "gemini" || provider === "gemma") {
      apiKey = Deno.env.get("GEMINI_API_KEY")?.trim() || Deno.env.get("VITE_GEMINI_API_KEY")?.trim();
      // Gemma models use the Gemini API URL with the model and API key in the URL
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    } else {
      return new Response(JSON.stringify({ error: "Unsupported AI provider" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if the API key was successfully retrieved
    if (!apiKey) {
      console.error(`❌ ${provider} API key not found in Supabase secrets. Available env vars:`, Object.keys(Deno.env.toObject()));
      return new Response(JSON.stringify({ 
        error: `${provider} API key not configured in Supabase secrets. Please add it in your Supabase project settings.`,
        fallbackMode: true
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Log API key format for debugging (only first and last 4 characters)
    console.log(`🔑 Using ${provider} API key: ${apiKey.slice(0, 4)}...${apiKey.slice(-4)} (length: ${apiKey.length})`);

    console.log(`🔄 Forwarding request to ${provider} API...`);

    // Forward the request to the actual AI API
    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // OpenAI uses an Authorization header, Gemini uses the key in the URL
        ...(provider === "openai" && { "Authorization": `Bearer ${apiKey}` }),
      },
      body: JSON.stringify(aiRequestData), // Use the pre-formatted request data from the frontend
    });

    // Handle non-OK responses from the AI API
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`❌ AI API error (${provider}): ${aiResponse.status} - ${errorText}`);
      return new Response(JSON.stringify({ 
        error: `AI API error: ${errorText}`,
        provider: provider,
        status: aiResponse.status
      }), {
        status: aiResponse.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Return the AI's response to the frontend
    const aiData = await aiResponse.json();
    console.log(`✅ AI Gateway: Successfully processed ${provider} request`);
    
    return new Response(JSON.stringify(aiData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("❌ Edge Function error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallbackMode: true 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});