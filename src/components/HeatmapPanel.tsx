import React, { useState } from "react";

interface HeatmapResponse {
  dealId?: string;
  risk_score?: number;
  reason?: string;
  factors?: any;
}

export const HeatmapPanel: React.FC = () => {
  const [dealId, setDealId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HeatmapResponse | null>(null);

  const computeRisk = async () => {
    setError(null);
    setResult(null);

    if (!dealId) {
      setError("Please enter a deal ID.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/.netlify/functions/deal-heatmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Heatmap request failed");
      }

      const json = (await res.json()) as HeatmapResponse;
      setResult(json);
    } catch (e: any) {
      console.error("[HeatmapPanel] error:", e);
      setError(e.message || "Failed to compute deal risk");
    } finally {
      setLoading(false);
    }
  };

  const riskColor = (score?: number) => {
    if (score == null) return "#a0aec0";
    if (score < 30) return "#38a169"; // green
    if (score < 60) return "#dd6b20"; // orange
    return "#e53e3e"; // red
  };

  return (
    <div
      style={{
        borderRadius: 12,
        padding: 16,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        marginTop: 24
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 6 }}>🔥 Deal Heatmap & Risk Engine</h2>
      <p style={{ marginTop: 0, marginBottom: 12, fontSize: 13, color: "#4a5568" }}>
        Compute AI-based risk for any deal using reply frequency, sentiment, stage duration,
        objections, and more.
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

      <div style={{ maxWidth: 360, marginBottom: 10 }}>
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 4
          }}
        >
          Deal ID
        </label>
        <input
          value={dealId}
          onChange={(e) => setDealId(e.target.value)}
          placeholder="Enter deal UUID"
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e0",
            fontSize: 13
          }}
        />
      </div>

      <button
        type="button"
        onClick={computeRisk}
        disabled={loading}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "none",
          background: loading ? "#a0aec0" : "#e53e3e",
          color: "#ffffff",
          fontWeight: 600,
          fontSize: 13,
          cursor: loading ? "default" : "pointer",
          marginBottom: 12
        }}
      >
        {loading ? "Analyzing Deal..." : "Compute Deal Risk"}
      </button>

      {result && (
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap"
          }}
        >
          <div
            style={{
              flex: "0 0 220px",
              borderRadius: 10,
              padding: 12,
              border: "1px solid #e2e8f0",
              background: "#f7fafc"
            }}
          >
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "#718096",
                marginBottom: 4
              }}
            >
              Risk Score
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "999px",
                  background: riskColor(result.risk_score)
                }}
              />
              <span style={{ fontSize: 18, fontWeight: 700 }}>
                {result.risk_score ?? "—"}/100
              </span>
            </div>
            {result.reason && (
              <p
                style={{
                  marginTop: 8,
                  marginBottom: 0,
                  fontSize: 12,
                  color: "#4a5568"
                }}
              >
                {result.reason}
              </p>
            )}
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: 10,
              padding: 10,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              maxHeight: 220,
              overflow: "auto"
            }}
          >
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "#718096",
                marginBottom: 4
              }}
            >
              Factors
            </div>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 12,
                margin: 0
              }}
            >
              {JSON.stringify(result.factors || {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};