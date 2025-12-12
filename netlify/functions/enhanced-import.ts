import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Simple rate limiter
class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();

  isAllowed(key: string, windowMs = 15 * 60 * 1000, maxRequests = 100): boolean {
    const now = Date.now();
    const entry = this.requests.get(key);

    if (!entry || now > entry.resetTime) {
      this.requests.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (entry.count >= maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }
}

const rateLimiter = new RateLimiter();

// AI enrichment function
async function enrichDealWithAI(deal: any, options: any) {
  const enriched = { ...deal };

  try {
    // Company data enrichment
    if (options.enrichCompanyData) {
      const prompt = `Research this company and provide key insights: ${deal.company}
      Return as JSON: {industry, size, revenue, competitors: [], founded, description}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        try {
          enriched.enrichedCompanyData = JSON.parse(content);
        } catch (e) {
          console.warn('Failed to parse company enrichment:', e);
        }
      }
    }

    // Deal insights generation
    if (options.generateDealInsights) {
      const prompt = `Analyze this deal and provide insights:
      Deal: ${deal.title} at ${deal.company}, Value: $${deal.value}, Stage: ${deal.stage}

      Return as JSON: {insights: [], riskLevel: "low|medium|high", recommendedActions: []}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 400
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        try {
          const analysis = JSON.parse(content);
          enriched.aiInsights = analysis.insights;
          enriched.riskLevel = analysis.riskLevel;
          enriched.recommendedActions = analysis.recommendedActions;
        } catch (e) {
          console.warn('Failed to parse deal analysis:', e);
        }
      }
    }

  } catch (error) {
    console.warn('AI enrichment failed:', error);
  }

  return enriched;
}

// Duplicate detection
function findPotentialDuplicates(imported: any, existing: any[]): any[] {
  const matches: any[] = [];

  for (const existingDeal of existing) {
    let score = 0;

    if (imported.company?.toLowerCase() === existingDeal.company?.toLowerCase()) {
      score += 50;
    }

    if (imported.title && existingDeal.title) {
      const similarity = calculateStringSimilarity(
        imported.title.toLowerCase(),
        existingDeal.title.toLowerCase()
      );
      if (similarity > 0.8) {
        score += 30;
      }
    }

    if (score > 60) {
      matches.push(existingDeal);
    }
  }

  return matches;
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[str2.length][str1.length];
}

// Business rule validation
function validateDealBusinessRules(deal: any) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (deal.stage === 'closed-won' && deal.probability !== 100) {
    errors.push('Closed-won deals must have 100% probability');
  }

  if (deal.stage === 'closed-lost' && deal.probability !== 0) {
    errors.push('Closed-lost deals must have 0% probability');
  }

  if (deal.dueDate && new Date(deal.dueDate) < new Date()) {
    warnings.push('Deal due date is in the past');
  }

  if (deal.value <= 0) {
    errors.push('Deal value must be greater than 0');
  }

  return { isValid: errors.length === 0, errors, warnings };
}

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Rate limiting
    const clientIP = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
    if (!rateLimiter.isAllowed(clientIP)) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ error: 'Rate limit exceeded' })
      };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { action, data } = body;

      switch (action) {
        case 'import_deals_with_ai':
          // Parse CSV/JSON
          let deals: any[] = [];
          if (data.format === 'json') {
            deals = JSON.parse(data.fileContent);
          } else {
            // Simple CSV parsing
            const lines = data.fileContent.split('\n');
            const headers = lines[0].split(',');
            deals = lines.slice(1).map((line: string) => {
              const values = line.split(',');
              const deal: any = {};
              headers.forEach((header: string, index: number) => {
                deal[header.trim().toLowerCase()] = values[index]?.trim();
              });
              return deal;
            });
          }

          // AI enrichment
          const enrichedDeals = await Promise.all(
            deals.map(deal => enrichDealWithAI(deal, data.enrichmentOptions))
          );

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: {
                success: enrichedDeals,
                errors: [],
                totalProcessed: deals.length,
                successCount: enrichedDeals.length,
                errorCount: 0
              }
            })
          };

        case 'detect_duplicates':
          // Get existing deals from database
          const { data: existingDeals } = await supabase
            .from('deals')
            .select('*')
            .limit(1000);

          const duplicates = data.importedDeals.map((deal: any) => ({
            imported: deal,
            existing: findPotentialDuplicates(deal, existingDeals || []),
            resolution: data.resolutionStrategy
          }));

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: { duplicates, uniques: [], resolutionStrategy: data.resolutionStrategy }
            })
          };

        case 'validate_deal':
          const validation = validateDealBusinessRules(data.deal);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: validation })
          };

        default:
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid action' })
          };
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Enhanced import function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};