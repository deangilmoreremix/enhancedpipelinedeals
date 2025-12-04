import React from "react";
import { VoiceAgentPanel } from "./components/VoiceAgentPanel";
import { VideoAgentPanel } from "./components/VideoAgentPanel";
import { HeatmapPanel } from "./components/HeatmapPanel";
import { PlaybooksPanel } from "./components/PlaybooksPanel";
import { AutopilotPanel } from "./components/AutopilotPanel";
import { SkillsPanel } from "./components/SkillsPanel";
import { MemoryPanel } from "./components/MemoryPanel";
import { MoodPanel } from "./components/MoodPanel";
import { CalendarAIPanel } from "./components/CalendarAIPanel";
import { SDRAgentsPanel } from "./components/SDRAgentsPanel";

export const App: React.FC = () => {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7fafc",
        padding: 24,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
      }}
    >
      <h1 style={{ marginBottom: 24 }}>SmartCRM AI Sales OS</h1>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          marginBottom: 24
        }}
      >
        <VoiceAgentPanel />
        <VideoAgentPanel />
        <AutopilotPanel />
        <SkillsPanel />
      </div>

      <HeatmapPanel />
      <PlaybooksPanel />
      <SDRAgentsPanel />
      <MemoryPanel />
      <MoodPanel />
      <CalendarAIPanel />
    </div>
  );
};