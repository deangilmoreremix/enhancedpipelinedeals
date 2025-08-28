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
    const { context, objection, taskType = 'general-coaching', modelId = 'gpt-4' } = await req.json();

    console.log(`🎯 Sales Coach: ${taskType}`);

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

    let systemMessage = '';
    let userMessage = '';

    switch (taskType) {
      case 'handle-objection':
        systemMessage = `You are an expert sales coach specializing in objection handling. Provide specific, actionable advice for overcoming sales objections.`;
        userMessage = `
          Help handle this objection:
          
          Objection: "${objection}"
          Context: ${JSON.stringify(context)}
          
          Provide a structured response with:
          1. Acknowledgment approach
          2. Reframing technique
          3. Value demonstration
          4. Next step recommendation
          
          Format as actionable coaching advice.
        `;
        break;
        
      case 'general-coaching':
        systemMessage = `You are a sales coach providing strategic advice for deal progression and relationship building.`;
        userMessage = `
          Provide sales coaching for this situation:
          
          Context: ${JSON.stringify(context)}
          
          Provide coaching in JSON format:
          {
            "situationalAdvice": "specific advice for this situation",
            "keyStrategies": ["strategy1", "strategy2"],
            "nextMeeting": {
              "agenda": ["item1", "item2"],
              "talking_points": ["point1", "point2"],
              "avoid": ["avoid1", "avoid2"]
            },
            "riskMitigation": ["action1", "action2"]
          }
        `;
        break;
        
      case 'conversation-analysis':
        systemMessage = `You are an AI conversation analyst. Analyze sales conversations and provide insights and recommendations.`;
        userMessage = `
          Analyze this conversation context:
          
          ${JSON.stringify(context)}
          
          Provide analysis in JSON format:
          {
            "sentiment": "positive|neutral|negative",
            "keyPoints": ["point1", "point2"],
            "buyingSignals": ["signal1", "signal2"],
            "concerns": ["concern1", "concern2"],
            "recommendedFollowUp": ["action1", "action2"],
            "coachingTips": ["tip1", "tip2"]
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
        max_completion_tokens: 1200,
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
    console.log(`✅ Sales coaching complete`);
    
    return new Response(JSON.stringify(aiData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("❌ Sales Coach error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallbackMode: true 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});