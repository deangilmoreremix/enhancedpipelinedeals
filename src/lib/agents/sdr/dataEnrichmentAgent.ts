import { BaseSDRAgent } from './base';

/**
 * Data-Enrichment SDR — runs on the server with the OpenAI Agents SDK
 * (specialist definition: netlify/functions/_sdrAgents.ts, id 'sdr-data-enrichment').
 */
export class DataEnrichmentSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-data-enrichment',
      'Data-Enrichment SDR',
      'Enriches contact + deal data (industry, size, pain points) and drafts an outreach email using the enriched context.'
    );
  }
}

export const dataEnrichmentSDRAgent = new DataEnrichmentSDRAgent();
