import { openai } from "../lib/core/openaiClient";
import { logger } from "../lib/core/logger";

/**
 * Converts a text script into base64-encoded audio.
 */
export async function createVoiceMessage(script: string): Promise<string> {
  logger.info("Creating voice message from script");

  const audio = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts", // TTS-capable model
    voice: "alloy",
    input: script
  });

  // Node SDK returns a Response-like object; convert to buffer
  const buffer = Buffer.from(await audio.arrayBuffer());

  const base64 = buffer.toString("base64");
  return base64;
}