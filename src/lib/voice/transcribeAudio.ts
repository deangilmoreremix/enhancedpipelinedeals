import { openai } from "../core/openaiClient";
import { logger } from "../core/logger";

/**
 * Transcribes a base64 audio input.
 */
export async function transcribeAudio(base64: string): Promise<string> {
  logger.info("Transcribing audio");

  const buffer = Buffer.from(base64, "base64");

  const transcript = await openai.audio.transcriptions.create({
    file: buffer as any, // in real code you'd pass a Readable / File
    model: "gpt-4o-transcribe"
  });

  return transcript.text;
}