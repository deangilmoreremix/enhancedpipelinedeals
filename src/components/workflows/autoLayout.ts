import type { WorkflowStep } from '../../types/workflow';

export interface LayoutOptions { nodeWidth?: number; nodeHeight?: number; gapX?: number; gapY?: number }

/**
 * Small top-down layered layout. Depth = longest path from an entry step (back edges ignored),
 * steps within a layer are ordered by the average x of their parents and centred horizontally.
 * Returns a new steps array with updated `position` (other fields untouched).
 */
export function autoLayout(steps: WorkflowStep[], opts: LayoutOptions = {}): WorkflowStep[] {
  const { nodeWidth = 260, nodeHeight = 110, gapX = 60, gapY = 70 } = opts;
  if (steps.length === 0) return steps;
  const ids = new Set(steps.map(s => s.id));
  const children = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  for (const s of steps) {
    children.set(s.id, (s.connections ?? []).filter(c => ids.has(c) && c !== s.id));
    incoming.set(s.id, 0);
  }
  for (const list of children.values()) for (const c of list) incoming.set(c, (incoming.get(c) ?? 0) + 1);

  const roots = steps.filter(s => s.type === 'trigger' || (incoming.get(s.id) ?? 0) === 0).map(s => s.id);
  const depth = new Map<string, number>();
  const parents = new Map<string, string[]>();

  // DFS from roots, skipping edges that close a cycle.
  const onPath = new Set<string>();
  const visit = (id: string, d: number): void => {
    if (onPath.has(id)) return;
    if ((depth.get(id) ?? -1) >= d) return;
    depth.set(id, d);
    onPath.add(id);
    for (const c of children.get(id) ?? []) {
      if (onPath.has(c)) continue;
      const p = parents.get(c) ?? [];
      if (!p.includes(id)) parents.set(c, [...p, id]);
      visit(c, d + 1);
    }
    onPath.delete(id);
  };
  for (const r of roots) visit(r, 0);
  // Anything unreachable (pure cycles) goes after the deepest layer.
  let maxDepth = Math.max(-1, ...depth.values());
  for (const s of steps) if (!depth.has(s.id)) depth.set(s.id, ++maxDepth);

  const layers: string[][] = [];
  for (const s of steps) {
    const d = depth.get(s.id) as number;
    (layers[d] ??= []).push(s.id);
  }

  const xOf = new Map<string, number>();
  const maxCount = Math.max(...layers.filter(Boolean).map(l => l.length));
  const totalWidth = maxCount * nodeWidth + (maxCount - 1) * gapX;
  layers.forEach(layer => {
    if (!layer) return;
    const ordered = [...layer].sort((a, b) => {
      const avg = (id: string) => {
        const ps = (parents.get(id) ?? []).filter(p => xOf.has(p));
        return ps.length ? ps.reduce((sum, p) => sum + (xOf.get(p) as number), 0) / ps.length : 0;
      };
      return avg(a) - avg(b);
    });
    const width = ordered.length * nodeWidth + (ordered.length - 1) * gapX;
    const start = (totalWidth - width) / 2;
    ordered.forEach((id, i) => xOf.set(id, start + i * (nodeWidth + gapX)));
  });

  return steps.map(s => ({
    ...s,
    position: { x: Math.round(xOf.get(s.id) ?? 0), y: (depth.get(s.id) as number) * (nodeHeight + gapY) }
  }));
}
