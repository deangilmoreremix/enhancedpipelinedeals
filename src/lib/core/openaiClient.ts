import OpenAI from "openai";
import { env } from "./processShim";

let openai: OpenAI | null = null;

try {
  const apiKey = env.OPENAI_API_KEY;
  if (apiKey) {
    openai = new OpenAI({ apiKey });
  }
} catch {}

export { openai };