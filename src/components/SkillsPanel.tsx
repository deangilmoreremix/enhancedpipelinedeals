import React, { useEffect, useState } from "react";

interface SkillMeta {
  id: string;
  description: string;
}

interface SkillsListResponse {
  skills: SkillMeta[];
}

interface SkillRunResponse {
  skillId: string;
  contactId: string;
  result: any;
}

export const SkillsPanel: React.FC = () => {
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [contactId, setContactId] = useState("");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SkillRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/.netlify/functions/skills-api");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }
      const data = (await res.json()) as SkillsListResponse;
      setSkills(data.skills || []);
      if (data.skills && data.skills.length > 0) {
        setSelectedSkill(data.skills[0].id);
      }
    } catch (e: any) {
      console.error("Skills list error:", e);
      setError(e.message || "Failed to load skills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const handleRun = async () => {
    setError(null);
    setResult(null);

    if (!contactId) {
      setError("Please enter a contact ID.");
      return;
    }
    if (!selectedSkill) {
      setError("Please select a skill.");
      return;
    }

    setRunning(true);
    try {
      const res = await fetch("/.netlify/functions/skills-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: selectedSkill, contactId })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }

      const data = (await res.json()) as SkillRunResponse;
      setResult(data);
    } catch (e: any) {
      console.error("Skills run error:", e);
      setError(e.message || "Failed to run skill");
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
        maxWidth: 640
      }}
    >
      <h2 style={{ marginBottom: 8 }}>🧠 Agent Skill Engine</h2>
      <p style={{ marginTop: 0, marginBottom: 16, fontSize: 14, color: "#4a5568" }}>
        Run individual skills (negotiation, objection handling, research, etc.) against any contact.
      </p>

      {loading ? (
        <div style={{ fontSize: 13 }}>Loading skills…</div>
      ) : skills.length === 0 ? (
        <div style={{ fontSize: 13 }}>No skills found in registry.</div>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <label
              style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Skill
            </label>
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e0",
                fontSize: 14,
                background: "#f7fafc"
              }}
            >
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} — {s.description}
                </option>
              ))}
            </select>
          </div>

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
            disabled={running}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              background: running ? "#a0aec0" : "#2b6cb0",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 14,
              cursor: running ? "default" : "pointer",
              marginBottom: 12
            }}
          >
            {running ? "Running Skill..." : "Run Skill"}
          </button>
        </>
      )}

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
            ✅ Skill <strong>{result.skillId}</strong> ran for contact{" "}
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