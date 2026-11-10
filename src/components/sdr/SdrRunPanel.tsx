import React, { useEffect, useRef, useState } from 'react';
import { useContactStore } from '../../store/contactStore';
import {
  runSdrAgent,
  resumeSdrRun,
  SdrApproval,
  SdrEvent,
  SdrOutput,
} from '../../services/sdrAgentClient';

export const SDR_RUN_AGENTS: Array<{ id: string; label: string }> = [
  { id: 'auto', label: 'Auto (orchestrator picks a specialist)' },
  { id: 'sdr-cold-email', label: 'Cold email' },
  { id: 'sdr-follow-up', label: 'Follow-up' },
  { id: 'sdr-bump-message', label: 'Bump message' },
  { id: 'sdr-objection-handling', label: 'Objection handling' },
  { id: 'sdr-linkedin', label: 'LinkedIn' },
  { id: 'sdr-whatsapp', label: 'WhatsApp' },
  { id: 'sdr-winback', label: 'Win-back' },
  { id: 'sdr-reactivation', label: 'Reactivation' },
  { id: 'sdr-competitor-aware', label: 'Competitor-aware' },
  { id: 'sdr-high-intent', label: 'High intent' },
  { id: 'sdr-event-based', label: 'Event-based' },
  { id: 'sdr-referral', label: 'Referral' },
  { id: 'sdr-newsletter-lead-in', label: 'Newsletter lead-in' },
  { id: 'sdr-data-enrichment', label: 'Data enrichment' },
];

type LogEntry = { id: number; kind: 'agent' | 'handoff' | 'tool' | 'tool_output' | 'info'; text: string };

interface Pending { state: string; approvals: SdrApproval[] }

export const SdrRunPanel: React.FC = () => {
  const contacts = useContactStore(s => s.contacts);
  const fetchContacts = useContactStore(s => s.fetchContacts);

  const [leadId, setLeadId] = useState('');
  const [agentId, setAgentId] = useState('auto');
  const [goal, setGoal] = useState('');
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [text, setText] = useState('');
  const [output, setOutput] = useState<SdrOutput | string | null>(null);
  const [finalAgent, setFinalAgent] = useState<string | undefined>();
  const [error, setError] = useState<{ message: string; blocked: boolean } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (useContactStore.getState().contacts.length === 0) void fetchContacts();
    return () => abortRef.current?.abort();
  }, [fetchContacts]);

  const push = (kind: LogEntry['kind'], t: string) =>
    setLog(l => [...l, { id: ++seq.current, kind, text: t }]);

  const onEvent = (e: SdrEvent) => {
    switch (e.type) {
      case 'agent': push('agent', `Agent: ${e.name}`); break;
      case 'handoff': push('handoff', `Handoff: ${e.from ?? '?'} -> ${e.to ?? '?'}`); break;
      case 'tool_called': push('tool', `Tool called: ${e.name}`); break;
      case 'tool_output': push('tool_output', `Tool finished: ${e.name}`); break;
      case 'delta': setText(t => t + e.delta); break;
      default: break;
    }
  };

  const handleTerminal = (ev: SdrEvent) => {
    if (ev.type === 'final') {
      setOutput(ev.output);
      setFinalAgent(ev.agent);
      setPending(null);
    } else if (ev.type === 'approval_required') {
      setPending({ state: ev.state, approvals: ev.approvals });
      setDecisions(Object.fromEntries(ev.approvals.map(a => [a.callId, false])));
    } else if (ev.type === 'error') {
      setError({ message: ev.error, blocked: !!ev.blocked });
    }
  };

  const execute = async (fn: (signal: AbortSignal) => Promise<SdrEvent>) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    try {
      handleTerminal(await fn(ctrl.signal));
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setError({ message: err instanceof Error ? err.message : String(err), blocked: false });
      }
    } finally {
      setRunning(false);
    }
  };

  const start = () => {
    setLog([]); setText(''); setOutput(null); setError(null); setPending(null); setFinalAgent(undefined);
    void execute(signal => runSdrAgent({ agentId, leadId, goal: goal || undefined, signal }, onEvent));
  };

  const resume = () => {
    if (!pending) return;
    const { state, approvals } = pending;
    setError(null);
    push('info', `Resuming with ${approvals.filter(a => decisions[a.callId]).length} approved / ${approvals.filter(a => !decisions[a.callId]).length} rejected`);
    setPending(null);
    void execute(() =>
      resumeSdrRun(
        { agentId, leadId },
        state,
        approvals.map(a => ({ callId: a.callId, approve: !!decisions[a.callId] })),
        onEvent,
      ),
    );
  };

  const structured = output && typeof output === 'object' ? output : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm">
          <span className="block font-medium mb-1">Lead</span>
          <select
            aria-label="Lead"
            value={leadId}
            onChange={e => setLeadId(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
          >
            <option value="">Select a contact</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block font-medium mb-1">Agent</span>
          <select
            aria-label="Agent"
            value={agentId}
            onChange={e => setAgentId(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
          >
            {SDR_RUN_AGENTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="block font-medium mb-1">Goal</span>
          <input
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="e.g. Book a discovery call"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button
          onClick={start}
          disabled={!leadId || running}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
        >
          {running ? 'Running...' : 'Run agent'}
        </button>
        {running && (
          <button onClick={() => abortRef.current?.abort()} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600">
            Stop
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className={`p-4 rounded-lg border ${error.blocked
            ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200'
            : 'bg-red-50 border-red-300 text-red-800 dark:bg-red-900/20 dark:text-red-200'}`}
        >
          <strong>{error.blocked ? 'Blocked by guardrail: ' : 'Error: '}</strong>
          {error.message}
        </div>
      )}

      {pending && (
        <div className="p-4 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 space-y-3">
          <h3 className="font-semibold">Approval required</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">The agent wants to run these actions. Approve or reject each one.</p>
          {pending.approvals.map(a => (
            <div key={a.callId} className="p-3 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between gap-3">
                <code className="font-medium">{a.tool}</code>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDecisions(d => ({ ...d, [a.callId]: true }))}
                    aria-pressed={decisions[a.callId] === true}
                    className={`px-3 py-1 rounded text-sm border ${decisions[a.callId] ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 dark:border-gray-600'}`}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setDecisions(d => ({ ...d, [a.callId]: false }))}
                    aria-pressed={decisions[a.callId] === false}
                    className={`px-3 py-1 rounded text-sm border ${decisions[a.callId] === false ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 dark:border-gray-600'}`}
                  >
                    Reject
                  </button>
                </div>
              </div>
              <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">{typeof a.arguments === 'string' ? a.arguments : JSON.stringify(a.arguments, null, 2)}</pre>
            </div>
          ))}
          <button onClick={resume} disabled={running} className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50">
            Submit decisions and resume
          </button>
        </div>
      )}

      {(log.length > 0 || text) && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <h3 className="font-semibold mb-2">Activity</h3>
            <ul className="space-y-1 text-sm">
              {log.map(l => <li key={l.id}>{l.text}</li>)}
            </ul>
          </div>
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <h3 className="font-semibold mb-2">Live output</h3>
            <pre className="text-sm whitespace-pre-wrap">{text}</pre>
          </div>
        </div>
      )}

      {output && (
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-4">
          <h3 className="font-semibold">Draft{finalAgent ? ` (${finalAgent})` : ''}</h3>
          {structured ? (
            <DraftView draft={structured as SdrOutput} />
          ) : (
            <pre className="whitespace-pre-wrap text-sm">{String(output)}</pre>
          )}
        </div>
      )}
    </div>
  );
};

const DraftView: React.FC<{ draft: SdrOutput }> = ({ draft }) => (
  <div className="space-y-4 text-sm">
    <section>
      <h4 className="font-medium">Strategy</h4>
      <p>{draft.strategy}</p>
    </section>
    <section>
      <h4 className="font-medium">Outreach ({draft.outreach?.channel})</h4>
      {draft.outreach?.subject && <p><strong>Subject:</strong> {draft.outreach.subject}</p>}
      <pre className="whitespace-pre-wrap font-sans mt-1 p-3 rounded bg-gray-50 dark:bg-gray-900">{draft.outreach?.body}</pre>
      {draft.outreach?.call_to_action && <p className="mt-1"><strong>Call to action:</strong> {draft.outreach.call_to_action}</p>}
    </section>
    {draft.key_points?.length > 0 && (
      <section>
        <h4 className="font-medium">Key points</h4>
        <ul className="list-disc pl-5">{draft.key_points.map((k, i) => <li key={i}>{k}</li>)}</ul>
      </section>
    )}
    {draft.crm_updates?.length > 0 && (
      <section>
        <h4 className="font-medium">CRM updates</h4>
        <ul className="list-disc pl-5">{draft.crm_updates.map((u, i) => <li key={i}><code>{u.field}</code>: {u.value}</li>)}</ul>
      </section>
    )}
    <p className="text-gray-500">Confidence: {Math.round((draft.confidence ?? 0) * (draft.confidence <= 1 ? 100 : 1))}%</p>
  </div>
);

export default SdrRunPanel;
