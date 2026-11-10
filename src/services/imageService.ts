/**
 * Image generation/editing with OpenAI GPT Image 2.6 via the server-side gateway
 * (netlify/functions/ai-image.ts). Results are stored in Supabase Storage.
 */
import { authHeader, AIGatewayError } from './aiClient';
import { initialsAvatar } from '../utils/avatar';

export interface GeneratedImage {
  url: string;
  path: string;
  model: string;
  revised_prompt: string | null;
}

async function post(body: Record<string, unknown>): Promise<GeneratedImage> {
  const res = await fetch('/api/ai/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new AIGatewayError(data.error || res.statusText, res.status);
  return data as GeneratedImage;
}

export const generateImage = (
  prompt: string,
  opts: { entityType?: string; entityId?: string; size?: string; quality?: string; background?: string } = {},
) => post({ action: 'generate', prompt, ...opts });

export const editImage = (
  imageUrl: string,
  prompt: string,
  opts: { entityType?: string; entityId?: string; size?: string; quality?: string } = {},
) => post({ action: 'edit', imageUrl, prompt, ...opts });

/** Professional, neutral avatar illustration for a contact (no real-person likeness is claimed). */
export async function generateContactAvatar(contact: { id?: string; name: string; title?: string; industry?: string }) {
  return generateImage(
    `Friendly flat-style professional avatar illustration, head and shoulders, neutral background, for a business contact` +
      `${contact.title ? ` working as ${contact.title}` : ''}${contact.industry ? ` in ${contact.industry}` : ''}. No text, no logos.`,
    { entityType: 'contacts', entityId: contact.id, size: '1024x1024', quality: 'low' },
  );
}

/** Clean abstract company mark placeholder. */
export async function generateCompanyLogo(company: { id?: string; name: string; industry?: string }) {
  return generateImage(
    `Minimal modern abstract logo mark for a company called "${company.name}"${company.industry ? ` in the ${company.industry} industry` : ''}. Simple geometric shape, flat colours, transparent background, no text.`,
    { entityType: 'companies', entityId: company.id, size: '1024x1024', quality: 'low', background: 'transparent' },
  );
}

/** Never throws: returns a generated avatar URL or the local initials fallback. */
export async function avatarOrFallback(contact: { id?: string; name: string; title?: string; industry?: string }): Promise<string> {
  try {
    return (await generateContactAvatar(contact)).url;
  } catch {
    return initialsAvatar(contact.name);
  }
}
