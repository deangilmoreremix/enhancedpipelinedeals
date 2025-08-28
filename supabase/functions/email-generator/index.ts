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
    const { contact, context, taskType = 'generate-email', modelId = 'gpt-4' } = await req.json();

    console.log(`✉️ Email Generator: ${taskType} for ${contact.name}`);

    // Get API key from Supabase secrets
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!openaiKey) {
      console.error("❌ OpenAI API key not found");
      return new Response(JSON.stringify({ 
        error: "OpenAI API key not configured",
        fallbackMode: true 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const systemMessage = `You are an expert sales copywriter. Write high-converting, personalized sales emails that get responses and drive action while maintaining professionalism.`;
    
    const userMessage = `
      Generate a professional, personalized sales email:
      
      Contact: ${contact.name} (${contact.title} at ${contact.company})
      Context: ${context || 'General follow-up'}
      Industry: ${contact.industry || 'Unknown'}
      Interest Level: ${contact.interestLevel}
      Status: ${contact.status}
      Sources: ${(contact.sources || []).join(', ')}
      Previous notes: ${contact.notes || 'No previous notes'}
      
      Create a personalized, professional email that:
      - Addresses them appropriately for their role
      - References their company and industry context
      - Provides clear value proposition tailored to their role
      - Has a compelling call-to-action appropriate for their interest level
      - Is the right length and tone for the context
      
      Format as a complete email with subject line.
    `;

    // Make request to OpenAI
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage }
        ],
        max_completion_tokens: 800,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error(`❌ OpenAI API error: ${openaiResponse.status} - ${errorText}`);
      return new Response(JSON.stringify({ 
        error: `OpenAI API error: ${errorText}`,
        fallbackMode: true 
      }), {
        status: openaiResponse.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const aiData = await openaiResponse.json();
    console.log(`✅ Email generated for ${contact.name}`);
    
    return new Response(JSON.stringify(aiData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("❌ Email Generator error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallbackMode: true 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});