export interface VideoJobPayload {
  contact_id: string;
  template?: string;
  script: string;
  props?: any;
}

export interface VideoJobRecord {
  id: string;
  contact_id: string;
  template: string | null;
  props: any;
  video_base64: string | null;
  status: "pending" | "processing" | "sent" | "failed";
  created_at: string;
  updated_at: string;
}