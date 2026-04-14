// SDR Autopilot Module Exports
// Main exports for SmartCRM SDR Autopilot system

// Configuration
export { SMARTCRM_SDR_MODEL, SMARTCRM_SDR_FAST, SMARTCRM_SDR_PRO, pickModelForSdrTask } from '../../config/ai';

// Tools
export { sdrTools } from './sdrTools';

// State Management
export { getOrCreateThreadForLead, saveAutopilotState, getAutopilotState } from './sdrStateHelpers';

// Tool Implementations
export {
  getLeadContextFromSmartCRM
  createTaskInSmartCRM
  updateDealStageInSmartCRM
  scheduleMeetingForLead
  saveAutopilotStateWrapper
} from './sdrToolImplementations';

// Agent Definition
export { SDR_SYSTEM_PROMPT, buildSdrMessages, getSdrModel } from './sdrAgentDefinition';

// Main Runner
export { runSdrAutopilot } from './runSdrAutopilot';

// Inbound Handler
export { handleInboundEmail, findLeadByEmailContext } from './handleInboundEmail';