import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { runSdrAgent, resumeSdrRun, SdrApproval, SdrEvent, SdrOutput } from '../../services/sdrAgentClient';
import { DraftView } from '../sdr/SdrRunPanel';
import { BTN, BTN_ICON, BTN_PRIMARY } from '../ui/buttonStyles';

export interface SdrRunRequest {
  /** Changes on every run so the same agent can be run twice. */
  nonce: number;
  agentId: string;
  agentLabel: string;
  leadId: string;
  goal?: string;
}

interface Props {
  request: SdrRunRequest | null;
  onClose: () => void;
  /** Reports whether a run is in flight (disables the SDR buttons). */
  onRunningChange?: (running: boolean) => void;
}

interface Pending { state: string; approvals: SdrApproval[] }

/**
 * Runs one SDR agent through the server stream (sdrAgentClient) and shows the result.
 * Tool calls that need approval pause the run: the signed opaque `state` is sent back unchanged with the decisions.
 */
export const SDRResultsModal: React.FC<Props> = ({ request, onClose, onRunningChange }) => {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [output, setOutput] = useState<SdrOutput | string | null>(null);
  const [finalAgent, setFinalAgent] = useState<string | undefined>();
  const [error, setError] = useState<{ message: string; blocked: boolean } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);

  const setBusy = (v: boolean) => { setRunning(v); onRunningChange?.(v); };

  const onEvent = (e: SdrEvent) => {
    switch (e.type) {
      case 'agent': setLog(l => [...l, `Agent: ${e.name}`]); break;
      case 'handoff': setLog(l => [...l, `Handoff: ${e.from ?? '?'} -> ${e.to ?? '?'}`]); break;
      case 'tool_called': setLog(l => [...l, `Tool called: ${e.name}`]); break;
      case 'tool_output': setLog(l => [...l, `Tool finished: ${e.name}`]); break;
      case 'delta': setText(t => t + e.delta); break;
      default: break;
    }
  };

  const settle = (ev: SdrEvent) => {
    if (ev.type === 'final') {
      setOutput(ev.output); setFinalAgent(ev.agent); setPending(null);
    } else if (ev.type === 'approval_required') {
      setPending({ state: ev.state, approvals: ev.approvals });
      setDecisions(Object.fromEntries(ev.approvals.map(a => [a.callId, false])));
    } else if (ev.type === 'error') {
      setError({ message: ev.error, blocked: !!ev.blocked });
    }
  };

  const execute = async (fn: (signal: AbortSignal) => Promise<SdrEvent>) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    try {
      const ev = await fn(ctrl.signal);
      if (!ctrl.signal.aborted) settle(ev);
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError' && !ctrl.signal.aborted) {
        setError({ message: err instanceof Error ? err.message : String(err), blocked: false });
      }
    } finally {
      if (abortRef.current === ctrl) setBusy(false);
    }
  };

  // Start a run whenever a new request arrives
  useEffect(() => {
    if (!request) return undefined;
    setLog([]); setText(''); setOutput(null); setError(null); setPending(null); setFinalAgent(undefined);
    void execute(signal => runSdrAgent({ agentId: request.agentId, leadId: request.leadId, goal: request.goal, signal }, onEvent));
    return () => { abortRef.current?.abort(); abortRef.current = null; onRunningChange?.(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce]);

  useEffect(() => {
    if (!request) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [request, onClose]);

  if (!request) return null;

  const resume = () => {
    if (!pending) return;
    const { state, approvals } = pending;
    const approved = approvals.filter(a => decisions[a.callId]).length;
    setError(null);
    setLog(l => [...l, `Resuming with ${approved} approved / ${approvals.length - approved} rejected`]);
    setPending(null);
    // `state` is the signed opaque value from the server: sent back exactly as received.
    void execute(() =>
      resumeSdrRun(
        { agentId: request.agentId, leadId: request.leadId },
        state,
        approvals.map(a => ({ callId: a.callId, approve: !!decisions[a.callId] })),
        onEvent,
      ),
    );
  };

  const structured = output && typeof output === 'object' ? output : null;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`${request.agentLabel} results`} className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{request.agentLabel}</h2>
          <button type="button" aria-label="Close SDR results" onClick={onClose} className={BTN_ICON}><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm text-gray-800 dark:text-gray-200">
          {running && <p role="status" className="text-gray-600 dark:text-gray-300">Running {request.agentLabel}...</p>}

          {error && (
            <div role="alert" className={`rounded-lg border p-3 ${error.blocked ? 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200' : 'border-red-300 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200'}`}>
              <strong>{error.blocked ? 'Blocked by guardrail: ' : 'Error: '}</strong>{error.message}
            </div>
          )}

          {pending && (
            <section aria-label="Approval required" className="space-y-3 rounded-lg border border-blue-300 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/20">
              <h3 className="font-semibold">Approval required</h3>
              <p>The agent wants to run these actions. Approve or reject each one.</p>
              {pending.approvals.map(a => (
                <div key={a.callId} className="rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center justify-between gap-3">
                    <code className="font-medium">{a.tool}</code>
                    <div className="flex gap-2">
                      <button type="button" aria-pressed={decisions[a.callId] === true} onClick={() => setDecisions(d => ({ ...d, [a.callId]: true }))} className={`${BTN} ${decisions[a.callId] ? '!border-green-600 !bg-green-600 !text-white' : ''}`}>Approve</button>
                      <button type="button" aria-pressed={decisions[a.callId] === false} onClick={() => setDecisions(d => ({ ...d, [a.callId]: false }))} className={`${BTN} ${decisions[a.callId] === false ? '!border-red-600 !bg-red-600 !text-white' : ''}`}>Reject</button>
                    </div>
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{typeof a.arguments === 'string' ? a.arguments : JSON.stringify(a.arguments, null, 2)}</pre>
                </div>
              ))}
              <button type="button" onClick={resume} disabled={running} className={BTN_PRIMARY}>Submit decisions and resume</button>
            </section>
          )}

          {(log.length > 0 || text) && !output && (
            <section aria-label="Activity" className="grid gap-3 md:grid-cols-2">
              <ul className="space-y-1 rounded-lg border border-gray-200 p-3 dark:border-gray-700">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
              <pre className="whitespace-pre-wrap rounded-lg border border-gray-200 p-3 font-sans dark:border-gray-700">{text}</pre>
            </section>
          )}

          {output && (
            <section aria-label="Draft" className="space-y-3">
              <h3 className="font-semibold">Draft{finalAgent ? ` (${finalAgent})` : ''}</h3>
              {structured ? <DraftView draft={structured as SdrOutput} /> : <pre className="whitespace-pre-wrap">{String(output)}</pre>}
            </section>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
          {running && <button type="button" onClick={() => abortRef.current?.abort()} className={BTN}>Stop</button>}
          <button type="button" onClick={onClose} className={BTN}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default SDRResultsModal;
