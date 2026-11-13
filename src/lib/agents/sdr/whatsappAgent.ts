import { BaseSDRAgent } from './base';

/**
 * WhatsApp SDR — runs on the server with the OpenAI Agents SDK
 * (specialist definition: netlify/functions/_sdrAgents.ts, id 'sdr-whatsapp').
 */
export class WhatsAppSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-whatsapp',
      'WhatsApp SDR',
      'WhatsApp business messaging for high-touch prospects with coordinated email follow-ups.'
    );
  }
}

export const whatsappSDRAgent = new WhatsAppSDRAgent();
