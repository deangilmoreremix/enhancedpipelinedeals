/** Browser client for the OpenAI audio gateway (netlify/functions/ai-voice.ts). */
import { authedFetch, AIGatewayError } from './aiClient';

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const res = await authedFetch('/api/ai/voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new AIGatewayError(data.error || res.statusText, res.status);
  return data as T;
}

/** Text -> speech (mp3 stored in Supabase Storage). */
export const speak = (text: string, opts: { voice?: string; instructions?: string; contactId?: string } = {}) =>
  call<{ url: string; path: string; model: string }>({ action: 'speak', text, ...opts });

/** Recorded audio -> text with gpt-transcribe. */
export async function transcribe(audio: Blob, fileName = 'audio.webm') {
  const buf = new Uint8Array(await audio.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return call<{ text: string; languages: string[] | null }>({
    action: 'transcribe',
    audioBase64: btoa(bin),
    mimeType: audio.type || 'audio/webm',
    fileName,
  });
}
