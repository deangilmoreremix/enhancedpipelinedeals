import type { Deal, PipelineStage } from '../../types';

/** Board order: stage position first, then fractional deal position, then title. */
export function orderDealIds(deals: Record<string, Deal>, stages: PipelineStage[]): string[] {
  const stageRank = new Map(stages.map(s => [s.key, s.position]));
  return Object.values(deals)
    .filter(d => !d.deletedAt)
    .sort((a, b) => {
      const sa = stageRank.get(a.stage) ?? Number.MAX_SAFE_INTEGER;
      const sb = stageRank.get(b.stage) ?? Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      const pa = a.position ?? 0;
      const pb = b.position ?? 0;
      if (pa !== pb) return pa - pb;
      return (a.title ?? a.company).localeCompare(b.title ?? b.company);
    })
    .map(d => d.id);
}

export function neighbours(order: string[], id: string): { prev?: string; next?: string; index: number; total: number } {
  const index = order.indexOf(id);
  return {
    prev: index > 0 ? order[index - 1] : undefined,
    next: index >= 0 && index < order.length - 1 ? order[index + 1] : undefined,
    index,
    total: order.length,
  };
}
