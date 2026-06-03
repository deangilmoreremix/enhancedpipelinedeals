import { supabase } from "../lib/core/supabaseClient";
import { logger } from "../lib/core/logger";
import { VoiceJobPayload } from "./types";

/**
 * Queues a voice job to be processed (e.g., by Netlify cron).
 */
export async function queueVoiceJob(payload: VoiceJobPayload) {
  const { contact_id, script } = payload;

  const { data, error } = await supabase
    .from("voice_jobs")
    .insert({
      contact_id,
      script,
      status: "pending"
    })
    .select("*")
    .single();

  if (error) {
    logger.error("Failed to queue voice job", { payload, error });
    throw error;
  }

  logger.info("Queued voice job", { jobId: data.id });

  return data;
}