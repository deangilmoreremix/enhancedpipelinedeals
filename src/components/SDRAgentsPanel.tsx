import React, { useState } from "react";
import { SDR_AGENTS } from "./sdr/sdrAgentsConfig";
import { SDRAgentConfigurator } from "./sdr/SDRAgentConfigurator";
import { sdrPreferencesService } from "../services/sdrPreferencesService";
import { SDRUserPreferences } from "../types/sdr-config";
import { Settings } from "lucide-react";

interface SDRAgentMeta {
  id: string;
  label: string;
  short: string;
  category: string;
}

interface SDRRunResponse {
  agentId: string;
  contactId: string;
  dealId: string | null;
  result: any;
}


export const SDRAgentsPanel: React.FC = () => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    SDR_AGENTS[0]?.id ?? ""
  );
  const [contactId, setContactId] = useState("");
  const [dealId, setDealId] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SDRRunResponse | null>(null);
  const [configuringAgent, setConfiguringAgent] = useState<{ id: string; name: string; config?: SDRUserPreferences } | null>(null);

  const selectedAgent = SDR_AGENTS.find((a) => a.id === selectedAgentId) || SDR_AGENTS[0];

  const handleConfigureAgent = async (agentId: string) => {
    const agent = SDR_AGENTS.find(a => a.id === agentId);
    if (!agent) return;

    // Load existing user preferences
    const userPrefs = await sdrPreferencesService.getUserPreferences('user-1', agentId);

    setConfiguringAgent({
      id: agentId,
      name: agent.label,
      config: userPrefs || undefined
    });
  };

  const handleSaveConfiguration = async (preferences: any) => {
    if (!configuringAgent) return;

    await sdrPreferencesService.saveUserPreferences('user-1', configuringAgent.id, preferences);
    setConfiguringAgent(null);
  };

  const handleRun = async () => {
    setError(null);
    setResponse(null);

    if (!contactId) {
      setError("Please enter a Contact ID before running an agent.");
      return;
    }

    setRunning(true);
    try {
      const res = await fetch("/.netlify/functions/sdr-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgentId,
          contactId,
          dealId: dealId || undefined
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }

      const data = (await res.json()) as SDRRunResponse;
      setResponse(data);
    } catch (e: any) {
      console.error("SDR run error:", e);
      setError(e.message || "Failed to run SDR agent");
    } finally {
      setRunning(false);
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
      <h2 style={{ marginBottom: 4 }}>📡 SDR Agent Hub</h2>
      <p style={{ marginTop: 0, marginBottom: 16, fontSize: 14, color: "#4a5568" }}>
        Run any of your 14 SDR agents against a contact and (optionally) a deal. Perfect
        for wiring these into SmartCRM features or testing flows.
      </p>

      {/* Agent grid + input form */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 16
        }}
      >
        {/* Agent cards */}
        <div
          style={{
            flex: "2 1 420px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12
          }}
        >
          {SDRAgentsPanelCards({
            selectedAgentId,
            onSelect: setSelectedAgentId,
            onConfigure: handleConfigureAgent
          })}
        </div>

        {/* Input + Run section */}
        <div
          style={{
            flex: "1 1 260px",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            padding: 12,
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
            Selected Agent
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            {selectedAgent?.label}
          </div>
          <div style={{ fontSize: 12, color: "#4a5568", marginBottom: 12 }}>
            {selectedAgent?.short}
          </div>

          <div style={{ marginBottom: 8 }}>
            <label
              style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Contact ID
            </label>
            <input
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              placeholder="Paste contact UUID"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e0",
                fontSize: 14
              }}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label
              style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Deal ID (optional)
            </label>
            <input
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              placeholder="Paste deal UUID (optional)"
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
            disabled={running}
            style={{
              marginTop: 6,
              width: "100%",
              padding: "9px 14px",
              borderRadius: 8,
              border: "none",
              background: running ? "#a0aec0" : "#2b6cb0",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 13,
              cursor: running ? "default" : "pointer"
            }}
          >
            {running ? "Running Agent…" : "Run SDR Agent"}
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
        </div>
      </div>

      {/* Result viewer */}
      <div
        style={{
          marginTop: 4,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          padding: 10,
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
          Agent Output
        </div>
        {!response ? (
          <div style={{ fontSize: 13, color: "#a0aec0" }}>
            Run an agent to see the JSON result here. You can wire this into messaging,
            sequences, or the MCP later.
          </div>
        ) : (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: 12,
              background: "#edf2f7",
              padding: 8,
              borderRadius: 6,
              maxHeight: 260,
              overflow: "auto",
              margin: 0
            }}
          >
            {JSON.stringify(response, null, 2)}
          </pre>
        )}
      </div>

      {/* SDR Agent Configuration Modal */}
      {configuringAgent && (
        <SDRAgentConfigurator
          agentId={configuringAgent.id}
          agentName={configuringAgent.name}
          currentConfig={configuringAgent.config}
          onSave={handleSaveConfiguration}
          onClose={() => setConfiguringAgent(null)}
          isOpen={true}
        />
      )}
    </div>
  );
};

// Helper component to render the grid of SDR agent cards
interface SDRAgentsPanelCardsProps {
  selectedAgentId: string;
  onSelect: (id: string) => void;
  onConfigure: (id: string) => void;
}

function SDRAgentsPanelCards(props: SDRAgentsPanelCardsProps) {
  const { selectedAgentId, onSelect, onConfigure } = props;

  return (
    <>
      {SDR_AGENTS.map((agent) => {
        const isActive = agent.id === selectedAgentId;
        return (
          <div
            key={agent.id}
            style={{
              position: "relative",
              textAlign: "left",
              padding: 10,
              borderRadius: 10,
              border: isActive ? "2px solid #3182ce" : "1px solid #e2e8f0",
              background: isActive ? "#ebf8ff" : "#ffffff",
              boxShadow: isActive ? "0 0 0 1px rgba(49,130,206,0.2)" : "none"
            }}
          >
            {/* Settings button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConfigure(agent.id);
              }}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                padding: 4,
                borderRadius: 6,
                border: "none",
                background: "rgba(255,255,255,0.8)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title={`Configure ${agent.label}`}
            >
              <Settings size={14} color="#4a5568" />
            </button>

            {/* Main card content */}
            <button
              type="button"
              onClick={() => onSelect(agent.id)}
              style={{
                width: "100%",
                textAlign: "left",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0
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
                {agent.category}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 4
                }}
              >
                {agent.label}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#4a5568"
                }}
              >
                {agent.short}
              </div>
            </button>
          </div>
        );
      })}
    </>
  );
}