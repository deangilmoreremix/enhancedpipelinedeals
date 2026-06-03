import { callOpenAI } from "../lib/core/callOpenAI";
import { logger } from "../lib/core/logger";
import { queueVoiceJob } from "./queueVoiceJob";
import { updateShortTerm } from "../memory/updateShortTerm";
import { getContactAndDeal } from "../autopilot/helpers";
import { applyMood } from "../mood/applyMood";
import { determineMood } from "../mood/determineMood";
import { loadAgentMemory } from "../memory/loadMemory";
import { buildMemoryPrompt } from "../memory/memoryPrompt";

/**
 * High-level voice SDR/AE agent:
 *  - builds a personalized script
 *  - queues a voice message job
 */
export async function runVoiceAgent(contactId: string, mode: "sdr" | "ae" = "sdr") {
  const { contact, deal } = await getContactAndDeal(contactId);
  const memory = await loadAgentMemory(contactId);
  const mood = determineMood(contact, deal);
  const memoryBlock = buildMemoryPrompt(memory.short, memory.mid, memory.long);

  const role =
    mode === "sdr"
      ? "You are an SDR leaving a short, friendly voicemail."
      : "You are an AE leaving a concise, value-packed voicemail.";

  const prompt = `
${role}

Contact:
${JSON.stringify(contact, null, 2)}

Deal:
${JSON.stringify(deal, null, 2)}

${memoryBlock}

Task:
- Write a 20–40 second voice message script.
- Make it sound natural when spoken.
- End with a clear but low-pressure call-to-action.
Return ONLY the voicemail script text.
  `;

  const finalPrompt = applyMood(prompt, mood);

  const script = await callOpenAI(finalPrompt, []);

  const scriptText = typeof script === "string" ? script.trim() : JSON.stringify(script);

  // Queue a job for conversion + sending
  const job = await queueVoiceJob({
    contact_id: contactId,
    script: scriptText
  });

  // Save to short-term memory
  await updateShortTerm(contactId, {
    last_message: scriptText,
    last_agent: mode === "sdr" ? "voice_sdr" : "voice_ae",
    last_channel: "voice"
  });

  logger.info("Voice agent queued job", { contactId, jobId: job.id });

  return {
    job_id: job.id,
    script: scriptText,
    mood
  };
}