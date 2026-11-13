/**
 * Folder for generated assets in Supabase Storage. Every segment is sanitised separately so the path we return is exactly
 * the path that is stored (storage collapses empty segments, so "a/../b" must not become "a//b").
 */
export function storageFolder(...parts: unknown[]): string {
  return parts.map((x) => String(x ?? '').replace(/[^a-zA-Z0-9_-]/g, '')).filter(Boolean).join('/') || 'misc';
}
