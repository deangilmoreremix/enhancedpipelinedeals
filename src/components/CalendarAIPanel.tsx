import React, { useEffect, useState } from "react";

interface CalendarEvent {
  id: string;
  contact_id: string;
  datetime: string;
  status: string;
  contacts?: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

interface CalendarListResponse {
  events: CalendarEvent[];
}

interface ScheduleResponse {
  event: CalendarEvent;
}

export const CalendarAIPanel: React.FC = () => {
  const [contactId, setContactId] = useState("");
  const [datetime, setDatetime] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/.netlify/functions/calendar-list");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }
      const data = (await res.json()) as CalendarListResponse;
      setEvents(data.events || []);
    } catch (e: any) {
      console.error("Calendar list error:", e);
      setError(e.message || "Failed to load events");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleSchedule = async () => {
    setError(null);

    if (!contactId || !datetime) {
      setError("Please enter both contact ID and datetime.");
      return;
    }

    setScheduling(true);
    try {
      const res = await fetch("/.netlify/functions/calendar-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, datetime })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }
      const data = (await res.json()) as ScheduleResponse;
      setEvents((prev) => [data.event, ...prev]);
      setContactId("");
      setDatetime("");
    } catch (e: any) {
      console.error("Calendar schedule error:", e);
      setError(e.message || "Failed to schedule meeting");
    } finally {
      setScheduling(false);
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
      <h2 style={{ marginBottom: 8 }}>📅 Calendar AI</h2>
      <p style={{ marginTop: 0, marginBottom: 16, fontSize: 14, color: "#4a5568" }}>
        Schedule and view AI-booked meetings without using Calendly.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 16
        }}
      >
        <div style={{ flex: "0 0 260px" }}>
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
              fontSize: 14,
              marginBottom: 8
            }}
          />
          <label
            style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}
          >
            Datetime (ISO)
          </label>
          <input
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
            placeholder="2025-01-15T15:00:00Z"
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e0",
              fontSize: 14,
              marginBottom: 8
            }}
          />
          <button
            type="button"
            onClick={handleSchedule}
            disabled={scheduling}
            style={{
              width: "100%",
              padding: "9px 14px",
              borderRadius: 8,
              border: "none",
              background: scheduling ? "#a0aec0" : "#38a169",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 13,
              cursor: scheduling ? "default" : "pointer"
            }}
          >
            {scheduling ? "Scheduling..." : "Schedule Meeting"}
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            padding: 8,
            background: "#f7fafc",
            maxHeight: 260,
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
            Upcoming Meetings
          </div>

          {loadingList ? (
            <div style={{ fontSize: 13 }}>Loading…</div>
          ) : events.length === 0 ? (
            <div style={{ fontSize: 13 }}>No upcoming events.</div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                style={{
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  marginBottom: 6
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                  {ev.contacts?.name || "Unknown contact"} •{" "}
                  <span style={{ textTransform: "capitalize" }}>{ev.status}</span>
                </div>
                <div style={{ fontSize: 12, color: "#4a5568" }}>
                  {ev.contacts?.email || "No email"}
                </div>
                <div style={{ fontSize: 12, color: "#718096", marginTop: 2 }}>
                  {new Date(ev.datetime).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 4,
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
  );
};