import { BaseSDRAgent } from './base';

/**
 * Winback SDR — runs on the server with the OpenAI Agents SDK
 * (specialist definition: netlify/functions/_sdrAgents.ts, id 'sdr-winback').
 */
export class WinbackSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-winback',
      'Winback SDR',
      'Attempt to win back lost deals with compelling value propositions and updated offerings.'
    );
  }
}

export const winbackSDRAgent = new WinbackSDRAgent();
