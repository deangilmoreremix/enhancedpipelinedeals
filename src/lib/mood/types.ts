export type MoodId =
  | "friendly"
  | "urgent"
  | "calm"
  | "precision"
  | "insight";

export interface MoodContextContact {
  status?: string;
  [key: string]: any;
}

export interface MoodContextDeal {
  stage?: string;
  risk_score?: number;
  objection_level?: number;
  [key: string]: any;
}