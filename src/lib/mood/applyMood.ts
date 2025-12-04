import { MoodId } from "./types";
import { moodModifiers } from "./moodModifiers";

/**
 * Takes a base prompt and mood id, and appends a tone/style directive.
 */
export function applyMood(prompt: string, mood: MoodId): string {
  const modifier = moodModifiers[mood] || "";

  return `
${prompt}

====================
MOOD PROFILE: ${mood.toUpperCase()}
${modifier}
====================

Always respond in a way that matches this mood profile.
`;
}