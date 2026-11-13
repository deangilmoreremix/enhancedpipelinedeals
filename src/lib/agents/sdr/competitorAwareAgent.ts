import { BaseSDRAgent } from './base';

/**
 * Competitor Aware SDR — runs on the server with the OpenAI Agents SDK
 * (specialist definition: netlify/functions/_sdrAgents.ts, id 'sdr-competitor-aware').
 */
export class CompetitorAwareSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-competitor-aware',
      'Competitor Aware SDR',
      'Analyzes competitive landscape and crafts positioning-focused outreach emails.'
    );
  }
}

export const competitorAwareSDRAgent = new CompetitorAwareSDRAgent();
