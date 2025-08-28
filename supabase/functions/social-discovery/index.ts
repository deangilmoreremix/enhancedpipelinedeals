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
    const { entityData, entityType, taskType = 'discover-channels', modelId = 'gemma-2-9b-it' } = await req.json();

    console.log(`📱 Social Discovery with Gemma: ${taskType} for ${entityData.name || entityData.companyName}`);

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

    let prompt = '';

    switch (taskType) {
      case 'discover-channels':
        if (entityType === 'company') {
          prompt = `
            Discover social media channels for this company:
            
            Company: ${entityData.name}
            Domain: ${entityData.domain || 'Unknown'}
            Industry: ${entityData.industry || 'Unknown'}
            
            Provide discovered channels in JSON format:
            {
              "channels": [
                {
                  "platform": "LinkedIn",
                  "url": "https://linkedin.com/company/example",
                  "handle": "company-handle",
                  "confidence": 80,
                  "verified": true
                }
              ],
              "brandedHashtags": ["#company", "#brand"],
              "socialPresenceScore": 75,
              "recommendedPlatforms": ["LinkedIn", "Twitter"],
              "confidence": 80
            }
          `;
        } else {
          prompt = `
            Discover social media channels for this contact:
            
            Name: ${entityData.firstName} ${entityData.lastName}
            Company: ${entityData.company || 'Unknown'}
            Title: ${entityData.title || 'Unknown'}
            
            Provide discovered channels in JSON format:
            {
              "channels": [
                {
                  "platform": "LinkedIn",
                  "url": "https://linkedin.com/in/example",
                  "handle": "person-handle",
                  "confidence": 70,
                  "verified": false
                }
              ],
              "socialPresenceScore": 60,
              "recommendedPlatforms": ["LinkedIn"],
              "confidence": 70
            }
          `;
        }
        break;
        
      case 'enrich-app':
        prompt = `
          Enrich this app with social media and channel information:
          
          App: ${entityData.name}
          Company: ${entityData.company || 'Unknown'}
          Description: ${entityData.description || 'Unknown'}
          Category: ${entityData.category || 'Unknown'}
          
          Provide enrichment data in JSON format:
          {
            "socialChannels": {
              "official": {
                "twitter": "https://twitter.com/app",
                "linkedin": "https://linkedin.com/company/app",
                "facebook": "https://facebook.com/app"
              },
              "community": {
                "reddit": "https://reddit.com/r/app",
                "discord": "https://discord.gg/app"
              }
            },
            "brandedHashtags": ["#app", "#brand"],
            "confidence": 85
          }
        `;
        break;
        
      default:
        throw new Error(`Unsupported task type: ${taskType}`);
    }

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
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
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
    console.log(`✅ Social discovery complete`);
    
    return new Response(JSON.stringify(aiData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("❌ Social Discovery error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallbackMode: true 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});