import React, { useState } from "react";

interface MoodResponse {
  contactId: string;
  mood: string;
  contact: any;
  deal: any;
}

export const MoodPanel: React.FC = () => {
  const [contactId, setContactId] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MoodResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMood = async () => {
    setError(null);
    setData(null);

    if (!contactId) {
      setError("Please enter a contact ID.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/.netlify/functions/mood-preview?contactId=${encodeURIComponent(contactId)}`
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }
      const json = (await res.json()) as MoodResponse;
      setData(json);
    } catch (e: any) {
      console.error("Mood preview error:", e);
      setError(e.message || "Failed to load mood");
    } finally {
      setLoading(false);
    }
  };

  const moodLabel = (mood?: string) => {
    switch (mood) {
      case "aggressive":
        return "🔥 Aggressive";
      case "friendly":
        return "🙂 Friendly";
      case "calm":
        return "🧊 Calm";
      case "precision":
        return "🎯 Precision";
      case "insight":
        return "🧠 Insight";
      case "urgent":
        return "⚡ Urgent";
      default:
        return mood || "unknown";
    }
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
      <h2 style={{ marginBottom: 8 }}>🎭 Mood Engine</h2>
      <p style={{ marginTop: 0, marginBottom: 16, fontSize: 14, color: "#4a5568" }}>
        See which mood the AI will use for messaging this contact based on risk and context.
      </p>

      <div style={{ marginBottom: 12, maxWidth: 360 }}>
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
        onClick={fetchMood}
        disabled={loading}
        style={{
          padding: "9px 14px",
          borderRadius: 8,
          border: "none",
          background: loading ? "#a0aec0" : "#dd6b20",
          color: "#ffffff",
          fontWeight: 600,
          fontSize: 13,
          cursor: loading ? "default" : "pointer",
          marginBottom: 12
        }}
      >
        {loading ? "Computing Mood..." : "Preview Mood"}
      </button>

      {error && (
        <div
          style={{
            marginBottom: 12,
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

      {data && (
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
              padding: 10,
              borderRadius: 8,
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
              Current Mood
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {moodLabel(data.mood)}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              padding: 8,
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
              Deal Context
            </div>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 12,
                margin: 0
              }}
            >
              {JSON.stringify({ contact: data.contact, deal: data.deal }, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};