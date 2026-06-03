import { supabase } from "../core/supabaseClient";
import { logger } from "../core/logger";
import { renderVideo } from "./renderVideo";
import { VideoJobRecord } from "./types";
import { executeTool } from "../core/mcpExecutor";

export async function processPendingVideoJobs(limit = 5) {
  const { data: jobs, error } = await supabase
    .from("video_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    logger.error("Failed to fetch pending video jobs", { error });
    throw error;
  }

  if (!jobs || jobs.length === 0) {
    logger.info("No pending video jobs to process");
    return [];
  }

  const processed: VideoJobRecord[] = [];

  for (const job of jobs as VideoJobRecord[]) {
    try {
      logger.info("Processing video job", { jobId: job.id });

      await supabase
        .from("video_jobs")
        .update({ status: "processing" })
        .eq("id", job.id);

      // Get contact with email
      const { data: contact, error: cErr } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", job.contact_id)
        .single();

      if (cErr || !contact?.email) {
        logger.error("Video job contact not found or missing email", {
          jobId: job.id,
          cErr
        });
        await supabase
          .from("video_jobs")
          .update({ status: "failed" })
          .eq("id", job.id);
        continue;
      }

      const template = job.template || "default";
      const script = job.props?.script || "(no script)";
      const props = job.props || {};

      const videoBase64 = await renderVideo(template, script, props);

      // Save video in job record
      await supabase
        .from("video_jobs")
        .update({
          status: "sent",
          video_base64: videoBase64
        })
        .eq("id", job.id);

      // Email stub - AgentMail removed

      processed.push({
        ...job,
        status: "sent",
        video_base64: videoBase64
      });
    } catch (e) {
      logger.error("Error processing video job", { jobId: job.id, e });
      await supabase
        .from("video_jobs")
        .update({ status: "failed" })
        .eq("id", job.id);
    }
  }

  return processed;
}