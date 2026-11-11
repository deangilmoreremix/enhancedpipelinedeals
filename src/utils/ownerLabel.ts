import type { Deal } from '../types';

/**
 * Owner display name for a deal: the denormalised `assignedTo` text, else the directory name of
 * `ownerId ?? assignedToId`. Empty string = unassigned. (ownerId is canonical; assignedTo is the fallback label.)
 *
 * Kept dependency-free (filters/grouping import it): the user directory store registers its lookup here.
 */
type OwnerNameLookup = (id: string) => string | undefined;
let lookup: OwnerNameLookup | null = null;

export function registerOwnerNameLookup(fn: OwnerNameLookup | null): void {
  lookup = fn;
}

export function ownerLabel(d: Pick<Deal, 'assignedTo' | 'ownerId' | 'assignedToId'>): string {
  const text = (d.assignedTo ?? '').trim();
  if (text) return text;
  const id = d.ownerId ?? d.assignedToId;
  if (!id || !lookup) return '';
  try {
    return lookup(id) ?? '';
  } catch {
    return '';
  }
}
