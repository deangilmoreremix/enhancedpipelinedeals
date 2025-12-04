import React, { useState } from "react";

interface AutopilotResponse {
  contactId: string;
  result: any;
}

export const AutopilotPanel: React.FC = () => {
  const [contactId, setContactId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AutopilotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setError(null);
    setResult(null);

    if (!contactId) {
      setError("Please enter a contact ID.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/.netlify/functions/autopilot-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }

      const data = (await res.json()) as AutopilotResponse;
      setResult(data);
    } catch (e: any) {
      console.error("Autopilot error:", e);
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        borderRadius: 12,
        padding: 16,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        maxWidth: 640
      }}
    >
      <h2 style={{ marginBottom: 8 }}>🤖 AI Autopilot</h2>
      <p style={{ marginTop: 0, marginBottom: 16, fontSize: 14, color: "#4a5568" }}>
        Let the AI decide the next action for this contact based on status, stage, and history.
      </p>

      <div style={{ marginBottom: 12 }}>
        <label
          style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}
        >
          Contact ID
        </label>
        <input
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          placeholder="Enter contact UUID"
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e0",
            fontSize: 14
          }}
        />
      </div>

      <button
        type="button"
        onClick={handleRun}
        disabled={loading}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          border: "none",
          background: loading ? "#a0aec0" : "#805ad5",
          color: "#ffffff",
          fontWeight: 600,
          fontSize: 14,
          cursor: loading ? "default" : "pointer",
          marginBottom: 12
        }}
      >
        {loading ? "Running Autopilot..." : "Run Autopilot"}
      </button>

      {error && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            borderRadius: 8,
            background: "#fff5f5",
            color: "#c53030",
            fontSize: 13
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#f7fafc",
            border: "1px solid #e2e8f0"
          }}
        >
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            ✅ Autopilot executed for contact{" "}
            <span style={{ fontFamily: "monospace" }}>{result.contactId}</span>
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: 12,
              background: "#edf2f7",
              padding: 8,
              borderRadius: 6,
              maxHeight: 220,
              overflow: "auto",
              margin: 0
            }}
          >
            {JSON.stringify(result.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};