import { speak } from "../../services/voiceService";
import { logger } from "../core/logger";

/**
 * Converts a text script into spoken audio (OpenAI Speech API via the Netlify gateway).
 * Returns the public URL of the mp3 stored in Supabase Storage.
 */
export async function createVoiceMessage(script: string, contactId?: string): Promise<string> {
  logger.info("Creating voice message from script");
  const { url } = await speak(script, { contactId });
  return url;
}
