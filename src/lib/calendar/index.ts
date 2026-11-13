import { supabase } from "../core/supabaseClient";
import { logger } from "../core/logger";

export interface ScheduleMeetingInput {
  contactId: string;
  startISO: string;
  durationMinutes?: number;
  title?: string;
  notes?: string;
}

/**
 * Schedules a meeting for a contact at the given ISO datetime.
 * Creates a calendar_events row in Supabase and returns it.
 */
export async function scheduleMeeting(input: ScheduleMeetingInput) {
  const start = new Date(input.startISO);
  if (Number.isNaN(start.getTime())) {
    throw new Error(`Invalid start time: ${input.startISO}`);
  }
  const end = new Date(start.getTime() + (input.durationMinutes ?? 30) * 60_000);

  const { data: event, error } = await supabase
    .from("calendar_events")
    .insert({
      contact_id: input.contactId,
      title: input.title ?? "Meeting",
      description: input.notes ?? null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    })
    .select()
    .single();

  if (error) {
    logger.error?.("Failed to schedule meeting", { error: error.message });
    throw new Error(error.message);
  }
  return event;
}
