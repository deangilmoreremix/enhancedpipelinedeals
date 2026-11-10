import { BaseSDRAgent } from './base';

/**
 * Event-Based SDR — runs on the server with the OpenAI Agents SDK
 * (specialist definition: netlify/functions/_sdrAgents.ts, id 'sdr-event-based').
 */
export class EventBasedSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-event-based',
      'Event-Based SDR',
      'Trigger timely outreach based on company events like funding announcements, hires, or product launches.'
    );
  }
}

export const eventBasedSDRAgent = new EventBasedSDRAgent();
