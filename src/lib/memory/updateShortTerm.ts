import { upsertMemory } from "./upsertMemory";

export async function updateShortTerm(
  contactId: string,
  payload: {
    last_message?: string;
    last_agent?: string;
    last_channel?: string;
    extra?: any;
  } | string
) {
  const data =
    typeof payload === "string"
      ? {
          last_message: payload,
          timestamp: new Date().toISOString()
        }
      : {
          ...payload,
          timestamp: new Date().toISOString()
        };

  await upsertMemory(contactId, "short", data);
}