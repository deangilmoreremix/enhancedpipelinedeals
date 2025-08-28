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
    const { dealData, taskType = 'generate-insights', modelId = 'gpt-4' } = await req.json();

    console.log(`💡 Deal Insights: ${taskType} for ${dealData.title}`);

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
      case 'generate-insights':
        systemMessage = `You are an expert sales analyst and deal strategist. Generate actionable insights that help sales teams close more deals and identify opportunities and risks.`;
        userMessage = `
          Generate comprehensive insights for this deal:
          
          Deal Information:
          - Title: ${dealData.title}
          - Company: ${dealData.company}
          - Contact: ${dealData.contact}
          - Value: $${dealData.value?.toLocaleString()}
          - Stage: ${dealData.stage}
          - Probability: ${dealData.probability}%
          - Priority: ${dealData.priority}
          - Due Date: ${dealData.dueDate ? new Date(dealData.dueDate).toLocaleDateString() : 'Not set'}
          - Last Activity: ${dealData.lastActivity || 'None'}
          - Notes: ${dealData.notes || 'No notes'}
          - Tags: ${(dealData.tags || []).join(', ')}
          
          Generate insights in the following JSON structure:
          {
            "insights": [
              {
                "id": "unique_id",
                "type": "action|prediction|observation|risk|opportunity|status",
                "title": "Insight title",
                "description": "Detailed description of the insight",
                "priority": "high|medium|low",
                "confidence": <number between 0-100>,
                "source": "AI Analysis"
              }
            ]
          }
          
          Create 6-8 insights covering:
          - Actionable next steps based on current stage
          - Risk factors that could derail the deal
          - Opportunities to increase deal value or probability
          - Predictions about deal progression
          - Strategic observations about the company/contact
          - Status updates on deal health
          
          Focus on insights that are:
          - Specific to this deal's current situation
          - Immediately actionable
          - Based on deal stage, value, and probability
          - Relevant to the contact and company context
        `;
        break;
        
      case 'competitive-analysis':
        systemMessage = `You are a competitive intelligence analyst. Provide detailed competitive analysis and strategic recommendations for deals.`;
        userMessage = `
          Provide competitive analysis for this deal:
          
          Deal: ${dealData.title}
          Company: ${dealData.company}
          Industry: ${dealData.industry || 'Unknown'}
          Value: $${dealData.value?.toLocaleString()}
          Stage: ${dealData.stage}
          
          Generate competitive analysis in JSON format:
          {
            "companyAnalysis": {
              "industry": "industry insights",
              "marketPosition": "market position analysis",
              "keyDecisionFactors": ["factor1", "factor2"],
              "budgetIndicators": "budget assessment"
            },
            "competitiveFactors": [
              {
                "competitor": "competitor name",
                "strength": "their advantage",
                "weakness": "their weakness",
                "ourAdvantage": "how we win"
              }
            ],
            "salesStrategy": {
              "approach": "recommended approach",
              "keyMessages": ["message1", "message2"],
              "differentiators": ["diff1", "diff2"],
              "riskMitigation": ["risk1", "risk2"]
            }
          }
        `;
        break;
        
      case 'risk-assessment':
        systemMessage = `You are a deal risk analyst. Identify potential risks and provide mitigation strategies for sales deals.`;
        userMessage = `
          Assess risks for this deal:
          
          Deal: ${dealData.title}
          Stage: ${dealData.stage}
          Probability: ${dealData.probability}%
          Value: $${dealData.value?.toLocaleString()}
          Priority: ${dealData.priority}
          Due Date: ${dealData.dueDate ? new Date(dealData.dueDate).toLocaleDateString() : 'Not set'}
          
          Provide risk assessment in JSON format:
          {
            "riskFactors": [
              {
                "risk": "risk description",
                "severity": "high|medium|low",
                "probability": <number between 0-100>,
                "impact": "impact description",
                "mitigation": "mitigation strategy"
              }
            ],
            "overallRiskScore": <number between 0-100>,
            "recommendedActions": ["action1", "action2"],
            "timelineRisks": ["timeline risk1", "timeline risk2"],
            "budgetRisks": ["budget risk1", "budget risk2"]
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
        max_completion_tokens: 1500,
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
    console.log(`✅ Deal insights generated for ${dealData.title}`);
    
    return new Response(JSON.stringify(aiData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("❌ Deal Insights error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallbackMode: true 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});