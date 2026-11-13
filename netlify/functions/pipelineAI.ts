import { Handler } from '@netlify/functions';
import { respond, authorize, rateLimited, CORS_HEADERS } from './_openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

export const handler: Handler = async (event) => {
  // Reads the whole pipeline with the service role and runs the deep model: must not be anonymous.
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  if (!(await authorize(event.headers.authorization || event.headers.Authorization))) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  if (rateLimited(String(event.headers['x-nf-client-connection-ip'] || 'anon') + ':pipelineAI', 6)) {
    return { statusCode: 429, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }, body: JSON.stringify({ error: 'Rate limit exceeded' }) };
  }
  try {
    // Fetch open deals with related data (columns must exist: contacts has ai_score but no lead_score;
    // activities has title/description but no message)
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select(`
        *,
        contacts (
          name,
          email,
          company,
          ai_score
        ),
        activities (
          type,
          title,
          description,
          created_at
        )
      `)
      .is('deleted_at', null)
      .limit(200);

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
1. Risk Score (0-100): Based on stage, age, activity, contact AI score
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

    const result = await respond({
      tier: 'deep',
      instructions: 'You are an expert sales strategist analyzing pipeline data. Respond with a single JSON object only.',
      input: analysisPrompt,
      jsonObject: true,
      maxOutputTokens: 8000
    });

    const analysis = result.json ?? {};

    // Store analysis results in database for caching
    await supabase
      .from('pipeline_analysis')
      .insert({
        analysis_data: analysis,
        created_at: new Date().toISOString()
      });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
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