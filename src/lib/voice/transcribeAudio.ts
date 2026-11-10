import { transcribe } from "../../services/voiceService";
import { logger } from "../core/logger";

/** Transcribes audio (Blob) with OpenAI gpt-transcribe via the Netlify gateway. */
export async function transcribeAudio(audio: Blob): Promise<string> {
  logger.info("Transcribing audio");
  const { text } = await transcribe(audio);
  return text;
}
