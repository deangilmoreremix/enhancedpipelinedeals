// Shared auth + caller-scoped DB access for the legacy (.js) autopilot / SDR functions.
// Requires a verified Supabase user JWT (or the service key for server-to-server callers). Reads and writes go through
// a client that acts AS THE CALLER (anon key + the caller's Authorization header), so Postgres RLS scopes the data.
import { authUser, userClient, json } from "./_openai";

export async function authenticate(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const user = await authUser(authHeader);
  if (!user) return { error: json(401, { error: "Unauthorized" }) };
  const db = userClient(authHeader);
  if (!db) return { error: json(500, { error: "SUPABASE_URL / SUPABASE_ANON_KEY are not configured on the server" }) };
  return { user, authHeader, db };
}
