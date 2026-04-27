-- =====================================================
-- TWENTY WORKFLOW INTEGRATION - FEATURE FLAG UPDATE
-- Enable Phase 5 workflow features
-- =====================================================

-- Enable the main workflow phase 5 feature
UPDATE feature_flags
SET enabled = true, rollout_percentage = 100, description = 'Advanced workflow system with triggers, actions, SLA monitoring'
WHERE feature_key = 'twenty_workflow_phase5';

-- Enable related workflow features
INSERT INTO feature_flags (feature_key, enabled, rollout_percentage, description) VALUES
  ('twenty_workflow_sla_monitoring', true, 100, 'Service level agreement monitoring and alerting'),
  ('twenty_workflow_email_integration', true, 100, 'Email integration for workflow notifications'),
  ('twenty_workflow_webhooks', true, 100, 'Webhook support for external integrations'),
  ('twenty_workflow_ai_agents', true, 100, 'AI agent integration for intelligent automation'),
  ('twenty_workflow_analytics', true, 100, 'Workflow performance monitoring and analytics'),
  ('twenty_workflow_visual_builder', true, 100, 'Visual drag-and-drop workflow builder')
ON CONFLICT (feature_key) DO UPDATE SET
  enabled = true,
  rollout_percentage = 100,
  updated_at = now();

-- Insert sample email templates
INSERT INTO email_templates (name, description, subject, body, variables, category, is_active) VALUES
  ('Deal Stage Change Notification', 'Notify team when a deal moves to a new stage', 'Deal {{dealName}} moved to {{newStage}}', 'Hi team,\n\nThe deal "{{dealName}}" has moved from {{oldStage}} to {{newStage}}.\n\nValue: ${{dealValue}}\nAssigned to: {{assignedTo}}\n\nBest regards,\nCRM System', '["dealName","newStage","oldStage","dealValue","assignedTo"]', 'notification', true),
  ('SLA Breach Alert', 'Alert when service level agreement is breached', 'SLA Breach: {{recordType}} {{recordId}}', 'Warning: SLA has been breached for {{recordType}} {{recordId}}.\n\nTarget time: {{targetTime}}\nCurrent delay: {{delay}} {{unit}}\n\nPlease take immediate action.\n\nCRM System', '["recordType","recordId","targetTime","delay","unit"]', 'alert', true),
  ('Milestone Achievement', 'Celebrate when important milestones are reached', 'Congratulations: {{milestoneName}} achieved!', 'Great news! {{milestoneName}} has been achieved for deal {{dealName}}.\n\nValue: ${{dealValue}}\nTime to achieve: {{timeToAchieve}} days\n\nKeep up the excellent work!\n\nCRM System', '["milestoneName","dealName","dealValue","timeToAchieve"]', 'notification', true)
ON CONFLICT DO NOTHING;

-- Insert sample webhook configurations
INSERT INTO webhook_configurations (name, url, method, headers, events, is_active, retry_policy) VALUES
  ('Deal Updates Webhook', 'https://api.example.com/webhooks/deals', 'POST', '{"Authorization":"Bearer YOUR_TOKEN","Content-Type":"application/json"}', '["record_updated","stage_changed"]', true, '{"maxRetries": 3, "retryDelay": 60}'),
  ('SLA Alerts Webhook', 'https://api.example.com/webhooks/sla', 'POST', '{"Authorization":"Bearer YOUR_TOKEN","Content-Type":"application/json"}', '["sla_breach","sla_warning"]', true, '{"maxRetries": 5, "retryDelay": 30}')
ON CONFLICT DO NOTHING;

-- Insert sample AI agent configurations
INSERT INTO ai_agent_configurations (name, description, model, prompt, tools, max_tokens, temperature, context_window, is_active) VALUES
  ('Deal Analysis Agent', 'AI agent for analyzing deal health and providing recommendations', 'gpt-4', 'You are a sales analyst. Analyze the provided deal data and provide insights on health, probability, and next steps. Be concise but thorough.', '["deal_analysis","market_research","competitor_analysis"]', 2048, 0.7, 8192, true),
  ('Email Response Agent', 'AI agent for generating personalized email responses', 'gpt-3.5-turbo', 'You are a professional sales representative. Generate personalized, compelling email responses based on the context provided. Keep responses professional and focused on value.', '["email_drafting","tone_analysis","personalization"]', 1024, 0.8, 4096, true)
ON CONFLICT DO NOTHING;

-- Insert sample SLA policies
INSERT INTO sla_policies (name, description, record_type, conditions, metrics, actions, is_active) VALUES
  ('Initial Response SLA', 'Ensure initial responses within 24 hours', 'contact', '[]', '{"type":"response_time","target":24,"unit":"hours","warningThreshold":75,"criticalThreshold":100}', '{"onWarning":[{"type":"send_email","name":"SLA Warning","config":{"recipients":["sales@company.com"],"subject":"SLA Warning: Initial Response","body":"Warning: Initial response SLA at 75% for contact {{recordId}}"}}],"onBreach":[{"type":"send_email","name":"SLA Breach","config":{"recipients":["manager@company.com","sales@company.com"],"subject":"SLA BREACH: Initial Response","body":"CRITICAL: Initial response SLA breached for contact {{recordId}}. Immediate action required."}]}', true),
  ('Stage Progression SLA', 'Ensure deals progress through stages within time limits', 'deal', '[{"field":"stage","operator":"equals","value":"qualification"}]', '{"type":"stage_duration","target":7,"unit":"days","warningThreshold":80,"criticalThreshold":100}', '{"onWarning":[{"type":"notification","name":"Stage Warning","config":{"notificationType":"in_app","notificationMessage":"Deal {{recordId}} approaching stage duration limit"}}],"onBreach":[{"type":"send_email","name":"Stage SLA Breach","config":{"recipients":["sales@company.com"],"subject":"Stage Duration SLA Breached","body":"Deal {{recordId}} has exceeded the maximum time in current stage."}]}', true)
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status_started ON workflow_executions(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sla_instances_active_status ON sla_instances(status) WHERE status IN ('active', 'warning');
CREATE INDEX IF NOT EXISTS idx_email_templates_category_active ON email_templates(category, is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_configurations_active_events ON webhook_configurations(is_active, events);
CREATE INDEX IF NOT EXISTS idx_ai_agent_configurations_active ON ai_agent_configurations(is_active);