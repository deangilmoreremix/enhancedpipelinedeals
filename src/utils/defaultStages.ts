import type { PipelineStage } from '../types';

/** Built-in stages (mirror the seed in 20260801000000_pipeline_foundation.sql). */
export const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'qualification', key: 'qualification', name: 'Qualification', color: 'blue', position: 0, visible: true, probability: 10, isWon: false, isLost: false, wipLimit: 10 },
  { id: 'proposal', key: 'proposal', name: 'Proposal', color: 'indigo', position: 1, visible: true, probability: 40, isWon: false, isLost: false, wipLimit: 8 },
  { id: 'negotiation', key: 'negotiation', name: 'Negotiation', color: 'purple', position: 2, visible: true, probability: 70, isWon: false, isLost: false, wipLimit: 6 },
  { id: 'closed-won', key: 'closed-won', name: 'Closed Won', color: 'green', position: 3, visible: true, probability: 100, isWon: true, isLost: false, wipLimit: null },
  { id: 'closed-lost', key: 'closed-lost', name: 'Closed Lost', color: 'red', position: 4, visible: true, probability: 0, isWon: false, isLost: true, wipLimit: null },
];
