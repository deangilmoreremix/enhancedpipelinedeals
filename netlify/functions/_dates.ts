/** Thrown for invalid client input; handlers map it to HTTP 400. */
export class BadRequest extends Error {}

/**
 * JSON bodies carry dates as ISO strings but the shared services call `.toISOString()` / `.getTime()` on them, so every
 * date field must be revived to a real Date (invalid values -> BadRequest, never a TypeError -> 500).
 * Keys that are undefined/null are left untouched.
 */
export function reviveDates<T extends Record<string, any>>(input: T, keys: string[]): T {
  const out: Record<string, any> = { ...input };
  for (const k of keys) {
    if (out[k] === undefined || out[k] === null) continue;
    const d = out[k] instanceof Date ? out[k] : new Date(out[k]);
    if (Number.isNaN(d.getTime())) throw new BadRequest(`${k} is not a valid date`);
    out[k] = d;
  }
  return out as T;
}
