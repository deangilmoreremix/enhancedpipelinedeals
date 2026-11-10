/**
 * Client for the server-side SDR agents (OpenAI Agents SDK, netlify/functions/sdr-agent.ts).
 * Consumes the server-sent event stream: text deltas, tool calls, handoffs, approval requests, final output.
 */
import { authHeader, AIGatewayError } from './aiClient';

export type SdrEvent =
  | { type: 'agent'; name: string }
  | { type: 'delta'; delta: string }
  | { type: 'tool_called'; name: string }
  | { type: 'tool_output'; name: string }
  | { type: 'handoff'; from?: string; to?: string }
  | { type: 'approval_required'; state: string; approvals: SdrApproval[] }
  | { type: 'final'; agent?: string; output: SdrOutput | string | null }
  | { type: 'error'; error: string; blocked?: boolean };

export interface SdrApproval {
  callId: string;
  tool: string;
  arguments: any;
}

export interface SdrOutput {
  strategy: string;
  outreach: { channel: 'email' | 'linkedin' | 'whatsapp'; subject: string | null; body: string; call_to_action: string };
  key_points: string[];
  crm_updates: Array<{ field: string; value: string }>;
  confidence: number;
}

export interface SdrRunRequest {
  /** 'auto' lets the orchestrator hand off to the best specialist. */
  agentId?: string;
  leadId: string;
  goal?: string;
  message?: string;
  resume?: { state: string; decisions: Array<{ callId: string; approve: boolean }> };
  signal?: AbortSignal;
}

export const SDR_RUN_URL = '/api/sdr/run';

/** Runs an SDR agent, streaming events to `onEvent`; resolves with the terminal event (final | approval_required | error). */
export async function runSdrAgent(
  req: SdrRunRequest,
  onEvent?: (e: SdrEvent) => void,
): Promise<SdrEvent> {
  const { signal, ...body } = req;
  const res = await fetch(SDR_RUN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });

  if (!res.ok || !res.body) {
    const j: any = await res.json().catch(() => ({}));
    throw new AIGatewayError(j.error || res.statusText, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let terminal: SdrEvent | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const line = frame.replace(/^data:\s*/, '').trim();
      if (!line || line === '[DONE]') continue;
      try {
        const ev = JSON.parse(line) as SdrEvent;
        onEvent?.(ev);
        if (ev.type === 'final' || ev.type === 'approval_required' || ev.type === 'error') terminal = ev;
      } catch {
        /* ignore malformed frame */
      }
    }
  }
  return terminal ?? { type: 'error', error: 'Stream ended without a result' };
}

/** Approve/reject pending tool calls (e.g. send_sdr_message) and resume the paused run. */
export function resumeSdrRun(
  base: Pick<SdrRunRequest, 'agentId' | 'leadId'>,
  state: string,
  decisions: Array<{ callId: string; approve: boolean }>,
  onEvent?: (e: SdrEvent) => void,
) {
  return runSdrAgent({ ...base, resume: { state, decisions } }, onEvent);
}
