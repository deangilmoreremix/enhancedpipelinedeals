-- =====================================================
-- TWENTY CRM CALENDAR INTEGRATION - PHASE 6
-- Advanced calendar integration with OAuth, events, reminders, and email threading
-- =====================================================

-- Calendar integrations table (OAuth tokens)
CREATE TABLE IF NOT EXISTS calendar_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('google', 'outlook', 'apple')),
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  email text NOT NULL,
  calendar_id text,
  settings jsonb DEFAULT '{
    "sync_enabled": true,
    "bidirectional_sync": true,
    "default_reminder_minutes": 15,
    "auto_create_events": true
  }'::jsonb,
  last_sync_at timestamptz,
  sync_status text DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  sync_error text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enhanced calendar events table (extends basic meetings)
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  integration_id uuid REFERENCES calendar_integrations(id) ON DELETE SET NULL,
  external_event_id text, -- Google/Outlook event ID
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  timezone text DEFAULT 'UTC',
  location text,
  meeting_url text,
  attendees jsonb DEFAULT '[]'::jsonb, -- Array of {email, name, status}
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  event_type text DEFAULT 'meeting' CHECK (event_type IN ('meeting', 'deadline', 'followup', 'reminder')),
  recurrence_rule text, -- RRULE for recurring events
  reminders jsonb DEFAULT '[]'::jsonb, -- Array of reminder configs
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Deal deadlines and reminders
CREATE TABLE IF NOT EXISTS deal_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  deadline_at timestamptz NOT NULL,
  deadline_type text DEFAULT 'close_date' CHECK (deadline_type IN ('close_date', 'followup', 'milestone', 'custom')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'overdue', 'cancelled')),
  reminders jsonb DEFAULT '[]'::jsonb, -- Array of reminder configs
  calendar_event_id uuid REFERENCES calendar_events(id),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Email threads and CRM record linking
CREATE TABLE IF NOT EXISTS email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text UNIQUE NOT NULL, -- Gmail/Outlook thread ID
  subject text NOT NULL,
  participants jsonb DEFAULT '[]'::jsonb, -- Array of {email, name}
  last_message_at timestamptz,
  message_count integer DEFAULT 1,
  deal_id uuid REFERENCES deals(id),
  contact_id uuid REFERENCES contacts(id),
  tags jsonb DEFAULT '[]'::jsonb,
  sentiment_score decimal(3,2),
  priority_score decimal(3,2),
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'spam')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Individual emails within threads
CREATE TABLE IF NOT EXISTS emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  message_id text UNIQUE NOT NULL, -- Email message ID
  from_email text NOT NULL,
  to_emails jsonb DEFAULT '[]'::jsonb,
  cc_emails jsonb DEFAULT '[]'::jsonb,
  bcc_emails jsonb DEFAULT '[]'::jsonb,
  subject text NOT NULL,
  body_text text,
  body_html text,
  sent_at timestamptz NOT NULL,
  received_at timestamptz,
  attachments jsonb DEFAULT '[]'::jsonb,
  labels jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  ai_summary text,
  sentiment_analysis jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Email-CRM record associations (automatic linking)
CREATE TABLE IF NOT EXISTS email_crm_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (record_type IN ('deal', 'contact', 'activity')),
  record_id uuid NOT NULL,
  link_type text DEFAULT 'manual' CHECK (link_type IN ('manual', 'auto_subject', 'auto_content', 'auto_sender')),
  confidence_score decimal(3,2), -- For auto-linking
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Reminder system
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  remind_at timestamptz NOT NULL,
  reminder_type text DEFAULT 'notification' CHECK (reminder_type IN ('notification', 'email', 'calendar_event')),
  related_type text CHECK (related_type IN ('deal', 'contact', 'calendar_event', 'deadline')),
  related_id uuid,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  sent_at timestamptz,
  delivery_method text DEFAULT 'in_app',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Calendar sync logs
CREATE TABLE IF NOT EXISTS calendar_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES calendar_integrations(id) ON DELETE CASCADE,
  sync_type text NOT NULL CHECK (sync_type IN ('full', 'incremental', 'events_only')),
  status text DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  events_created integer DEFAULT 0,
  events_updated integer DEFAULT 0,
  events_deleted integer DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_user_provider ON calendar_integrations(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_active ON calendar_integrations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_calendar_events_deal_id ON calendar_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_contact_id ON calendar_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_integration_id ON calendar_events(integration_id);
CREATE INDEX IF NOT EXISTS idx_deal_deadlines_deal_id ON deal_deadlines(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_deadlines_deadline_at ON deal_deadlines(deadline_at);
CREATE INDEX IF NOT EXISTS idx_deal_deadlines_status ON deal_deadlines(status);
CREATE INDEX IF NOT EXISTS idx_email_threads_deal_id ON email_threads(deal_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_contact_id ON email_threads(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message_at ON email_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_sent_at ON emails(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_from_email ON emails(from_email);
CREATE INDEX IF NOT EXISTS idx_email_crm_links_record ON email_crm_links(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_email_crm_links_email ON email_crm_links(email_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_logs_integration ON calendar_sync_logs(integration_id);

-- Triggers for auto-updating timestamps
CREATE TRIGGER calendar_integrations_update_timestamp
  BEFORE UPDATE ON calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER calendar_events_update_timestamp
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER deal_deadlines_update_timestamp
  BEFORE UPDATE ON deal_deadlines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER email_threads_update_timestamp
  BEFORE UPDATE ON email_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER reminders_update_timestamp
  BEFORE UPDATE ON reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Feature flags for Phase 6 features
INSERT INTO feature_flags (feature_key, enabled, rollout_percentage, description) VALUES
  ('twenty_calendar_phase6', false, 0, 'Advanced calendar integration with OAuth, events, and email threading'),
  ('calendar_oauth_google', false, 0, 'Google Calendar OAuth integration'),
  ('calendar_oauth_outlook', false, 0, 'Microsoft Outlook Calendar OAuth integration'),
  ('calendar_bidirectional_sync', false, 0, 'Bidirectional sync between CRM and external calendars'),
  ('calendar_meeting_scheduling', false, 0, 'Schedule meetings directly from deals'),
  ('calendar_event_linking', false, 0, 'Link calendar events to specific deals'),
  ('deal_deadlines_calendar', false, 0, 'Calendar integration for deal close dates'),
  ('calendar_followup_reminders', false, 0, 'Automated calendar reminders for follow-ups'),
  ('email_threading_auto_linking', false, 0, 'Automatic email threading and CRM record association'),
  ('calendar_conflict_detection', false, 0, 'Calendar conflict detection and resolution'),
  ('calendar_privacy_security', false, 0, 'Enhanced privacy and security for calendar data')
ON CONFLICT (feature_key) DO NOTHING;

-- Migrate existing meetings table to calendar_events
INSERT INTO calendar_events (
  deal_id,
  contact_id,
  title,
  start_time,
  end_time,
  status,
  event_type,
  created_at
)
SELECT
  d.id as deal_id,
  m.contact_id,
  'Meeting' as title,
  m.datetime as start_time,
  m.datetime + interval '1 hour' as end_time,
  CASE WHEN m.status = 'scheduled' THEN 'confirmed' ELSE m.status END as status,
  'meeting' as event_type,
  m.created_at
FROM meetings m
LEFT JOIN deals d ON d.contact_id = m.contact_id
WHERE m.datetime IS NOT NULL
ON CONFLICT DO NOTHING;

-- Create function to automatically create deal deadlines from close dates
CREATE OR REPLACE FUNCTION create_deal_deadline_from_close_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only create if this is a new deal or close_date was just set
  IF (TG_OP = 'INSERT' OR OLD.close_date IS NULL) AND NEW.close_date IS NOT NULL THEN
    INSERT INTO deal_deadlines (
      deal_id,
      title,
      deadline_at,
      deadline_type,
      priority,
      reminders
    ) VALUES (
      NEW.id,
      'Deal Close Date',
      NEW.close_date,
      'close_date',
      CASE
        WHEN NEW.probability >= 80 THEN 'high'
        WHEN NEW.probability >= 60 THEN 'medium'
        ELSE 'low'
      END,
      '[{"type": "notification", "minutes_before": 1440}, {"type": "email", "minutes_before": 1440}]'::jsonb
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Update existing deadline if close_date changed
  IF TG_OP = 'UPDATE' AND OLD.close_date IS DISTINCT FROM NEW.close_date AND NEW.close_date IS NOT NULL THEN
    UPDATE deal_deadlines
    SET
      deadline_at = NEW.close_date,
      updated_at = now()
    WHERE deal_id = NEW.id AND deadline_type = 'close_date';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for automatic deal deadline creation
DROP TRIGGER IF EXISTS trigger_create_deal_deadline ON deals;
CREATE TRIGGER trigger_create_deal_deadline
  AFTER INSERT OR UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION create_deal_deadline_from_close_date();

-- Function to update email thread metadata
CREATE OR REPLACE FUNCTION update_email_thread_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE email_threads
  SET
    last_message_at = NEW.sent_at,
    message_count = message_count + 1,
    updated_at = now()
  WHERE id = NEW.thread_id;

  RETURN NEW;
END;
$$;

-- Create trigger for email thread updates
CREATE TRIGGER trigger_update_email_thread
  AFTER INSERT ON emails
  FOR EACH ROW
  EXECUTE FUNCTION update_email_thread_metadata();

-- Function to automatically link emails to CRM records based on content
CREATE OR REPLACE FUNCTION auto_link_email_to_crm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  deal_record record;
  contact_record record;
  confidence decimal(3,2);
BEGIN
  -- Try to find matching deal by subject/content
  SELECT d.*, 0.8 as conf INTO deal_record
  FROM deals d
  JOIN contacts c ON c.id = d.contact_id
  WHERE (NEW.subject ILIKE '%' || c.company || '%' OR NEW.subject ILIKE '%' || c.name || '%')
     OR (NEW.body_text ILIKE '%' || c.company || '%' OR NEW.body_text ILIKE '%' || c.name || '%')
  ORDER BY d.updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO email_crm_links (email_id, record_type, record_id, link_type, confidence_score)
    VALUES (NEW.id, 'deal', deal_record.id, 'auto_subject', deal_record.conf)
    ON CONFLICT DO NOTHING;

    -- Update email thread with deal association
    UPDATE email_threads SET deal_id = deal_record.id WHERE id = NEW.thread_id;
  END IF;

  -- Try to find matching contact by email
  SELECT *, 1.0 as conf INTO contact_record
  FROM contacts c
  WHERE c.email = NEW.from_email
     OR NEW.to_emails::text ILIKE '%' || c.email || '%'
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO email_crm_links (email_id, record_type, record_id, link_type, confidence_score)
    VALUES (NEW.id, 'contact', contact_record.id, 'auto_sender', contact_record.conf)
    ON CONFLICT DO NOTHING;

    -- Update email thread with contact association
    UPDATE email_threads SET contact_id = contact_record.id WHERE id = NEW.thread_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for automatic email linking
CREATE TRIGGER trigger_auto_link_email
  AFTER INSERT ON emails
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_email_to_crm();