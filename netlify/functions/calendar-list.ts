import type { Handler } from "@netlify/functions";
import { supabase } from "../../lib/core/supabaseClient";

export const handler: Handler = async () => {
  try {
    const { data, error } = await supabase
      .from("calendar_events")
      .select(
        `
        id,
        contact_id,
        datetime,
        status,
        contacts:contact_id (
          id,
          name,
          email
        )
      `
      )
      .gte("datetime", new Date().toISOString())
      .order("datetime", { ascending: true })
      .limit(50);

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ events: data })
    };
  } catch (error: any) {
    console.error("[calendar-list] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};