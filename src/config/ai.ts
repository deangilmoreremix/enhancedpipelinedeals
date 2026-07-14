// SDR Autopilot AI Model Configuration
// GPT-5.2 models for SmartCRM SDR Autopilot system

export const SMARTCRM_SDR_MODEL = "gpt-4o";  // Main SDR/autopilot brain
export const SMARTCRM_SDR_FAST  = "gpt-4o-mini";   // Quick subject/reply helpers
export const SMARTCRM_SDR_PRO   = "gpt-4o";       // Heavy analytics (optional)

// Model selection helper for SDR tasks
export function pickModelForSdrTask(task: "autopilot" | "inline" | "analytics") {
  if (task === "autopilot") return SMARTCRM_SDR_MODEL;
  if (task === "analytics") return SMARTCRM_SDR_PRO;
  return SMARTCRM_SDR_FAST;
}