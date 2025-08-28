import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { companyName, domain, taskType = 'research-company', modelId = 'gemini-1.5-pro' } = await req.json();

    console.log(`🏢 Company Researcher with Gemma: ${taskType} for ${companyName}`);

    // Get Gemini API key from Supabase secrets (for Gemma models)
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    
    if (!geminiKey) {
      console.error("❌ Gemini API key not found");
      return new Response(JSON.stringify({ 
        error: "Gemini API key not configured",
        fallbackMode: true 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const prompt = `
      Research and provide comprehensive information about this company:
      
      Company Name: ${companyName}
      Domain: ${domain || 'Unknown'}
      
      Provide detailed information in JSON format:
      {
        "name": "${companyName}",
        "industry": "industry classification",
        "description": "comprehensive company description",
        "keyFacts": ["fact1", "fact2", "fact3"],
        "businessModel": "description of business model",
        "targetMarket": "their target customers",
        "potentialNeeds": ["need1", "need2", "need3"],
        "salesApproach": "recommended approach for selling to this company",
        "keyDecisionMakers": ["typical roles that make decisions"],
        "competitiveLandscape": ["main competitors"],
        "recentTrends": ["industry trends affecting this company"],
        "headquarters": "location",
        "employeeCount": "employee range",
        "revenue": "revenue range",
        "confidence": <number between 0-100>
      }
    `;

    // Make request to Gemini
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            topK: 64,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error(`❌ Gemini API error: ${geminiResponse.status} - ${errorText}`);
      return new Response(JSON.stringify({ 
        error: `Gemini API error: ${errorText}`,
        fallbackMode: true 
      }), {
        status: geminiResponse.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const aiData = await geminiResponse.json();
    console.log(`✅ Company research complete for ${companyName}`);
    
    return new Response(JSON.stringify(aiData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("❌ Company Researcher error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallbackMode: true 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});