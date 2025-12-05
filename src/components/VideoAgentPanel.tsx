import React, { useState } from "react";

interface VideoAgentResponse {
  contactId?: string;
  storyboard?: any;
  script?: string;
  videoUrl?: string;
  debug?: any;
}

export const VideoAgentPanel: React.FC = () => {
  const [contactId, setContactId] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [goal, setGoal] = useState("demo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VideoAgentResponse | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setResult(null);

    if (!contactId) {
      setError("Please enter a contact ID.");
      return;
    }
    if (!productUrl.trim()) {
      setError("Please enter the product or landing page URL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/.netlify/functions/video-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, productUrl, goal })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Video agent request failed");
      }

      const json = (await res.json()) as VideoAgentResponse;
      setResult(json);
    } catch (e: any) {
      console.error("[VideoAgentPanel] error:", e);
      setError(e.message || "Failed to run video agent");
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
        maxWidth: 520,
        flex: "1 1 340px"
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 6 }}>📹 Video Agent</h2>
      <p style={{ marginTop: 0, marginBottom: 12, fontSize: 13, color: "#4a5568" }}>
        Auto-generate Loom-style explainer videos and follow-up videos using your product page
        + AI script + Remotion back-end.
      </p>

      {error && (
        <div
          style={{
            marginBottom: 10,
            padding: "6px 8px",
            borderRadius: 8,
            background: "#fff5f5",
            color: "#c53030",
            fontSize: 12
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 4
          }}
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
            fontSize: 13
          }}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 4
          }}
        >
          Product / Page URL
        </label>
        <input
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
          placeholder="https://your-landing-page.com/offer"
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e0",
            fontSize: 13
          }}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 4
          }}
        >
          Video Goal
        </label>
        <select
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e0",
            fontSize: 13,
            background: "#f7fafc"
          }}
        >
          <option value="demo">Product Demo</option>
          <option value="followup">Sales Follow-Up</option>
          <option value="overview">High-Level Overview</option>
          <option value="onboarding">Onboarding / Walkthrough</option>
        </select>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "none",
          background: loading ? "#a0aec0" : "#805ad5",
          color: "#ffffff",
          fontWeight: 600,
          fontSize: 13,
          cursor: loading ? "default" : "pointer",
          marginBottom: 10
        }}
      >
        {loading ? "Generating Video Plan..." : "Generate Video"}
      </button>

      {result && (
        <div
          style={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            background: "#f7fafc",
            padding: 8
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "#718096",
              marginBottom: 4
            }}
          >
            Result
          </div>

          {result.videoUrl && (
            <div style={{ marginBottom: 8 }}>
              <video
                controls
                src={result.videoUrl}
                style={{ width: "100%", borderRadius: 8 }}
              />
            </div>
          )}

          {result.script && (
            <>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 4
                }}
              >
                Script
              </div>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  margin: 0
                }}
              >
                {result.script}
              </pre>
            </>
          )}

          {result.storyboard && (
            <>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  marginTop: 8,
                  marginBottom: 4
                }}
              >
                Storyboard
              </div>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  margin: 0
                }}
              >
                {JSON.stringify(result.storyboard, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
};