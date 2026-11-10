import { BaseSDRAgent } from './base';

/**
 * Cold Email SDR — runs on the server with the OpenAI Agents SDK
 * (specialist definition: netlify/functions/_sdrAgents.ts, id 'sdr-cold-email').
 */
export class ColdEmailSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-cold-email',
      'Cold Email SDR',
      'Sends personalized cold outreach emails to prospects with compelling value propositions and clear calls-to-action.'
    );
  }
}

export const coldEmailSDRAgent = new ColdEmailSDRAgent();
