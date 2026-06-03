import { supabase } from "../lib/core/supabaseClient";
import { logger } from "../lib/core/logger";
import { createVoiceMessage } from "./createVoiceMessage";
import { sendVoiceMessage } from "./sendVoiceMessage";
import { VoiceJobRecord } from "./types";

/**
 * Fetches N pending jobs and processes them.
 */
export async function processPendingVoiceJobs(limit = 10) {
  const { data: jobs, error } = await supabase
    .from("voice_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    logger.error("Failed to fetch pending voice jobs", { error });
    throw error;
  }

  if (!jobs || jobs.length === 0) {
    logger.info("No pending voice jobs to process");
    return [];
  }

  const processed: VoiceJobRecord[] = [];

  for (const job of jobs as VoiceJobRecord[]) {
    try {
      logger.info("Processing voice job", { jobId: job.id });

      // Mark as processing
      await supabase
        .from("voice_jobs")
        .update({ status: "processing" })
        .eq("id", job.id);

      // Lookup contact email
      const { data: contact, error: cErr } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", job.contact_id)
        .single();

      if (cErr || !contact?.email) {
        logger.error("Voice job contact not found or missing email", {
          jobId: job.id,
          cErr
        });
        await supabase
          .from("voice_jobs")
          .update({ status: "failed" })
          .eq("id", job.id);
        continue;
      }

      // Create audio
      const audioBase64 = await createVoiceMessage(job.script || "");

      // Send via MCP
      await sendVoiceMessage(contact.email, audioBase64);

      // Update job
      await supabase
        .from("voice_jobs")
        .update({
          status: "sent",
          audio_base64: audioBase64
        })
        .eq("id", job.id);

      processed.push({
        ...job,
        status: "sent",
        audio_base64: audioBase64
      });
    } catch (e) {
      logger.error("Error processing voice job", { jobId: job.id, e });
      await supabase
        .from("voice_jobs")
        .update({ status: "failed" })
        .eq("id", job.id);
    }
  }

  return processed;
}