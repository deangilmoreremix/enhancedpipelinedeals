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
    const { contact, taskType = 'analyze', modelId = 'gpt-4' } = await req.json();

    console.log(`🧠 Contact Analyzer: ${taskType} for ${contact.name}`);

    // Get API key from Supabase secrets
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!openaiKey) {
      console.error("❌ OpenAI API key not found in Supabase secrets");
      return new Response(JSON.stringify({ 
        error: "OpenAI API key not configured",
        fallbackMode: true 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let systemMessage = '';
    let userMessage = '';

    switch (taskType) {
      case 'analyze':
        systemMessage = `You are an expert sales analyst. Provide detailed, actionable insights about sales contacts that help close more deals.`;
        userMessage = `
          Analyze this sales contact and provide a comprehensive assessment:
          
          Contact Information:
          - Name: ${contact.name}
          - Title: ${contact.title || 'Unknown'}
          - Company: ${contact.company || 'Unknown'}
          - Industry: ${contact.industry || 'Unknown'}
          - Status: ${contact.status}
          - Interest Level: ${contact.interestLevel}
          - Sources: ${(contact.sources || []).join(', ')}
          - Notes: ${contact.notes || 'No notes'}
          
          Provide your response in JSON format:
          {
            "score": <number between 0-100>,
            "insights": ["insight1", "insight2", "insight3"],
            "recommendations": ["recommendation1", "recommendation2"],
            "riskFactors": ["risk1", "risk2"],
            "confidenceLevel": <number between 0-100>
          }
        `;
        break;
        
      case 'detailed-score-analysis':
        systemMessage = `You are a sales data analyst with expertise in contact scoring and lead qualification. Provide detailed, narrative explanations for contact scores that help sales teams understand the 'why' behind the numbers.`;
        userMessage = `
          Generate a detailed score analysis for this contact:
          
          Contact: ${contact.name}
          Title: ${contact.title}
          Company: ${contact.company}
          Industry: ${contact.industry || 'Unknown'}
          Status: ${contact.status}
          Interest Level: ${contact.interestLevel}
          Current AI Score: ${contact.aiScore || 'Not scored'}
          Sources: ${contact.sources?.join(', ') || 'Unknown'}
          Notes: ${contact.notes || 'No notes'}
          
          Provide your analysis in JSON format:
          {
            "score": <number between 0-100>,
            "narrative": "detailed explanation of why this contact received this score",
            "keyFactors": [
              {
                "factor": "factor name",
                "impact": "positive|negative|neutral", 
                "weight": <number representing importance>,
                "explanation": "detailed explanation"
              }
            ],
            "warningFlags": ["warning1", "warning2"],
            "opportunityFlags": ["opportunity1", "opportunity2"],
            "recommendedActions": ["action1", "action2"],
            "aiProvider": "${modelId}"
          }
        `;
        break;
        
      case 'behavioral-insights':
        systemMessage = `You are a behavioral analyst specializing in customer engagement patterns. Analyze contact behavior to predict preferences and engagement strategies.`;
        userMessage = `
          Generate behavioral insights for this contact:
          
          Contact: ${contact.name}
          Title: ${contact.title}
          Company: ${contact.company}
          Status: ${contact.status}
          Interest Level: ${contact.interestLevel}
          Sources: ${contact.sources?.join(', ') || 'Unknown'}
          Last Connected: ${contact.lastConnected || 'Unknown'}
          Notes: ${contact.notes || 'No notes'}
          
          Provide behavioral insights in JSON format:
          {
            "engagementPatterns": ["pattern1", "pattern2"],
            "preferredChannels": ["channel1", "channel2"],
            "responseTimings": ["timing1", "timing2"],
            "contentPreferences": ["content1", "content2"],
            "buyingSignals": ["signal1", "signal2"],
            "disengagementRisks": ["risk1", "risk2"],
            "bestContactTimes": ["time1", "time2"],
            "engagementLevel": <number between 0-100>,
            "responsePattern": "description of response patterns",
            "generatedAt": "${new Date().toISOString()}"
          }
        `;
        break;
        
      case 'psychological-profile':
        systemMessage = `You are an expert sales psychologist. Analyze contacts to understand their personality and decision-making patterns.`;
        userMessage = `
          Generate a psychological profile for this contact:
          
          Contact: ${contact.name}
          Title: ${contact.title}
          Company: ${contact.company}
          Status: ${contact.status}
          Interest Level: ${contact.interestLevel}
          Sources: ${contact.sources?.join(', ') || 'Unknown'}
          Notes: ${contact.notes || 'No notes'}
          
          Provide a psychological profile in JSON format:
          {
            "personalityTraits": ["trait1", "trait2"],
            "communicationStyle": "formal|casual|technical|relationship-focused",
            "decisionMakingStyle": "analytical|intuitive|consensus-driven|authoritative",
            "motivations": ["motivation1", "motivation2"],
            "potentialObjections": ["objection1", "objection2"],
            "psychologicalTriggers": ["trigger1", "trigger2"],
            "influenceLevel": "high|medium|low",
            "riskTolerance": "high|medium|low",
            "urgencyLevel": "immediate|planned|exploratory",
            "confidence": <number between 0-100>
          }
        `;
        break;
        
      default:
        throw new Error(`Unsupported task type: ${taskType}`);
    }

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
        max_completion_tokens: 1000,
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
    console.log(`✅ Contact analysis complete for ${contact.name}`);
    
    return new Response(JSON.stringify(aiData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("❌ Contact Analyzer error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallbackMode: true 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});