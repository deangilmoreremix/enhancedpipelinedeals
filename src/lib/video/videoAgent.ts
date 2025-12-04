import { createVideoScript } from "./createVideoScript";
import { queueVideoJob } from "./queueVideoJob";
import { updateShortTerm } from "../memory/updateShortTerm";
import { logger } from "../core/logger";

export async function runVideoAgent(
  contactId: string,
  template: string = "explainer"
) {
  const { scriptText, mood } = await createVideoScript(contactId, template);

  const job = await queueVideoJob({
    contact_id: contactId,
    template,
    script: scriptText,
    props: {
      script: scriptText,
      template
    }
  });

  await updateShortTerm(contactId, {
    last_message: scriptText,
    last_agent: "video_agent",
    last_channel: "video"
  });

  logger.info("Video agent queued job", { contactId, jobId: job.id });

  return {
    job_id: job.id,
    script: scriptText,
    mood,
    template
  };
}