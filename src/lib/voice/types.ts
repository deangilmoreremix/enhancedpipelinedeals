export interface VoiceJobPayload {
  contact_id: string;
  script: string;
}

export interface VoiceJobRecord {
  id: string;
  contact_id: string;
  script: string | null;
  audio_base64: string | null;
  status: "pending" | "processing" | "sent" | "failed";
  created_at: string;
  updated_at: string;
}