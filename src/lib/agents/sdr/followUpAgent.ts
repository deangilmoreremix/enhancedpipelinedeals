import { BaseSDRAgent } from './base';

/**
 * Follow-Up SDR — runs on the server with the OpenAI Agents SDK
 * (specialist definition: netlify/functions/_sdrAgents.ts, id 'sdr-follow-up').
 */
export class FollowUpSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-follow-up',
      'Follow-Up SDR',
      'Sends strategic follow-up emails based on previous interactions, timing, and engagement patterns.'
    );
  }
}

export const followUpSDRAgent = new FollowUpSDRAgent();
