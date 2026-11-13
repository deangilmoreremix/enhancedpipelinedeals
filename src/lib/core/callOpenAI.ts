import { callAI } from "../../services/aiClient";
import { openaiFunctionRouter } from "./openaiFunctionRouter";

/**
 * Responses API call through the Netlify gateway. When `functions` (tool definitions) are supplied and the
 * model requests one, it is executed through the function router; otherwise the text answer is returned.
 * Accepts both legacy `{name, description, parameters}` and `{type:'function', function:{...}}` shapes.
 */
export async function callOpenAI(prompt: string, functions: any[] = []) {
  const tools = functions.map((f) => {
    const def = f.function ?? f;
    return { type: "function", name: def.name, description: def.description, parameters: def.parameters };
  });

  const result = await callAI("chat", {
    input: prompt,
    tier: "fast",
    tools: tools.length ? tools : undefined,
    toolChoice: tools.length ? "auto" : undefined,
  });

  const call = result.tool_calls?.[0];
  if (call) return await openaiFunctionRouter(call.name, call.arguments);
  return result.text;
}
