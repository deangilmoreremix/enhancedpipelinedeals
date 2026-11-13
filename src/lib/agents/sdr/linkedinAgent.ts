import { BaseSDRAgent } from './base';

/**
 * LinkedIn SDR — runs on the server with the OpenAI Agents SDK
 * (specialist definition: netlify/functions/_sdrAgents.ts, id 'sdr-linkedin').
 */
export class LinkedInSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-linkedin',
      'LinkedIn SDR',
      'LinkedIn outreach management with email follow-ups to connection requests and profile engagement.'
    );
  }
}

export const linkedinSDRAgent = new LinkedInSDRAgent();
