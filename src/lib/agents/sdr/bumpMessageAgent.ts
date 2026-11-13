import { BaseSDRAgent } from './base';

/**
 * Bump Message SDR — runs on the server with the OpenAI Agents SDK
 * (specialist definition: netlify/functions/_sdrAgents.ts, id 'sdr-bump-message').
 */
export class BumpMessageSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-bump-message',
      'Bump Message SDR',
      'Polite re-engagement messages for unresponsive prospects with value-driven follow-ups.'
    );
  }
}

export const bumpMessageSDRAgent = new BumpMessageSDRAgent();
