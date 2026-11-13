import { BaseSDRAgent } from './base';

/**
 * Newsletter Lead-In SDR — runs on the server with the OpenAI Agents SDK
 * (specialist definition: netlify/functions/_sdrAgents.ts, id 'sdr-newsletter-lead-in').
 */
export class NewsletterLeadInSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-newsletter-lead-in',
      'Newsletter Lead-In SDR',
      'Convert newsletter subscribers to qualified prospects through personalized lead nurturing sequences.'
    );
  }
}

export const newsletterLeadInSDRAgent = new NewsletterLeadInSDRAgent();
