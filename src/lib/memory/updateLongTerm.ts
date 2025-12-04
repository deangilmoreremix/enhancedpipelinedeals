import { upsertMemory } from "./upsertMemory";

export async function updateLongTerm(
  contactId: string,
  payload: {
    history_summary?: string;
    win_loss_patterns?: string;
    key_preferences?: string;
    extra?: any;
  }
) {
  const data = {
    ...payload,
    timestamp: new Date().toISOString()
  };

  await upsertMemory(contactId, "long", data);
}