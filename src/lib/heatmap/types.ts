export interface HeatmapDeal {
  deal_id: string;
  contact_id: string;
  contact_name: string | null;
  contact_email: string | null;
  stage: string;
  value: number;
  risk_score: number;
  days_since_reply: number;
  objection_level: number;
  stage_stagnation: number;
  updated_at: string;
}