import type { CSSProperties } from 'react';
import type { PipelineStage } from '../types';
import { DEFAULT_STAGES } from '../services/pipelineStageService';

/**
 * Stage metadata helpers. Stages are data (pipeline_stages), so nothing outside seeds / import mappers
 * may hard-code stage keys: look names, colours and won/lost flags up here instead.
 */

export interface StageMeta {
  key: string;
  name: string;
  color: string;
  position: number;
  probability: number;
  isWon: boolean;
  isLost: boolean;
  visible: boolean;
  /** True when the key is not part of the stage list (deleted/renamed stage); metadata is synthesised. */
  unknown: boolean;
}

const titleCase = (key: string) => key.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/** Metadata for `key`; falls back to a neutral gray stage named after the key when it is not in `stages`. */
export function getStageMeta(stages: PipelineStage[] | undefined | null, key: string): StageMeta {
  const list = stages && stages.length > 0 ? stages : DEFAULT_STAGES;
  const s = list.find(x => x.key === key);
  if (!s) {
    return { key, name: titleCase(key || 'unknown'), color: 'gray', position: Number.MAX_SAFE_INTEGER, probability: 0, isWon: false, isLost: false, visible: true, unknown: true };
  }
  return {
    key: s.key, name: s.name, color: s.color || 'gray', position: s.position, probability: s.probability ?? 0,
    isWon: !!s.isWon, isLost: !!s.isLost, visible: s.visible !== false, unknown: false
  };
}

export const isWonStage = (stages: PipelineStage[] | undefined | null, key: string): boolean => getStageMeta(stages, key).isWon;
export const isLostStage = (stages: PipelineStage[] | undefined | null, key: string): boolean => getStageMeta(stages, key).isLost;
/** Open = neither won nor lost. */
export const isOpenStage = (stages: PipelineStage[] | undefined | null, key: string): boolean => {
  const m = getStageMeta(stages, key);
  return !m.isWon && !m.isLost;
};
export const isClosedStage = (stages: PipelineStage[] | undefined | null, key: string): boolean => !isOpenStage(stages, key);

/** Keys of all won / lost / open stages (in position order). */
export function stageKeysWhere(stages: PipelineStage[] | undefined | null, kind: 'won' | 'lost' | 'open' | 'closed'): string[] {
  const list = [...(stages && stages.length > 0 ? stages : DEFAULT_STAGES)].sort((a, b) => a.position - b.position);
  return list
    .filter(s => {
      if (kind === 'won') return s.isWon;
      if (kind === 'lost') return s.isLost;
      if (kind === 'closed') return s.isWon || s.isLost;
      return !s.isWon && !s.isLost;
    })
    .map(s => s.key);
}

/** Stages in display order. */
export const sortedStages = (stages: PipelineStage[] | undefined | null): PipelineStage[] =>
  [...(stages && stages.length > 0 ? stages : DEFAULT_STAGES)].sort((a, b) => a.position - b.position);

// Static class names so Tailwind can see them.
const COLOR_CLASSES: Record<string, { border: string; borderL: string; bg: string; chip: string; text: string; dot: string }> = {
  blue: { border: 'border-blue-500', borderL: 'border-l-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', chip: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  indigo: { border: 'border-indigo-500', borderL: 'border-l-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', text: 'text-indigo-600 dark:text-indigo-400', dot: 'bg-indigo-500' },
  purple: { border: 'border-purple-500', borderL: 'border-l-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', chip: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  green: { border: 'border-green-500', borderL: 'border-l-green-500', bg: 'bg-green-50 dark:bg-green-900/20', chip: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', text: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
  red: { border: 'border-red-500', borderL: 'border-l-red-500', bg: 'bg-red-50 dark:bg-red-900/20', chip: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  yellow: { border: 'border-yellow-500', borderL: 'border-l-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', chip: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', text: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
  orange: { border: 'border-orange-500', borderL: 'border-l-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', chip: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  amber: { border: 'border-amber-500', borderL: 'border-l-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  pink: { border: 'border-pink-500', borderL: 'border-l-pink-500', bg: 'bg-pink-50 dark:bg-pink-900/20', chip: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300', text: 'text-pink-600 dark:text-pink-400', dot: 'bg-pink-500' },
  teal: { border: 'border-teal-500', borderL: 'border-l-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/20', chip: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300', text: 'text-teal-600 dark:text-teal-400', dot: 'bg-teal-500' },
  gray: { border: 'border-gray-500', borderL: 'border-l-gray-500', bg: 'bg-gray-50 dark:bg-gray-900/20', chip: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-500' }
};

export const STAGE_COLOR_TOKENS = Object.keys(COLOR_CLASSES);

const isCssColor = (c: string) => /^(#|rgb|hsl)/i.test(c);

export interface StageColorClasses {
  /** `border-<c>-500` (whole border). */
  border: string;
  /** `border-l-<c>-500` (left accent). */
  borderLeft: string;
  /** Soft tinted background. */
  bg: string;
  /** Pill/chip: tinted background + readable text. */
  chip: string;
  /** Accent text colour. */
  text: string;
  /** Solid dot. */
  dot: string;
  /** Inline style for custom CSS colours (hex/rgb/hsl); undefined for Tailwind tokens. */
  style?: CSSProperties;
  /** Same, for left-accent usage (border-left-color + tinted background). */
  styleAccent?: CSSProperties;
}

/** Tailwind classes for a PipelineStage.color token ('blue', 'border-blue-500', …) with a custom-hex inline-style fallback. */
export function stageColorClasses(color?: string): StageColorClasses {
  const raw = (color ?? '').trim();
  if (isCssColor(raw)) {
    return {
      border: 'border-2', borderLeft: 'border-l-4', bg: '', chip: '', text: '', dot: '',
      style: { backgroundColor: `${raw}26`, color: raw, borderColor: raw },
      styleAccent: { borderLeftColor: raw }
    };
  }
  const token = raw.replace(/^(border|bg|text)-/, '').replace(/-\d+$/, '');
  const c = COLOR_CLASSES[token] ?? COLOR_CLASSES.gray;
  return { border: c.border, borderLeft: c.borderL, bg: c.bg, chip: c.chip, text: c.text, dot: c.dot };
}
