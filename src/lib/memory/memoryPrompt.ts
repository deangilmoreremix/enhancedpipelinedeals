import { MemoryRecord } from "./types";

export function buildMemoryPrompt(
  short: MemoryRecord[] = [],
  mid: MemoryRecord[] = [],
  long: MemoryRecord[] = []
): string {
  const latestShort = short[0]?.data ?? null;
  const latestMid = mid[0]?.data ?? null;
  const latestLong = long[0]?.data ?? null;

  return `
==== MEMORY CONTEXT ====

SHORT-TERM (recent messages & actions):
${JSON.stringify(latestShort, null, 2)}

MID-TERM (patterns & preferences):
${JSON.stringify(latestMid, null, 2)}

LONG-TERM (account-level insights):
${JSON.stringify(latestLong, null, 2)}

Use this memory to:
- Stay consistent with prior conversations.
- Respect their preferences and tone.
- Avoid repeating questions or offers they've rejected.
=========================
`;
}