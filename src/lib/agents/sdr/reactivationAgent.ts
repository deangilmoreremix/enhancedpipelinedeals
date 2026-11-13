import { BaseSDRAgent } from './base';

/**
 * Reactivation SDR — runs on the server with the OpenAI Agents SDK
 * (specialist definition: netlify/functions/_sdrAgents.ts, id 'sdr-reactivation').
 */
export class ReactivationSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-reactivation',
      'Reactivation SDR',
      'Re-engage dormant prospects with personalized reactivation campaigns based on time since last interaction.'
    );
  }
}

export const reactivationSDRAgent = new ReactivationSDRAgent();
