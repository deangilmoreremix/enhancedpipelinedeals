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
    const { dealData, automationGoal, sequenceLength, communicationStyle, taskType = 'generate-automation', modelId = 'gpt-4' } = await req.json();

    console.log(`🤖 Automation Builder: ${taskType} for deal ${dealData.title}`);

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
      case 'generate-automation':
        systemMessage = `You are an expert sales automation strategist. Create intelligent, adaptive automation sequences that help sales teams move deals through the pipeline more effectively. Focus on timing, personalization, and adaptive responses.`;
        userMessage = `
          Generate a comprehensive automation sequence for this deal:
          
          Deal Information:
          - Title: ${dealData.title}
          - Company: ${dealData.company}
          - Contact: ${dealData.contact}
          - Value: $${dealData.value?.toLocaleString()}
          - Stage: ${dealData.stage}
          - Probability: ${dealData.probability}%
          - Priority: ${dealData.priority}
          - Due Date: ${dealData.dueDate ? new Date(dealData.dueDate).toLocaleDateString() : 'Not set'}
          - Notes: ${dealData.notes || 'No specific notes'}
          
          Automation Parameters:
          - Goal: ${automationGoal || 'Move to next stage'}
          - Sequence Length: ${sequenceLength || 'Medium (5-7 steps)'}
          - Communication Style: ${communicationStyle || 'Consultative'}
          
          Create a JSON automation sequence with the following structure:
          {
            "name": "automation sequence name",
            "description": "detailed description of the automation",
            "type": "drip",
            "steps": [
              {
                "id": "unique_step_id",
                "type": "email|call|task|delay|ai",
                "name": "step name",
                "details": "detailed description of what this step does",
                "waitDays": <number of days to wait before this step>,
                "conditions": {
                  "executeIf": "conditions for executing this step",
                  "skipIf": "conditions for skipping this step"
                },
                "templates": {
                  "emailSubject": "subject line if email",
                  "emailBody": "email content if email",
                  "taskDescription": "task details if task"
                }
              }
            ],
            "triggers": {
              "stageChange": "how to handle stage changes",
              "responseReceived": "how to handle responses",
              "noResponse": "how to handle no response"
            },
            "adaptiveElements": [
              "elements that adapt based on deal progression",
              "ai-driven decision points"
            ]
          }
          
          Ensure the sequence:
          1. Is specifically tailored to the current deal stage (${dealData.stage})
          2. Adapts to the deal value and priority level
          3. Includes appropriate wait times between steps
          4. Has conditional logic for different scenarios
          5. Incorporates the specified communication style
          6. Includes adaptive elements that respond to deal progression
          7. Has clear triggers for different deal events
          
          Focus on creating a sequence that will maximize the probability of moving this ${dealData.probability}% probability deal to the next stage.
        `;
        break;
        
      case 'generate-stage-specific':
        systemMessage = `You are a sales automation expert specializing in stage-specific sequences. Create targeted automation flows that are optimized for specific pipeline stages.`;
        userMessage = `
          Generate a stage-specific automation sequence for a ${dealData.stage} stage deal:
          
          Deal: ${dealData.title} (${dealData.company})
          Current Stage: ${dealData.stage}
          Value: $${dealData.value?.toLocaleString()}
          Probability: ${dealData.probability}%
          
          Create a JSON automation focused on moving from ${dealData.stage} to the next logical stage.
          Include specific actions, timing, and adaptive elements for this stage.
          
          Consider typical challenges and opportunities at the ${dealData.stage} stage.
        `;
        break;
        
      case 'risk-mitigation-sequence':
        systemMessage = `You are a risk management expert. Create automation sequences specifically designed to identify and mitigate deal risks before they become deal-breakers.`;
        userMessage = `
          Create a risk mitigation automation sequence for this deal:
          
          Deal: ${dealData.title}
          Stage: ${dealData.stage}
          Probability: ${dealData.probability}%
          Value: $${dealData.value?.toLocaleString()}
          
          Focus on identifying and addressing potential risks that could cause this deal to stall or be lost.
          Include proactive steps to maintain momentum and address common objections.
        `;
        break;
        
      default:
        throw new Error(`Unsupported task type: ${taskType}`);
    }

    // Make request to OpenAI (without temperature parameter)
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
        max_completion_tokens: 2000,
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
    console.log(`✅ Automation sequence generated for ${dealData.title}`);
    
    return new Response(JSON.stringify(aiData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("❌ Automation Builder error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallbackMode: true 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});