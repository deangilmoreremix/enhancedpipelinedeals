// SDR Autopilot AI configuration. Values are gateway tiers; the concrete OpenAI
// model ids (gpt-6-astra / gpt-6.1-sol / gpt-6-luna) are owned by the server
// (netlify/functions/_openai.ts, overridable with OPENAI_MODEL_* env vars).

export const SMARTCRM_SDR_MODEL = "default"; // Main SDR/autopilot brain
export const SMARTCRM_SDR_FAST = "fast";     // Quick subject/reply helpers
export const SMARTCRM_SDR_PRO = "deep";      // Heavy analytics

// Model selection helper for SDR tasks
export function pickModelForSdrTask(task: "autopilot" | "inline" | "analytics") {
  if (task === "autopilot") return SMARTCRM_SDR_MODEL;
  if (task === "analytics") return SMARTCRM_SDR_PRO;
  return SMARTCRM_SDR_FAST;
}
