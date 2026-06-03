import { supabase } from "../lib/core/supabaseClient";
import { logger } from "../lib/core/logger";
import { VideoJobPayload } from "./types";

export async function queueVideoJob(payload: VideoJobPayload) {
  const { contact_id, template, script, props } = payload;

  const { data, error } = await supabase
    .from("video_jobs")
    .insert({
      contact_id,
      template: template || "default",
      props: props || {},
      status: "pending"
    })
    .select("*")
    .single();

  if (error) {
    logger.error("Failed to queue video job", { payload, error });
    throw error;
  }

  logger.info("Queued video job", { jobId: data.id });

  return data;
}