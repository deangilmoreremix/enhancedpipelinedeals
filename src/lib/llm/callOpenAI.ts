import { callAI, streamAI } from "../../services/aiClient";

const SDR_INSTRUCTIONS =
  "You are an expert SDR AI assistant. Generate professional, personalized email responses that advance the sales conversation. Keep responses concise (4-7 sentences) and always include a clear next step.";

// MAIN LLM CALL FOR SDR RESPONSES (Responses API via the Netlify gateway)
export async function callOpenAI(prompt: string): Promise<string> {
  try {
    const result = await callAI("chat", { instructions: SDR_INSTRUCTIONS, input: prompt, tier: "default", maxOutputTokens: 800 });
    return result.text || "I apologize, but I couldn't generate a response at this time.";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate AI response");
  }
}

// STREAMING VERSION FOR REAL-TIME UI (typed Responses events -> SSE deltas)
export async function callOpenAIStreaming(prompt: string, onChunk: (chunk: string) => void): Promise<string> {
  try {
    return await streamAI({ instructions: SDR_INSTRUCTIONS, input: prompt, tier: "default", maxOutputTokens: 800 }, onChunk);
  } catch (error) {
    console.error("OpenAI streaming error:", error);
    throw new Error("Failed to generate streaming response");
  }
}

// ANALYTICS VERSION FOR DEAL INTELLIGENCE (JSON output)
export async function analyzeWithAI(systemPrompt: string, userPrompt: string, data: any): Promise<any> {
  try {
    const result = await callAI("chat", {
      instructions: `${systemPrompt}\nRespond with a single JSON object only.`,
      input: `${userPrompt}\n\nData: ${JSON.stringify(data, null, 2)}`,
      json: true,
      tier: "default",
    });
    return result.data;
  } catch (error) {
    console.error("AI analysis error:", error);
    throw new Error("Failed to analyze data");
  }
}
