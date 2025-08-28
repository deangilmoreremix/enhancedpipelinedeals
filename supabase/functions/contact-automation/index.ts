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
    const { contact, automationGoal, sequenceLength, communicationStyle, taskType = 'generate-automation', modelId = 'gpt-4' } = await req.json();

    console.log(`🤖 Contact Automation: ${taskType} for ${contact.name}`);

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
        systemMessage = `You are an expert marketing automation strategist. Create intelligent, personalized automation sequences that help sales teams nurture contacts and move them through the sales funnel effectively.`;
        userMessage = `
          Generate a comprehensive contact automation sequence:
          
          Contact Information:
          - Name: ${contact.name}
          - Title: ${contact.title}
          - Company: ${contact.company}
          - Industry: ${contact.industry || 'Unknown'}
          - Status: ${contact.status}
          - Interest Level: ${contact.interestLevel}
          - Sources: ${contact.sources?.join(', ') || 'Unknown'}
          - Notes: ${contact.notes || 'No specific notes'}
          
          Automation Parameters:
          - Goal: ${automationGoal || 'Lead nurturing'}
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
              "responseReceived": "how to handle responses",
              "noResponse": "how to handle no response",
              "statusChange": "how to handle status changes"
            },
            "adaptiveElements": [
              "elements that adapt based on contact engagement",
              "ai-driven decision points"
            ]
          }
          
          Ensure the sequence:
          1. Is specifically tailored to the contact's interest level (${contact.interestLevel})
          2. Adapts to their status (${contact.status}) and industry context
          3. Includes appropriate wait times between steps
          4. Has conditional logic for different scenarios
          5. Incorporates the specified communication style
          6. Includes adaptive elements that respond to contact engagement
          7. Has clear triggers for different contact events
          
          Focus on creating a sequence that will maximize engagement and move this ${contact.interestLevel} interest ${contact.status} towards becoming a customer.
        `;
        break;
        
      case 'nurture-sequence':
        systemMessage = `You are a lead nurturing expert. Create sequences specifically designed to educate and build relationships with prospects over time.`;
        userMessage = `
          Generate a nurture-focused automation sequence for this contact:
          
          Contact: ${contact.name} (${contact.title} at ${contact.company})
          Status: ${contact.status}
          Interest Level: ${contact.interestLevel}
          Industry: ${contact.industry || 'Unknown'}
          
          Create a sequence focused on education, relationship building, and gradual conversion.
          Include valuable content, industry insights, and soft selling approaches.
        `;
        break;
        
      case 'conversion-sequence':
        systemMessage = `You are a conversion optimization expert. Create sequences designed to convert warm leads into customers through strategic touchpoints and compelling calls-to-action.`;
        userMessage = `
          Create a conversion-focused automation sequence for this contact:
          
          Contact: ${contact.name}
          Interest Level: ${contact.interestLevel}
          Status: ${contact.status}
          Company: ${contact.company}
          
          Focus on moving this contact to customer status through strategic engagement,
          compelling offers, and clear calls-to-action.
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
    console.log(`✅ Contact automation sequence generated for ${contact.name}`);
    
    return new Response(JSON.stringify(aiData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("❌ Contact Automation error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallbackMode: true 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});