#!/usr/bin/env node

import { createServer } from "@modelcontextprotocol/server";
import OpenAI from "openai";
import fetch from "node-fetch";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const server = createServer({
  name: "Voice-Agent",
  version: "1.0.0"
});

// -------------------------
// START CALL
// -------------------------
server.tool("call_start", {
  description: "Begin a voice call session",
  inputSchema: {
    type: "object",
    properties: {
      contact_number: { type: "string" }
    },
    required: ["contact_number"]
  },
  handler: async ({ contact_number }) => {
    return {
      ok: true,
      session_id: `sess_${Date.now()}`,
      contact_number
    };
  }
});

// -------------------------
// SAY SOMETHING
// -------------------------
server.tool("say", {
  description: "Speak a message using OpenAI text-to-speech",
  inputSchema: {
    type: "object",
    properties: {
      message: { type: "string" }
    },
    required: ["message"]
  },
  handler: async ({ message }) => {
    const audio = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      input: message
    });

    return { audio_base64: audio.toString("base64") };
  }
});

// -------------------------
// LISTEN TO CALLER
// -------------------------
server.tool("listen", {
  description: "Process speech-to-text from user audio",
  inputSchema: {
    type: "object",
    properties: {
      audio_base64: { type: "string" }
    },
    required: ["audio_base64"]
  },
  handler: async ({ audio_base64 }) => {
    const wavBuffer = Buffer.from(audio_base64, "base64");
    const transcript = await openai.audio.transcriptions.create({
      file: wavBuffer,
      model: "gpt-4o-mini-tts"
    });

    return { transcript };
  }
});

// -------------------------
// END CALL
// -------------------------
server.tool("call_end", {
  description: "Terminate call session",
  inputSchema: {
    type: "object",
    properties: {
      session_id: { type: "string" }
    },
    required: ["session_id"]
  },
  handler: async ({ session_id }) => {
    return { ok: true, session_id };
  }
});

// -------------------------
// STREAM AUDIO (Real-time)
// -------------------------
server.tool("stream", {
  description: "Stream real-time audio for voice conversation",
  inputSchema: {
    type: "object",
    properties: {
      session_id: { type: "string" },
      audio_chunk: { type: "string" }
    },
    required: ["session_id", "audio_chunk"]
  },
  handler: async ({ session_id, audio_chunk }) => {
    // Process real-time audio chunk
    return {
      ok: true,
      session_id,
      processed: true
    };
  }
});

server.start();