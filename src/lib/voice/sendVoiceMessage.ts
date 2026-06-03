import { executeTool } from "../core/mcpExecutor";
import { logger } from "../core/logger";

/**
 * Sends a base64-encoded audio message using MCP.
 * You can implement this tool in your VoiceAgent MCP server.
 */
export async function sendVoiceMessage(to: string, audioBase64: string) {
  logger.info("Sending voice message", { to });

  const res = await executeTool("VoiceAgent.send_voice_message", {
    to,
    audio_base64: audioBase64
  });

  return res;
}