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
    const { entityData, entityType, taskType = 'enrich', modelId = 'gpt-4' } = await req.json();

    console.log(`✨ AI Enrichment: ${taskType} for ${entityType}`);

    // Get API keys from Supabase secrets
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    
    // Try OpenAI first, then Gemini
    let apiKey = openaiKey;
    let provider = 'openai';
    let apiUrl = "https://api.openai.com/v1/chat/completions";
    
    if (!openaiKey && geminiKey) {
      apiKey = geminiKey;
      provider = 'gemini';
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`;
    }
    
    if (!apiKey) {
      console.error("❌ No AI API keys found");
      return new Response(JSON.stringify({ 
        error: "No AI API keys configured",
        fallbackMode: true 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let prompt = '';
    
    switch (entityType) {
      case 'contact':
        prompt = `
          Enrich this contact with additional information:
          
          Name: ${entityData.name || entityData.firstName + ' ' + entityData.lastName}
          Email: ${entityData.email || 'Unknown'}
          Company: ${entityData.company || 'Unknown'}
          Title: ${entityData.title || 'Unknown'}
          
          Provide enrichment data in JSON format:
          {
            "title": "enriched job title",
            "phone": "phone number if discoverable",
            "industry": "industry classification",
            "location": "location information",
            "socialProfiles": {
              "linkedin": "linkedin url",
              "twitter": "twitter url"
            },
            "notes": "additional background information",
            "confidence": <number between 0-100>,
            "aiProvider": "${provider}"
          }
        `;
        break;
        
      case 'company':
        prompt = `
          Enrich this company with additional information:
          
          Company: ${entityData.name}
          Domain: ${entityData.domain || 'Unknown'}
          
          Provide enrichment data in JSON format:
          {
            "industry": "industry classification",
            "description": "company description",
            "size": "employee count range",
            "headquarters": "location",
            "revenue": "revenue range",
            "keyPeople": [{"name": "person", "title": "title"}],
            "competitors": ["competitor1", "competitor2"],
            "confidence": <number between 0-100>,
            "aiProvider": "${provider}"
          }
        `;
        break;
        
      case 'deal':
        prompt = `
          Analyze and enrich this deal:
          
          Deal: ${entityData.title}
          Company: ${entityData.company}
          Value: $${entityData.value?.toLocaleString()}
          Stage: ${entityData.stage}
          Probability: ${entityData.probability}%
          
          Provide enrichment in JSON format:
          {
            "insights": ["insight1", "insight2"],
            "risks": ["risk1", "risk2"],
            "recommendations": ["rec1", "rec2"],
            "suggestedNextSteps": ["step1", "step2"],
            "confidence": <number between 0-100>,
            "aiProvider": "${provider}"
          }
        `;
        break;
        
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }

    let aiResponse;
    
    if (provider === 'openai') {
      aiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: "You are an AI research assistant specialized in data enrichment." },
            { role: "user", content: prompt }
          ],
          max_completion_tokens: 1000,
        }),
      });
    } else {
      aiResponse = await fetch(apiUrl, {
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
            maxOutputTokens: 1000,
          },
        }),
      });
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`❌ ${provider} API error: ${aiResponse.status} - ${errorText}`);
      return new Response(JSON.stringify({ 
        error: `${provider} API error: ${errorText}`,
        fallbackMode: true 
      }), {
        status: aiResponse.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const aiData = await aiResponse.json();
    console.log(`✅ AI enrichment complete for ${entityType}`);
    
    return new Response(JSON.stringify(aiData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("❌ AI Enrichment error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallbackMode: true 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});