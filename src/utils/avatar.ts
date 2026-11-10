/**
 * Local avatar placeholders (no external avatar service).
 * Real generated images come from the OpenAI Images gateway (see services/imageService.ts).
 */
const PALETTE = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#0ea5e9', '#ec4899'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initialsOf(name: string, max = 2): string {
  const parts = (name || '?').trim().split(/[\s\-_.]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts.slice(0, max).map(p => p[0]) : [(parts[0] || '?').slice(0, max)];
  return letters.join('').toUpperCase();
}

/** Returns an SVG data URI with the initials on a deterministic colour. */
export function initialsAvatar(seed: string | undefined | null, size = 96): string {
  const name = String(seed ?? '?');
  const bg = PALETTE[hash(name) % PALETTE.length];
  const text = initialsOf(name);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="100%" height="100%" rx="${size / 2}" fill="${bg}"/>` +
    `<text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${size * 0.4}" fill="#fff">${text.replace(/[<>&]/g, '')}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
