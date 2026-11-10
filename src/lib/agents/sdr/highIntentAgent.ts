import { BaseSDRAgent } from './base';

/**
 * High-Intent SDR — runs on the server with the OpenAI Agents SDK
 * (specialist definition: netlify/functions/_sdrAgents.ts, id 'sdr-high-intent').
 */
export class HighIntentSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-high-intent',
      'High-Intent SDR',
      'Handle high-intent prospects with accelerated sales process and priority response sequences.'
    );
  }
}

export const highIntentSDRAgent = new HighIntentSDRAgent();
