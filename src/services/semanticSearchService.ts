/** Semantic contact search with OpenAI embeddings (netlify/functions/ai-embed.ts + pgvector in Supabase). */
import { authedFetch, AIGatewayError } from './aiClient';

export interface SemanticContactMatch {
  contact_id: string;
  content: string;
  similarity: number;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const res = await authedFetch('/api/ai/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new AIGatewayError(data.error || res.statusText, res.status);
  return data as T;
}

/** (Re)index a contact so it can be found by meaning. Safe to call after create/update/enrichment. */
export const indexContact = (contactId: string) => call<{ model: string }>({ action: 'index_contact', contactId });

/** "CTO at a logistics startup in Austin" -> best matching contacts. */
export async function searchContacts(query: string, limit = 10): Promise<SemanticContactMatch[]> {
  const { results } = await call<{ results: SemanticContactMatch[] }>({ action: 'search_contacts', query, limit });
  return results;
}
