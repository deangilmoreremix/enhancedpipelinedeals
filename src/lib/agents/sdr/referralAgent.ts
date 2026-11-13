import { BaseSDRAgent } from './base';

/**
 * Referral SDR — runs on the server with the OpenAI Agents SDK
 * (specialist definition: netlify/functions/_sdrAgents.ts, id 'sdr-referral').
 */
export class ReferralSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-referral',
      'Referral SDR',
      'Request referrals from satisfied contacts and customers to expand network and generate qualified leads.'
    );
  }
}

export const referralSDRAgent = new ReferralSDRAgent();
