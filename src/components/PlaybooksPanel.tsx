import React, { useState } from "react";

interface PlaybooksResponse {
  dealId?: string;
  contactId?: string;
  top_scripts?: any[];
  objections?: any[];
  followups?: any[];
  summary?: string;
  raw?: any;
}

export const PlaybooksPanel: React.FC = () => {
  const [contactId, setContactId] = useState("");
  const [dealId, setDealId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlaybooksResponse | null>(null);

  const generatePlaybooks = async () => {
    setError(null);
    setData(null);

    if (!contactId && !dealId) {
      setError("Enter at least a contact ID or deal ID.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/.netlify/functions/playbooks-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contactId || undefined,
          dealId: dealId || undefined
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Playbooks AI request failed");
      }

      const json = (await res.json()) as PlaybooksResponse;
      setData(json);
    } catch (e: any) {
      console.error("[PlaybooksPanel] error:", e);
      setError(e.message || "Failed to generate playbooks");
    } finally {
      setLoading(false);
    }
  };

  const renderList = (title: string, items?: any[]) => {
    if (!items || items.length === 0) return null;
    return (
      <div
        style={{
          marginBottom: 12,
          padding: 8,
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          background: "#ffffff"
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
          {title}
        </div>
        <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13 }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ marginBottom: 4 }}>
              {typeof item === "string" ? (
                item
              ) : (
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 12,
                    margin: 0
                  }}
                >
                  {JSON.stringify(item, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
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
      <h2 style={{ marginTop: 0, marginBottom: 6 }}>📘 Playbooks AI</h2>
      <p style={{ marginTop: 0, marginBottom: 12, fontSize: 13, color: "#4a5568" }}>
        Generate AI sales playbooks for this contact / deal – best scripts, objection
        responses, follow-up patterns, and "why deals are won" insights.
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

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 12
        }}
      >
        <div style={{ flex: "0 0 260px" }}>
          <div style={{ marginBottom: 8 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 4
              }}
            >
              Contact ID (optional)
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
              Deal ID (optional)
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
            onClick={generatePlaybooks}
            disabled={loading}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              background: loading ? "#a0aec0" : "#2f855a",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 13,
              cursor: loading ? "default" : "pointer"
            }}
          >
            {loading ? "Generating Playbooks..." : "Generate Playbooks"}
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            background: "#f7fafc",
            padding: 10,
            maxHeight: 260,
            overflow: "auto"
          }}
        >
          {!data ? (
            <div style={{ fontSize: 13, color: "#a0aec0" }}>
              Run Playbooks AI to see scripts, objections, and follow-up patterns here.
            </div>
          ) : (
            <>
              {data.summary && (
                <div
                  style={{
                    marginBottom: 10,
                    padding: 8,
                    borderRadius: 8,
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    fontSize: 13,
                    color: "#4a5568"
                  }}
                >
                  {data.summary}
                </div>
              )}

              {renderList("Top Scripts", data.top_scripts)}
              {renderList("Top Objections & Responses", data.objections)}
              {renderList("Follow-Up Patterns", data.followups)}
            </>
          )}
        </div>
      </div>
    </div>
  );
};