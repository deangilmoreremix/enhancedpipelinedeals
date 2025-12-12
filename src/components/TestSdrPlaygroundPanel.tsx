import React, { useState } from "react";

export const TestSdrPlaygroundPanel: React.FC = () => {
  const [agentId, setAgentId] = useState("cold_email_sdr");
  const [personaId, setPersonaId] = useState("friendly");
  const [sequenceLength, setSequenceLength] = useState(10);
  const [step, setStep] = useState(1);

  const [name, setName] = useState("John Smith");
  const [email, setEmail] = useState("john@example.com");
  const [company, setCompany] = useState("Example Corp");
  const [prompt, setPrompt] = useState(
    "Write a short cold email inviting them to see a quick demo of SmartCRM."
  );

  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setOutput(null);
    setError(null);

    try {
      const res = await fetch("/.netlify/functions/test-sdr-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          personaId,
          sequenceLength: Number(sequenceLength),
          step: Number(step),
          contact: { name, email, company },
          prompt,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to run SDR agent");
      }

      setOutput(json.output || JSON.stringify(json.raw, null, 2));
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4">
      <div className="md:w-1/3 space-y-3 border rounded-xl p-4 bg-white/70">
        <h2 className="font-semibold text-lg">SDR Playground</h2>

        <div className="space-y-1">
          <label className="block text-sm font-medium">Agent ID</label>
          <input
            className="w-full border rounded-md px-2 py-1 text-sm"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">Persona ID</label>
          <input
            className="w-full border rounded-md px-2 py-1 text-sm"
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label className="block text-sm font-medium">Sequence Length</label>
            <input
              type="number"
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={sequenceLength}
              onChange={(e) => setSequenceLength(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="block text-sm font-medium">Step</label>
            <input
              type="number"
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={step}
              onChange={(e) => setStep(Number(e.target.value) || 1)}
            />
          </div>
        </div>

        <hr className="my-3" />

        <div className="space-y-1">
          <label className="block text-sm font-medium">Contact Name</label>
          <input
            className="w-full border rounded-md px-2 py-1 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">Contact Email</label>
          <input
            className="w-full border rounded-md px-2 py-1 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">Company</label>
          <input
            className="w-full border rounded-md px-2 py-1 text-sm"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">Prompt (optional)</label>
          <textarea
            className="w-full border rounded-md px-2 py-1 text-sm h-20"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <button
          onClick={handleRun}
          disabled={loading}
          className="w-full mt-2 rounded-md border px-3 py-2 text-sm font-semibold bg-black text-white disabled:opacity-60"
        >
          {loading ? "Running SDR Agent..." : "Run SDR Agent"}
        </button>
      </div>

      <div className="md:w-2/3 border rounded-xl p-4 bg-gray-50 whitespace-pre-wrap text-sm overflow-auto">
        <h3 className="font-semibold mb-2">Output</h3>
        {error && <div className="text-red-600 mb-2">Error: {error}</div>}
        {output ? (
          <pre className="text-xs">{output}</pre>
        ) : (
          <p className="text-gray-500 text-sm">
            Run the SDR agent to see generated email content and tool calls here.
          </p>
        )}
      </div>
    </div>
  );
};