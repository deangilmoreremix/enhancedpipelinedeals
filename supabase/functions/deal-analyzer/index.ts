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
    const { dealData, taskType = 'analyze-deal', modelId = 'gpt-4' } = await req.json();

    console.log(`💼 Deal Analyzer: ${taskType} for ${dealData.title}`);

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
      case 'analyze-deal':
      case 'deal-summary':
        systemMessage = `You are a sales manager with expertise in deal analysis and pipeline management. Create clear, actionable deal summaries that help sales teams focus on what matters most.`;
        userMessage = `
          Create a comprehensive deal summary:
          
          Deal: ${dealData.title}
          Company: ${dealData.company}
          Contact: ${dealData.contact}
          Value: $${dealData.value?.toLocaleString()}
          Stage: ${dealData.stage}
          Probability: ${dealData.probability}%
          Priority: ${dealData.priority}
          Due Date: ${dealData.dueDate ? new Date(dealData.dueDate).toLocaleDateString() : 'Not set'}
          Notes: ${dealData.notes || 'No notes'}
          
          Provide a clear, actionable summary highlighting:
          - Executive summary (2-3 sentences)
          - Key opportunities and competitive advantages
          - Potential risks and mitigation strategies
          - Critical next steps with timelines
          - Resource requirements and stakeholder engagement needs
          
          Format as a structured, easy-to-scan summary.
        `;
        break;
        
      case 'next-actions':
        systemMessage = `You are a sales coach with expertise in deal progression. Suggest specific actions that sales teams can take immediately to advance deals.`;
        userMessage = `
          Suggest strategic next actions for this deal:
          
          Deal: ${dealData.title}
          Stage: ${dealData.stage}
          Probability: ${dealData.probability}%
          Value: $${dealData.value?.toLocaleString()}
          Priority: ${dealData.priority}
          Due Date: ${dealData.dueDate ? new Date(dealData.dueDate).toLocaleDateString() : 'Not set'}
          Company: ${dealData.company}
          Contact: ${dealData.contact}
          
          Provide 6 specific, actionable next steps as a JSON array of strings.
          Focus on actions that will:
          - Move the deal forward to the next stage
          - Increase probability of closure
          - Address any potential risks
          - Maintain momentum and engagement
          
          Each action should be immediately actionable and include specific details.
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
    console.log(`✅ Deal analysis complete for ${dealData.title}`);
    
    return new Response(JSON.stringify(aiData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("❌ Deal Analyzer error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallbackMode: true 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});