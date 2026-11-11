import React from 'react';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export const STATUS_STYLE: Record<string, string> = {
  completed: 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/30',
  failed: 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/30',
  running: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30',
  waiting: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30',
  timeout: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30',
  unknown: 'text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-700'
};

export const StatusIcon: React.FC<{ status: string }> = ({ status }) =>
  status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
  status === 'failed' ? <XCircle className="w-3.5 h-3.5" /> :
  status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />;
