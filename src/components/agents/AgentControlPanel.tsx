import React, { useState, useEffect, useCallback } from "react";
import { listAgents, listPersonas, saveAgentSettings, getAgentLogs } from "../../services/agentControlService";

interface AgentOption {
  id: string;
  name: string;
}

interface AgentLog {
  message: string;
}

type SkillSettings = {
  negotiation: boolean;
  objection: boolean;
  competitor: boolean;
  followup: boolean;
  research: boolean;
};

type ChannelSettings = {
  email: boolean;
  sms: boolean;
  voice: boolean;
  linkedin: boolean;
};

export const AgentControlPanel = () => {
  const [loading, setLoading] = useState(false);
  const [contactId, setContactId] = useState("");
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [personas, setPersonas] = useState<AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedPersona, setSelectedPersona] = useState("");
  const [sequenceLength, setSequenceLength] = useState("30");
  const [channels, setChannels] = useState<ChannelSettings>({
    email: true,
    sms: false,
    voice: false,
    linkedin: false,
  });
  const [skills, setSkills] = useState<SkillSettings>({
    negotiation: true,
    objection: true,
    competitor: true,
    followup: true,
    research: true,
  });
  const [quietHours, setQuietHours] = useState({
    start: "20:00",
    end: "08:00",
  });
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, setAgentsLoading] = useState(false);
  const [, setPersonasLoading] = useState(false);

  // Load data on mount with error handling
  useEffect(() => {
    loadAgents();
    loadPersonas();
  }, []);

  // Clear messages when contactId changes
  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [contactId]);

  const loadAgents = useCallback(async () => {
    setAgentsLoading(true);
    setError(null);
    try {
      setAgents(await listAgents());
    } catch (err) {
      console.error("Failed to load agents:", err);
      setError("Failed to load agents. Please try again.");
      setAgents([]);
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  const loadPersonas = useCallback(async () => {
    setPersonasLoading(true);
    setError(null);
    try {
      setPersonas(await listPersonas());
    } catch (err) {
      console.error("Failed to load personas:", err);
      setError("Failed to load personas. Please try again.");
      setPersonas([]);
    } finally {
      setPersonasLoading(false);
    }
  }, []);

  const saveSettings = async () => {
    setError(null);
    setSuccess(null);
    if (!contactId.trim()) {
      setError("Enter a contact ID before saving.");
      return;
    }
    setLoading(true);
    try {
      const { preferencesSaved } = await saveAgentSettings({
        contactId: contactId.trim(),
        autopilotEnabled,
        selectedAgent: agents.some((a) => a.id === selectedAgent) ? selectedAgent : undefined,
        selectedPersona: personas.some((p) => p.id === selectedPersona) ? selectedPersona : undefined,
        sequenceLength,
        channels,
        skills,
        quietHours,
      });
      setSuccess(preferencesSaved ? "Settings saved." : "Settings saved (channel / skill preferences could not be stored).");
    } catch (err: any) {
      console.error("Failed to save agent settings:", err);
      setError(`Failed to save settings: ${err?.message || "unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setError(null);
    try {
      setLogs(await getAgentLogs(contactId.trim()));
    } catch (err: any) {
      console.error("Failed to load agent logs:", err);
      setError(`Failed to load logs: ${err?.message || "unknown error"}`);
      setLogs([]);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-3xl font-bold">AI Agent Control Panel</h1>

      {error && <div role="alert" className="p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}
      {success && <div role="status" className="p-3 rounded bg-green-50 text-green-700 text-sm">{success}</div>}

      {/* Contact ID */}
      <div>
        <label className="font-semibold">Contact ID</label>
        <input
          className="border p-2 rounded w-full"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          placeholder="Enter a contact ID"
        />
      </div>

      {/* Autopilot */}
      <div className="flex items-center gap-4">
        <label className="font-semibold">Autopilot</label>
        <input
          type="checkbox"
          checked={autopilotEnabled}
          onChange={() => setAutopilotEnabled(!autopilotEnabled)}
        />
      </div>

      {/* Agent Selection */}
      <div>
        <label className="font-semibold">Select SDR Agent</label>
        <select
          className="border p-2 rounded w-full"
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
        >
          <option>Select Agent</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Persona Selection */}
      <div>
        <label className="font-semibold">Select Persona</label>
        <select
          className="border p-2 rounded w-full"
          value={selectedPersona}
          onChange={(e) => setSelectedPersona(e.target.value)}
        >
          <option>Select Persona</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Sequence */}
      <div>
        <label className="font-semibold">Sequence Length (Days)</label>
        <select
          className="border p-2 rounded w-full"
          value={sequenceLength}
          onChange={(e) => setSequenceLength(e.target.value)}
        >
          <option value="10">10 Days</option>
          <option value="20">20 Days</option>
          <option value="30">30 Days</option>
          <option value="45">45 Days</option>
        </select>
      </div>

      {/* Skills */}
      <div>
        <label className="font-semibold">AI Skills</label>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(skills) as (keyof SkillSettings)[]).map((skill) => (
            <label key={skill} className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={skills[skill]}
                onChange={() =>
                  setSkills({ ...skills, [skill]: !skills[skill] })
                }
              />
              {skill}
            </label>
          ))}
        </div>
      </div>

      {/* Channels */}
      <div>
        <label className="font-semibold">Communication Channels</label>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(channels) as (keyof ChannelSettings)[]).map((ch) => (
            <label key={ch} className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={channels[ch]}
                onChange={() =>
                  setChannels({ ...channels, [ch]: !channels[ch] })
                }
              />
              {ch.toUpperCase()}
            </label>
          ))}
        </div>
      </div>

      {/* Quiet Hours */}
      <div>
        <label className="font-semibold">Quiet Hours</label>
        <div className="flex gap-3">
          <input
            type="time"
            value={quietHours.start}
            className="border p-2 rounded"
            onChange={(e) =>
              setQuietHours({ ...quietHours, start: e.target.value })
            }
          />
          <input
            type="time"
            value={quietHours.end}
            className="border p-2 rounded"
            onChange={(e) =>
              setQuietHours({ ...quietHours, end: e.target.value })
            }
          />
        </div>
      </div>

      {/* Save Button */}
      <button
        className="bg-blue-600 text-white p-3 rounded"
        onClick={saveSettings}
        disabled={loading}
      >
        {loading ? "Saving..." : "Save Settings"}
      </button>

      {/* Logs */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold">Agent Logs</h2>
        <button
          className="bg-gray-800 text-white p-2 my-3 rounded"
          onClick={loadLogs}
        >
          Load Logs
        </button>

        <div className="bg-gray-100 p-4 rounded space-y-2 max-h-80 overflow-auto">
          {logs.map((l, idx) => (
            <div key={idx} className="p-2 bg-white rounded shadow">
              {l.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};