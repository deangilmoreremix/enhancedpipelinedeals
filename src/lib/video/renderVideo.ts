import { logger } from "../lib/core/logger";

/**
 * Placeholder for real Remotion / rendering logic.
 * For now, returns a fake base64 string to keep the pipeline functional.
 */
export async function renderVideo(
  template: string,
  script: string,
  props: any
): Promise<string> {
  logger.info("Rendering video (stub implementation)", { template });

  // In real implementation:
  // - Call Remotion Lambda / CloudRun
  // - Use template + props + TTS audio
  // - Return base64 of MP4 or remote URL
  const fakeData = `data:video/mp4;base64,${Buffer.from(
    `Fake video for template=${template}, script=${script.slice(0, 80)}...`
  ).toString("base64")}`;

  return fakeData;
}