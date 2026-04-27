import React, { useState } from 'react';
import { SDRAgentConfigurator } from './SDRAgentConfigurator';
import { SDRAgentCard } from './SDRAgentCard';
import { SDRFilterPanel } from './SDRFilterPanel';
import { SDRResultsViewer } from './SDRResultsViewer';
import { SDRAnalyticsDashboard } from './SDRAnalyticsDashboard';
import { useSDRAgents } from './useSDRAgents';
import { SDR_AGENTS } from './sdrAgentsConfig';
import { Play, Users, BarChart3 } from 'lucide-react';

export const SDRAgentsHub: React.FC = () => {
  const {
    selectedAgentId,
    setSelectedAgentId,
    contactId,
    setContactId,
    dealId,
    setDealId,
    running,
    error,
    response,
    resultHistory,
    filters,
    setFilters,
    runAgent,
    runBatchOperation,
    toggleFavorite,
    getFilteredAgents,
    clearResults,
    clearHistory,
    analytics,
    getAnalytics,
    getTopAgents,
    getAgentsBySuccessRate
  } = useSDRAgents();

  const [configuringAgent, setConfiguringAgent] = useState<{ id: string; name: string; config?: Record<string, unknown> } | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedBatchAgents, setSelectedBatchAgents] = useState<string[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const filteredAgents = getFilteredAgents();
  const selectedAgent = filteredAgents.find(a => a.id === selectedAgentId);
  const categories = [...new Set(filteredAgents.map(a => a.category))].sort();

  const handleConfigureAgent = async (agentId: string) => {
    const agent = filteredAgents.find(a => a.id === agentId);
    if (!agent) return;

    setConfiguringAgent({
      id: agentId,
      name: agent.label,
      config: undefined // Could load from preferences service
    });
  };

  const handleSaveConfiguration = async (preferences: Record<string, unknown>) => {
    if (!configuringAgent) return;

    await sdrPreferencesService.saveUserPreferences('user-1', configuringAgent.id, preferences);
    setConfiguringAgent(null);
  };

  const handleRun = async () => {
    if (!contactId) {
      return; // Error already handled in hook
    }

    try {
      await runAgent(selectedAgentId, contactId, dealId || undefined);
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleBatchRun = async () => {
    if (!contactId || selectedBatchAgents.length === 0) {
      return;
    }

    try {
      await runBatchOperation(selectedBatchAgents, contactId, dealId || undefined);
      setBatchMode(false);
      setSelectedBatchAgents([]);
    } catch (error) {
      // Error handled in hook
    }
  };

  const toggleBatchSelection = (agentId: string) => {
    setSelectedBatchAgents(prev =>
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  const filteredAgentsWithAgent = filteredAgents.map(agent => ({
    ...agent,
    agent: SDR_AGENTS.find(a => a.id === agent.id)?.agent
  }));

  if (showAnalytics) {
    return (
      <SDRAnalyticsDashboard
        analytics={analytics}
        getAnalytics={getAnalytics}
        getTopAgents={getTopAgents}
        getAgentsBySuccessRate={getAgentsBySuccessRate}
        onClose={() => setShowAnalytics(false)}
      />
    );
  }

  return (
    <div
      style={{
        borderRadius: 12,
        padding: 20,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        marginTop: 24
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>📡 SDR Agents Hub</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setBatchMode(!batchMode)}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: batchMode ? '#f3f4f6' : '#ffffff',
              color: '#6b7280',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Users size={14} />
            Batch Mode
          </button>
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: showAnalytics ? '#f3f4f6' : '#ffffff',
              color: '#6b7280',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <BarChart3 size={14} />
            Analytics
          </button>
        </div>
      </div>

      <p style={{ marginTop: 0, marginBottom: 20, fontSize: 14, color: "#4a5568" }}>
        Run any of your 14 SDR agents against a contact and (optionally) a deal. Perfect
        for wiring these into SmartCRM features or testing flows. {batchMode && 'Select multiple agents for batch execution.'}
      </p>

      {/* Filter Panel */}
      <SDRFilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        categories={categories}
      />

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {/* Agent Grid */}
        <div style={{ flex: "2 1 500px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
              marginBottom: 20
            }}
          >
            {filteredAgentsWithAgent.map((agent) => (
              <div key={agent.id} style={{ position: 'relative' }}>
                <SDRAgentCard
                  agent={agent}
                  isSelected={!batchMode && agent.id === selectedAgentId}
                  onSelect={batchMode ? toggleBatchSelection : setSelectedAgentId}
                  onConfigure={handleConfigureAgent}
                  onToggleFavorite={toggleFavorite}
                />
                {batchMode && selectedBatchAgents.includes(agent.id) && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredAgentsWithAgent.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: 40,
                color: '#9ca3af',
                fontSize: 16
              }}
            >
              No agents match your current filters.
            </div>
          )}
        </div>

        {/* Control Panel */}
        <div style={{ flex: "1 1 300px" }}>
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              padding: 16,
              background: "#f8fafc",
              position: 'sticky',
              top: 20
            }}
          >
            {!batchMode ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#1a202c' }}>
                  Single Agent Execution
                </div>

                {selectedAgent && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      Selected Agent
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: '#1a202c' }}>
                      {selectedAgent.label}
                    </div>
                    <div style={{ fontSize: 13, color: '#4a5568', marginBottom: 8 }}>
                      {selectedAgent.short}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#1a202c' }}>
                  Batch Execution
                </div>
                <div style={{ fontSize: 13, color: '#4a5568', marginBottom: 16 }}>
                  {selectedBatchAgents.length} agent{selectedBatchAgents.length !== 1 ? 's' : ''} selected
                </div>
              </>
            )}

            {/* Input Fields */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
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

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
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

            {/* Execute Button */}
            <button
              type="button"
              onClick={batchMode ? handleBatchRun : handleRun}
              disabled={running || (!batchMode && !selectedAgent) || (batchMode && selectedBatchAgents.length === 0) || !contactId}
              style={{
                marginTop: 6,
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                background: running || !contactId ? "#a0aec0" : "#2b6cb0",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: 14,
                cursor: running || !contactId ? "default" : "pointer",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <Play size={16} />
              {running ? "Running…" : batchMode ? `Run ${selectedBatchAgents.length} Agents` : "Run Agent"}
            </button>

            {batchMode && selectedBatchAgents.length > 0 && (
              <button
                onClick={() => setSelectedBatchAgents([])}
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#6b7280",
                  fontSize: 12,
                  cursor: "pointer"
                }}
              >
                Clear Selection
              </button>
            )}

            {error && (
              <div
                style={{
                  marginTop: 12,
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
      </div>

      {/* Results Viewer */}
      <div style={{ marginTop: 20 }}>
        <SDRResultsViewer
          response={response}
          resultHistory={resultHistory}
          error={error}
          onClearResults={clearResults}
          onClearHistory={clearHistory}
          selectedAgent={selectedAgent}
        />
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

export default SDRAgentsHub;
