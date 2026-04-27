-- =====================================================
-- TWENTY CRM WORKFLOW INTEGRATION - PHASE 5
-- Enhanced workflow system with triggers, actions, SLA monitoring
-- =====================================================

-- Enhanced workflows table (extends basic deal_workflows)
ALTER TABLE deal_workflows ADD COLUMN IF NOT EXISTS category text DEFAULT 'custom';
ALTER TABLE deal_workflows ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';
ALTER TABLE deal_workflows ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
ALTER TABLE deal_workflows ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- Workflow executions tracking
CREATE TABLE IF NOT EXISTS workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES deal_workflows(id) ON DELETE CASCADE,
  trigger_id text,
  trigger_type text NOT NULL,
  status text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'timeout', 'cancelled')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration integer, -- milliseconds
  context jsonb DEFAULT '{}',
  steps jsonb DEFAULT '[]',
  logs jsonb DEFAULT '[]',
  error_message text,
  error_step_id text,
  error_stack_trace text,
  created_at timestamptz DEFAULT now()
);

-- SLA policies
CREATE TABLE IF NOT EXISTS sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  record_type text NOT NULL CHECK (record_type IN ('deal', 'contact', 'task')),
  conditions jsonb DEFAULT '[]',
  metrics jsonb NOT NULL,
  actions jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- SLA instances (active SLA tracking)
CREATE TABLE IF NOT EXISTS sla_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid REFERENCES sla_policies(id) ON DELETE CASCADE,
  record_id uuid NOT NULL,
  record_type text NOT NULL,
  started_at timestamptz DEFAULT now(),
  target_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'warning', 'breached', 'completed', 'cancelled')),
  current_value integer DEFAULT 0, -- minutes
  last_checked timestamptz DEFAULT now(),
  notifications jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  subject text NOT NULL,
  body text NOT NULL,
  variables jsonb DEFAULT '[]',
  category text DEFAULT 'custom',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Webhook configurations
CREATE TABLE IF NOT EXISTS webhook_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  method text DEFAULT 'POST' CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE')),
  headers jsonb DEFAULT '{}',
  secret text,
  events jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  retry_policy jsonb DEFAULT '{"maxRetries": 3, "retryDelay": 60}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- AI agent configurations
CREATE TABLE IF NOT EXISTS ai_agent_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  model text NOT NULL,
  prompt text NOT NULL,
  tools jsonb DEFAULT '[]',
  max_tokens integer DEFAULT 4096,
  temperature decimal(3,2) DEFAULT 0.7,
  context_window integer DEFAULT 8192,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workflow analytics
CREATE TABLE IF NOT EXISTS workflow_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES deal_workflows(id) ON DELETE CASCADE,
  total_executions integer DEFAULT 0,
  successful_executions integer DEFAULT 0,
  failed_executions integer DEFAULT 0,
  average_execution_time integer DEFAULT 0, -- milliseconds
  step_performance jsonb DEFAULT '{}',
  trigger_frequency jsonb DEFAULT '{}',
  action_frequency jsonb DEFAULT '{}',
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Scheduled workflow triggers
CREATE TABLE IF NOT EXISTS scheduled_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES deal_workflows(id) ON DELETE CASCADE,
  name text NOT NULL,
  schedule_config jsonb NOT NULL,
  next_run timestamptz,
  last_run timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workflow variables/context storage
CREATE TABLE IF NOT EXISTS workflow_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_id uuid REFERENCES workflow_executions(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb,
  scope text DEFAULT 'execution' CHECK (scope IN ('global', 'execution', 'step')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started ON workflow_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_sla_instances_policy ON sla_instances(policy_id);
CREATE INDEX IF NOT EXISTS idx_sla_instances_record ON sla_instances(record_id, record_type);
CREATE INDEX IF NOT EXISTS idx_sla_instances_status ON sla_instances(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_triggers_next_run ON scheduled_triggers(next_run) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflow_variables_execution ON workflow_variables(workflow_execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_workflow ON workflow_analytics(workflow_id);

-- Triggers for auto-updating timestamps
CREATE TRIGGER sla_policies_update_timestamp
  BEFORE UPDATE ON sla_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER sla_instances_update_timestamp
  BEFORE UPDATE ON sla_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER email_templates_update_timestamp
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER webhook_configurations_update_timestamp
  BEFORE UPDATE ON webhook_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER ai_agent_configurations_update_timestamp
  BEFORE UPDATE ON ai_agent_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER scheduled_triggers_update_timestamp
  BEFORE UPDATE ON scheduled_triggers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER workflow_variables_update_timestamp
  BEFORE UPDATE ON workflow_variables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Feature flag for workflow phase 5
INSERT INTO feature_flags (feature_key, enabled, rollout_percentage, description) VALUES
  ('twenty_workflow_phase5', false, 0, 'Advanced workflow system with triggers, actions, and SLA monitoring')
ON CONFLICT (feature_key) DO NOTHING;