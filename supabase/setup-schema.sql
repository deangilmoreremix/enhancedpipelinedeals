-- =====================================================
-- SMARTCRM AUTONOMOUS SALES SYSTEM - COMPLETE SCHEMA
-- =====================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- CORE CRM TABLES
-- =====================================================

-- CONTACTS TABLE
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE,
  phone text,
  company text,
  status text DEFAULT 'new',
  lead_score int DEFAULT 50,
  persona text,
  autopilot_enabled boolean DEFAULT false,
  autopilot_state text DEFAULT 'new',
  last_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- DEALS TABLE
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  stage text DEFAULT 'new',
  value numeric DEFAULT 0,
  risk_score int DEFAULT 0,
  objection_level int DEFAULT 0,
  stage_stagnation int DEFAULT 0,
  days_since_reply int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ACTIVITIES TABLE (Audit Trail)
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  type text,
  message text,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- AI AGENT TABLES
-- =====================================================

-- SDR PERSONAS
CREATE TABLE IF NOT EXISTS sdr_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  short_id text UNIQUE,
  description text,
  tone text,
  persona_prompt text,
  created_at timestamptz DEFAULT now()
);

-- AGENT METADATA
CREATE TABLE IF NOT EXISTS agent_metadata (
  id text PRIMARY KEY,
  name text,
  persona text,
  objectives jsonb,
  workflow jsonb,
  tools jsonb,
  created_at timestamptz DEFAULT now()
);

-- CONTACT → AGENT ASSIGNMENT
CREATE TABLE IF NOT EXISTS contact_agent_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  agent_id text REFERENCES agent_metadata(id),
  updated_at timestamptz DEFAULT now()
);

-- AGENT SKILLS
CREATE TABLE IF NOT EXISTS agent_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text REFERENCES agent_metadata(id),
  skill_id text,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- AGENT MEMORY & INTELLIGENCE
-- =====================================================

-- AGENT MEMORY (Short/Mid/Long Term)
CREATE TABLE IF NOT EXISTS agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  memory_type text CHECK (memory_type IN ('short', 'mid', 'long')),
  data jsonb,
  updated_at timestamptz DEFAULT now()
);

-- DEAL RISK TRACKING
CREATE TABLE IF NOT EXISTS deal_risk_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  date date,
  risk_score int,
  reason text
);

-- =====================================================
-- COMMUNICATION & AUTOMATION
-- =====================================================

-- MEETINGS/CALENDAR
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  datetime timestamptz,
  status text DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now()
);

-- PLAYBOOKS (Sales Sequences)
CREATE TABLE IF NOT EXISTS playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text,
  content jsonb,
  created_at timestamptz DEFAULT now()
);

-- AUTOPILOT LOGS
CREATE TABLE IF NOT EXISTS autopilot_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  state text,
  event text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- MULTI-MODAL PROCESSING
-- =====================================================

-- VOICE JOBS QUEUE
CREATE TABLE IF NOT EXISTS voice_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  script text,
  audio_base64 text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- VIDEO JOBS QUEUE
CREATE TABLE IF NOT EXISTS video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  template text,
  props jsonb,
  video_base64 text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- INDEXES (Critical for Performance)
-- =====================================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON activities(contact_id);

-- Agent indexes
CREATE INDEX IF NOT EXISTS idx_contact_agent ON contact_agent_assignment(contact_id);
CREATE INDEX IF NOT EXISTS idx_memory_contact ON agent_memory(contact_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON agent_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_risk_deal ON deal_risk_daily(deal_id);

-- Communication indexes
CREATE INDEX IF NOT EXISTS idx_meetings_contact ON meetings(contact_id);
CREATE INDEX IF NOT EXISTS idx_voice_jobs_status ON voice_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);

-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

-- Get contact with full context
CREATE OR REPLACE FUNCTION get_contact_full(cid uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  c jsonb;
  d jsonb;
  m jsonb;
BEGIN
  SELECT row_to_json(t) INTO c FROM contacts t WHERE t.id = cid;
  SELECT row_to_json(t) INTO d FROM deals t WHERE t.contact_id = cid;
  SELECT jsonb_agg(row_to_json(t)) INTO m FROM agent_memory t WHERE t.contact_id = cid;
  RETURN jsonb_build_object('contact', c, 'deal', d, 'memory', m);
END;
$$;

-- Activity logging
CREATE OR REPLACE FUNCTION log_activity(cid uuid, event_type text, msg text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO activities (contact_id, type, message) VALUES (cid, event_type, msg);
END;
$$;

-- Deal stage updates
CREATE OR REPLACE FUNCTION update_stage(did uuid, new_stage text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE deals SET stage = new_stage WHERE id = did;
END;
$$;

-- Agent memory persistence
CREATE OR REPLACE FUNCTION save_agent_memory(cid uuid, mem_type text, mem jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO agent_memory (contact_id, memory_type, data) VALUES (cid, mem_type, mem);
END;
$$;

-- =====================================================
-- AUTO-TRIGGERS
-- =====================================================

-- Auto-create deal when contact is created
CREATE OR REPLACE FUNCTION create_deal_on_contact()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO deals (contact_id, deal_name, stage)
  VALUES (NEW.id, CONCAT('Deal for ', NEW.name), 'new');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_deal
AFTER INSERT ON contacts
FOR EACH ROW
EXECUTE FUNCTION create_deal_on_contact();

-- Auto-create memory record
CREATE OR REPLACE FUNCTION init_memory_on_contact()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO agent_memory(contact_id, memory_type, data)
  VALUES (NEW.id, 'short', jsonb_build_object('init', now()));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_init_memory
AFTER INSERT ON contacts
FOR EACH ROW
EXECUTE FUNCTION init_memory_on_contact();

-- =====================================================
-- AUTO TIMESTAMPS
-- =====================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_update_timestamp
BEFORE UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER deals_update_timestamp
BEFORE UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER voice_jobs_update_timestamp
BEFORE UPDATE ON voice_jobs
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER video_jobs_update_timestamp
BEFORE UPDATE ON video_jobs
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- =====================================================
-- ROW LEVEL SECURITY (Optional - for production)
-- =====================================================

-- Note: Enable these in production for security
-- ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE voice_jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "service_role_all" ON contacts FOR ALL USING (auth.role() = 'service_role');
-- CREATE POLICY "service_role_all" ON deals FOR ALL USING (auth.role() = 'service_role');
-- CREATE POLICY "service_role_all" ON agent_memory FOR ALL USING (auth.role() = 'service_role');
-- CREATE POLICY "service_role_all" ON activities FOR ALL USING (auth.role() = 'service_role');
-- CREATE POLICY "service_role_all" ON meetings FOR ALL USING (auth.role() = 'service_role');
-- CREATE POLICY "service_role_all" ON voice_jobs FOR ALL USING (auth.role() = 'service_role');
-- CREATE POLICY "service_role_all" ON video_jobs FOR ALL USING (auth.role() = 'service_role');