import OpenAI from "openai";
import { env } from "../core/processShim";

const client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

// MAIN LLM CALL FOR SDR RESPONSES
export async function callOpenAI(prompt: string): Promise<string> {
  try {
    if (!client) throw new Error("OpenAI API key not configured");
    const response = await client.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert SDR AI assistant. Generate professional, personalized email responses that advance the sales conversation. Keep responses concise (4-7 sentences) and always include a clear next step."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    return response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response at this time.";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate AI response");
  }
}

// STREAMING VERSION FOR REAL-TIME UI
export async function callOpenAIStreaming(
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  try {
    if (!client) throw new Error("OpenAI API key not configured");
    const stream = await client.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert SDR AI assistant. Generate professional, personalized email responses."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
      stream: true
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        onChunk(content);
      }
    }

    return fullResponse;
  } catch (error) {
    console.error("OpenAI streaming error:", error);
    throw new Error("Failed to generate streaming response");
  }
}

// ANALYTICS VERSION FOR DEAL INTELLIGENCE
export async function analyzeWithAI(
  systemPrompt: string,
  userPrompt: string,
  data: any
): Promise<any> {
  try {
    if (!client) throw new Error("OpenAI API key not configured");
    const response = await client.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `${userPrompt}\n\nData: ${JSON.stringify(data, null, 2)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error("AI analysis error:", error);
    throw new Error("Failed to analyze data");
  }
}