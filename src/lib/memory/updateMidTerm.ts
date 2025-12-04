import { upsertMemory } from "./upsertMemory";

export async function updateMidTerm(
  contactId: string,
  payload: {
    objection_patterns?: string[];
    engagement_patterns?: string[];
    tone_preferences?: string[];
    extra?: any;
  }
) {
  const data = {
    ...payload,
    timestamp: new Date().toISOString()
  };

  await upsertMemory(contactId, "mid", data);
}