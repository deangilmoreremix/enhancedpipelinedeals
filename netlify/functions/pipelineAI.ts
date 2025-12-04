import { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const handler: Handler = async (event) => {
  try {
    // Fetch all deals with related data
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select(`
        *,
        contacts (
          name,
          email,
          company,
          lead_score,
          ai_score
        ),
        activities (
          type,
          message,
          created_at
        )
      `);

    if (dealsError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: dealsError.message })
      };
    }

    // Analyze pipeline with AI
    const analysisPrompt = `You are the Pipeline AI Assistant for SmartCRM.

Analyze this entire sales pipeline and provide strategic insights:

PIPELINE DATA:
${JSON.stringify(deals, null, 2)}

For each deal, provide:
1. Risk Score (0-100): Based on stage, age, activity, lead score
2. Close Probability: Percentage likelihood with confidence level
3. Recommended Next Action: Specific, actionable step
4. Recommended SDR Agent: Which of our 14 agents would be best
5. Recommended Persona: Which communication style to use
6. Urgency Level: low/medium/high/critical
7. Key Insights: 2-3 bullet points about this deal

Also provide:
- Overall pipeline health score
- Top 3 at-risk deals
- Best performing deals
- Recommended agent reallocations
- Bottleneck identification

Format as JSON with this structure:
{
  "overall_health": number,
  "deals_analysis": [
    {
      "deal_id": string,
      "risk_score": number,
      "close_probability": number,
      "recommended_action": string,
      "recommended_agent": string,
      "recommended_persona": string,
      "urgency_level": string,
      "insights": string[]
    }
  ],
  "pipeline_insights": {
    "at_risk_deals": string[],
    "best_performing": string[],
    "agent_recommendations": object,
    "bottlenecks": string[]
  }
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an expert sales strategist analyzing pipeline data.' },
        { role: 'user', content: analysisPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const analysis = JSON.parse(completion.choices[0].message.content || '{}');

    // Store analysis results in database for caching
    await supabase
      .from('pipeline_analysis')
      .insert({
        analysis_data: analysis,
        created_at: new Date().toISOString()
      });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(analysis)
    };

  } catch (error) {
    console.error('Pipeline AI error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to analyze pipeline' })
    };
  }
};