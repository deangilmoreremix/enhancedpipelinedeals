/**
 * Pure helpers for ordering cards on the board with fractional positions.
 *
 * Behaviour (not code) follows the usual "fractional indexing" drag logic: a dropped
 * card takes the midpoint between its new neighbours so only that one record is
 * written; when gaps collapse the whole column is rebalanced in one batched update.
 */

/** Smallest gap between neighbouring positions before a column needs rebalancing. */
export const MIN_POSITION_GAP = 1e-6;

/**
 * Index at which a dropped card lands in the FULL (unfiltered) ordered list of the
 * destination column, given the index it was dropped at in the VISIBLE (filtered)
 * list. Both lists must already exclude the dragged card.
 */
export function getDestinationIndex(visibleIds: string[], fullIds: string[], destIndex: number): number {
  if (visibleIds.length === 0) return fullIds.length;
  if (destIndex <= 0) {
    const first = fullIds.indexOf(visibleIds[0]);
    return first < 0 ? 0 : first;
  }
  if (destIndex >= visibleIds.length) {
    const last = fullIds.indexOf(visibleIds[visibleIds.length - 1]);
    return last < 0 ? fullIds.length : last + 1;
  }
  const at = fullIds.indexOf(visibleIds[destIndex]);
  return at < 0 ? fullIds.length : at;
}

/**
 * Fractional position for a card inserted at `destIndex` among cards whose positions
 * (ascending, excluding the dragged card) are `orderedPositions`.
 * empty -> 1; first -> first - 1; last -> last + 1; otherwise the midpoint.
 */
export function computeDropPosition(orderedPositions: number[], destIndex: number): number {
  const n = orderedPositions.length;
  if (n === 0) return 1;
  if (destIndex <= 0) return orderedPositions[0] - 1;
  if (destIndex >= n) return orderedPositions[n - 1] + 1;
  return (orderedPositions[destIndex - 1] + orderedPositions[destIndex]) / 2;
}

/** True when any two consecutive (sorted) positions are closer than MIN_POSITION_GAP. */
export function needsRebalance(positions: number[]): boolean {
  if (positions.length < 2) return false;
  const sorted = [...positions].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] < MIN_POSITION_GAP) return true;
  }
  return false;
}

/** Fresh evenly spaced positions (1..n) for ids in their current order. */
export function rebalance(ids: string[]): Array<{ id: string; position: number }> {
  return ids.map((id, i) => ({ id, position: i + 1 }));
}
