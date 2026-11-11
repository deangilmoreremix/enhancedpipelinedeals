import { useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/core/supabaseClient';

export type RunsLiveMode = 'realtime' | 'polling' | 'off';

interface Options {
  /** Only listen to one workflow's runs. */
  workflowId?: string;
  /** Poll interval when realtime is unavailable (default 10s). */
  pollMs?: number;
  enabled?: boolean;
}

/**
 * Calls `onChange` whenever a `workflow_executions` row changes (Supabase realtime, see migration
 * 20260811000001) and falls back to polling every `pollMs` when realtime is unavailable.
 */
export function useWorkflowRunsRealtime(onChange: () => void, { workflowId, pollMs = 10_000, enabled = true }: Options = {}): RunsLiveMode {
  const cb = useRef(onChange);
  cb.current = onChange;
  const [mode, setMode] = useState<RunsLiveMode>(enabled ? 'polling' : 'off');

  useEffect(() => {
    if (!enabled) { setMode('off'); return; }
    let poll: ReturnType<typeof setInterval> | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let disposed = false;

    const startPolling = () => {
      if (poll || disposed) return;
      setMode('polling');
      poll = setInterval(() => cb.current(), pollMs);
    };
    const stopPolling = () => { if (poll) { clearInterval(poll); poll = null; } };
    const fire = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => cb.current(), 250);
    };

    if (!isSupabaseConfigured) {
      startPolling();
    } else {
      try {
        const filter = workflowId ? { filter: `workflow_id=eq.${workflowId}` } : {};
        channel = supabase
          .channel(`workflow_runs:${workflowId ?? 'all'}:${Math.random().toString(36).slice(2, 8)}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_executions', ...filter }, fire)
          .subscribe((status: string) => {
            if (disposed) return;
            if (status === 'SUBSCRIBED') { stopPolling(); setMode('realtime'); }
            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') startPolling();
          });
        // until the subscription is confirmed, poll so the list never goes stale
        startPolling();
      } catch {
        startPolling();
      }
    }

    return () => {
      disposed = true;
      stopPolling();
      if (debounce) clearTimeout(debounce);
      if (channel) { try { void supabase.removeChannel(channel); } catch { /* ignore */ } }
    };
  }, [workflowId, pollMs, enabled]);

  return mode;
}
