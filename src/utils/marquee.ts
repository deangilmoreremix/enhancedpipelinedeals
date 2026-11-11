/** Pure geometry for drag-rectangle (marquee) selection. */

export interface Point { x: number; y: number }
export interface Rect { left: number; top: number; right: number; bottom: number }

/** Normalised rectangle spanning two points (either drag direction). */
export function rectFromPoints(a: Point, b: Point): Rect {
  return { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), right: Math.max(a.x, b.x), bottom: Math.max(a.y, b.y) };
}

/** True when the rectangles overlap (touching edges do not count). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Pixel distance the pointer must travel before a press becomes a marquee (so plain clicks keep working). */
export const MARQUEE_THRESHOLD = 4;

export const exceedsThreshold = (a: Point, b: Point, threshold = MARQUEE_THRESHOLD): boolean =>
  Math.abs(a.x - b.x) >= threshold || Math.abs(a.y - b.y) >= threshold;

/** Ids of the items whose rectangle intersects `marquee`, in input order. */
export function idsInMarquee(marquee: Rect, items: Array<{ id: string; rect: Rect }>): string[] {
  return items.filter(i => rectsIntersect(marquee, i.rect)).map(i => i.id);
}

/** Resulting selection: replaces `current` unless `additive` (Shift), which unions. */
export function applyMarqueeSelection(current: string[], hit: string[], additive: boolean): string[] {
  return additive ? Array.from(new Set([...current, ...hit])) : Array.from(new Set(hit));
}

/** True when a mousedown target should NOT start a marquee (cards, controls, editors, column headers). */
export function isMarqueeBlocked(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return true;
  return !!el.closest('[data-deal-id], button, input, select, textarea, a, [role="button"], [role="listbox"], [role="menu"], [contenteditable="true"], [data-rfd-drag-handle-draggable-id], [data-no-marquee]');
}
