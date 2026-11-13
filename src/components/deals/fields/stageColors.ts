/** Stage color helpers. Stage colors are Tailwind color names ('blue') or CSS colors ('#3b82f6'). */
const CHIP: Record<string, string> = {
  blue: 'bg-blue-500', indigo: 'bg-indigo-500', purple: 'bg-purple-500', green: 'bg-green-500',
  red: 'bg-red-500', yellow: 'bg-yellow-500', orange: 'bg-orange-500', pink: 'bg-pink-500',
  teal: 'bg-teal-500', cyan: 'bg-cyan-500', gray: 'bg-gray-500', slate: 'bg-slate-500',
  emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500', sky: 'bg-sky-500',
};

export function stageChip(color: string | undefined): { className: string; style?: React.CSSProperties } {
  const c = (color ?? '').trim();
  if (CHIP[c]) return { className: CHIP[c] };
  if (/^(#|rgb|hsl)/i.test(c)) return { className: '', style: { backgroundColor: c } };
  return { className: 'bg-gray-500' };
}
