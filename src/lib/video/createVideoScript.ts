import { callOpenAI } from "../lib/core/callOpenAI";
import { buildMemoryPrompt } from "../memory/memoryPrompt";
import { determineMood } from "../mood/determineMood";
import { applyMood } from "../mood/applyMood";
import { loadAgentMemory } from "../memory/loadMemory";
import { getContactAndDeal } from "../autopilot/helpers";

export async function createVideoScript(contactId: string, template: string) {
  const { contact, deal } = await getContactAndDeal(contactId);
  const memory = await loadAgentMemory(contactId);
  const memoryBlock = buildMemoryPrompt(memory.short, memory.mid, memory.long);
  const mood = determineMood(contact, deal);

  const basePrompt = `
You are creating a short personalized sales video script.

Video template type: ${template}

Contact:
${JSON.stringify(contact, null, 2)}

Deal:
${JSON.stringify(deal, null, 2)}

${memoryBlock}

Task:
- Write a 45–60 second video script.
- Include intro, main value points, and a clear call-to-action.
- Use first person ("I", "we") and speak directly to the viewer by name if available.
Return ONLY the script text, ready for narration.
  `;

  const finalPrompt = applyMood(basePrompt, mood);

  const script = await callOpenAI(finalPrompt, []);

  const scriptText = typeof script === "string" ? script.trim() : JSON.stringify(script);

  return { scriptText, mood };
}