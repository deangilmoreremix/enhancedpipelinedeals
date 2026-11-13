import {
  AlarmClock, ArrowRightLeft, Bell, Bot, CalendarClock, CheckSquare, Code, DatabaseZap, FilePlus, Filter, Flag,
  GitBranch, Globe, Mail, MessageSquare, MousePointerClick, Pencil, PlusCircle, Repeat, Search, StickyNote,
  TextCursorInput, Timer, Trash2, UserCheck, Webhook, Zap, type LucideIcon
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  AlarmClock, ArrowRightLeft, Bell, Bot, CalendarClock, CheckSquare, Code, DatabaseZap, FilePlus, Filter, Flag,
  GitBranch, Globe, Mail, MessageSquare, MousePointerClick, Pencil, PlusCircle, Repeat, Search, StickyNote,
  TextCursorInput, Timer, Trash2, UserCheck, Webhook
};

/** Resolves a registry icon name to a lucide component (falls back to Zap). */
export const iconFor = (name: string | undefined): LucideIcon => (name && ICONS[name]) || Zap;

export type StepAccent = { bar: string; chip: string; ring: string };

/** Type colour accents (Tailwind class strings must stay literal for the JIT). */
export const STEP_ACCENTS: Record<string, StepAccent> = {
  trigger: { bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', ring: 'ring-amber-400' },
  action: { bar: 'bg-blue-600', chip: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', ring: 'ring-blue-500' },
  condition: { bar: 'bg-purple-500', chip: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', ring: 'ring-purple-400' },
  delay: { bar: 'bg-gray-500', chip: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200', ring: 'ring-gray-400' },
  iterator: { bar: 'bg-teal-500', chip: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300', ring: 'ring-teal-400' }
};

export const accentForStep = (type: string, actionType?: string): StepAccent =>
  type === 'action' && actionType === 'iterator' ? STEP_ACCENTS.iterator : STEP_ACCENTS[type] ?? STEP_ACCENTS.action;
