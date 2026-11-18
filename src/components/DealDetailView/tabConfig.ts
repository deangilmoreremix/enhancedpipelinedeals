import type { LucideIcon } from 'lucide-react';
import {
  User, Brain, TrendingUp, MessageSquare, BarChart3, Zap, Settings, Calendar, Mail, FileText, ListChecks,
  Paperclip, Clock, Sparkles
} from 'lucide-react';
import type { DealViewPrefs } from '../../services/dealViewPrefsService';

export interface TabDef { id: string; label: string; icon: LucideIcon }

/** Every tab of the deal view in the default order. */
export const TAB_DEFS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'files', label: 'Files', icon: Paperclip },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'insights', label: 'AI Insights', icon: Brain },
  { id: 'assistant', label: 'Assistant', icon: Sparkles },
  { id: 'journey', label: 'Journey', icon: TrendingUp },
  { id: 'communication', label: 'Communication', icon: MessageSquare },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'automation', label: 'Automation', icon: Zap },
  { id: 'management', label: 'Management', icon: Settings },
];

/** The Overview tab cannot be hidden, so the view always has at least one tab. */
export const LOCKED_TAB = 'overview';

/** Number of tabs reachable with Alt+1..9. */
export const MAX_SHORTCUT_TABS = 9;

/** All tabs in the user's order (unknown ids dropped, tabs missing from the saved order appended in default order). */
export function orderedTabs(order: string[]): TabDef[] {
  const known = new Map(TAB_DEFS.map(t => [t.id, t]));
  const out: TabDef[] = [];
  for (const id of order) {
    const t = known.get(id);
    if (t && !out.includes(t)) out.push(t);
  }
  for (const t of TAB_DEFS) if (!out.includes(t)) out.push(t);
  return out;
}

/** Tabs to show: ordered per prefs, minus the hidden ones (Overview is always visible). */
export function visibleTabs(prefs: Pick<DealViewPrefs, 'tabOrder' | 'hiddenTabs'>): TabDef[] {
  return orderedTabs(prefs.tabOrder).filter(t => t.id === LOCKED_TAB || !prefs.hiddenTabs.includes(t.id));
}

/** Alt+N shortcut for a tab's position among the visible tabs ('' beyond the ninth). */
export const shortcutFor = (index: number): string => (index < MAX_SHORTCUT_TABS ? String(index + 1) : '');
