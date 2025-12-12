// SDR Autopilot AI Model Configuration
// GPT-5.2 models for SmartCRM SDR Autopilot system

export const SMARTCRM_SDR_MODEL = "gpt-5.2-thinking";  // Main SDR/autopilot brain
export const SMARTCRM_SDR_FAST  = "gpt-5.2-instant";   // Quick subject/reply helpers
export const SMARTCRM_SDR_PRO   = "gpt-5.2-pro";       // Heavy analytics (optional)

// Model selection helper for SDR tasks
export function pickModelForSdrTask(task: "autopilot" | "inline" | "analytics") {
  if (task === "autopilot") return SMARTCRM_SDR_MODEL;
  if (task === "analytics") return SMARTCRM_SDR_PRO;
  return SMARTCRM_SDR_FAST;
}