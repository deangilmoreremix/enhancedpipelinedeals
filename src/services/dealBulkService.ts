import type { Deal } from '../types';

export type BulkDealInput = Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>;

export interface BulkImportItem {
  /** 1-based source row (for error reporting). */
  row: number;
  action: 'create' | 'update';
  data: BulkDealInput | Partial<Deal>;
  /** Required for `update`. */
  existingId?: string;
}

export interface BulkImportDeps {
  createDeal: (deal: BulkDealInput) => Promise<unknown>;
  updateDeal: (id: string, updates: Partial<Deal>) => Promise<unknown>;
}

export interface BulkImportResult {
  created: number;
  updated: number;
  failed: Array<{ row: number; message: string }>;
}

export const BULK_CHUNK_SIZE = 50;

/**
 * Give new deals explicit, strictly increasing positions at the end of their stage so concurrent
 * creates in one chunk do not collide on `max(position) + 1`.
 */
export function assignBulkPositions(items: BulkImportItem[], existing: Deal[]): BulkImportItem[] {
  const next: Record<string, number> = {};
  existing.forEach(d => { next[d.stage] = Math.max(next[d.stage] ?? 0, d.position ?? 0); });
  return items.map(item => {
    if (item.action !== 'create') return item;
    const data = item.data as BulkDealInput;
    if (data.position !== undefined) return item;
    next[data.stage] = (next[data.stage] ?? 0) + 1;
    return { ...item, data: { ...data, position: next[data.stage] } };
  });
}

/**
 * Create/update deals in chunks (default 50 at a time) through the supplied store actions.
 * Never throws for a single failing row: failures are collected with their row number.
 */
export async function bulkImportDeals(
  items: BulkImportItem[],
  deps: BulkImportDeps,
  options: { chunkSize?: number; onProgress?: (done: number, total: number) => void; isCancelled?: () => boolean } = {}
): Promise<BulkImportResult> {
  const chunkSize = Math.max(1, options.chunkSize ?? BULK_CHUNK_SIZE);
  const result: BulkImportResult = { created: 0, updated: 0, failed: [] };
  let done = 0;
  options.onProgress?.(0, items.length);

  for (let i = 0; i < items.length; i += chunkSize) {
    if (options.isCancelled?.()) break;
    const chunk = items.slice(i, i + chunkSize);
    const settled = await Promise.allSettled(
      chunk.map(item =>
        item.action === 'update' && item.existingId
          ? deps.updateDeal(item.existingId, item.data as Partial<Deal>)
          : deps.createDeal(item.data as BulkDealInput)
      )
    );
    settled.forEach((s, idx) => {
      const item = chunk[idx];
      if (s.status === 'fulfilled') {
        if (item.action === 'update') result.updated++; else result.created++;
      } else {
        const reason: unknown = s.reason;
        result.failed.push({ row: item.row, message: reason instanceof Error ? reason.message : String(reason) });
      }
    });
    done += chunk.length;
    options.onProgress?.(done, items.length);
  }
  return result;
}
