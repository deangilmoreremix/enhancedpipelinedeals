import { BaseSDRAgent } from './base';

/**
 * Objection Handling SDR — runs on the server with the OpenAI Agents SDK
 * (specialist definition: netlify/functions/_sdrAgents.ts, id 'sdr-objection-handling').
 */
export class ObjectionHandlingSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-objection-handling',
      'Objection Handling SDR',
      'Addresses prospect objections with empathetic, value-focused responses that overcome concerns.'
    );
  }
}

export const objectionHandlingSDRAgent = new ObjectionHandlingSDRAgent();
