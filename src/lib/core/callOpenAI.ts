import { openai } from "./openaiClient";
import { openaiFunctionRouter } from "./openaiFunctionRouter";

export async function callOpenAI(prompt: string, functions: any[]) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // or GPT-5 when available
    messages: [{ role: "user", content: prompt }],
    functions,
    function_call: "auto",
    temperature: 0.7
  });

  const choice = response.choices[0];

  if (choice.finish_reason === "function_call") {
    const fn = choice.message.function_call;
    const fnName = fn!.name;
    const args = JSON.parse(fn!.arguments || "{}");

    return await openaiFunctionRouter(fnName, args);
  }

  return response.choices[0].message.content;
}