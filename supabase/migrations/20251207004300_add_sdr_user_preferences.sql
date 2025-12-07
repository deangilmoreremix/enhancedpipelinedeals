-- SDR Agent User Preferences and Configuration Tables

-- User preferences for SDR agents
CREATE TABLE IF NOT EXISTS sdr_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  preferences JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, agent_id)
);

-- Campaign templates for reusable SDR sequences
CREATE TABLE IF NOT EXISTS sdr_campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  description TEXT,
  sequence JSONB NOT NULL DEFAULT '[]',
  settings JSONB NOT NULL DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent performance tracking
CREATE TABLE IF NOT EXISTS sdr_agent_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  campaign_id TEXT,
  deal_id TEXT,
  contact_id TEXT,
  metrics JSONB NOT NULL DEFAULT '{}',
  execution_time INTEGER, -- in milliseconds
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Preset configurations for different use cases
CREATE TABLE IF NOT EXISTS sdr_preset_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  agent_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('conservative', 'aggressive', 'balanced', 'industry-specific')),
  preferences JSONB NOT NULL DEFAULT '{}',
  recommended_for TEXT[] DEFAULT '{}',
  success_rate DECIMAL(3,2), -- 0.00 to 1.00
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sdr_user_preferences_user_agent ON sdr_user_preferences(user_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_sdr_campaign_templates_user ON sdr_campaign_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_sdr_agent_performance_user ON sdr_agent_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_sdr_agent_performance_agent ON sdr_agent_performance(agent_id);
CREATE INDEX IF NOT EXISTS idx_sdr_preset_configurations_category ON sdr_preset_configurations(category);
CREATE INDEX IF NOT EXISTS idx_sdr_preset_configurations_agent ON sdr_preset_configurations(agent_id);

-- Row Level Security (RLS) policies
ALTER TABLE sdr_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdr_campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdr_agent_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdr_preset_configurations ENABLE ROW LEVEL SECURITY;

-- Users can only access their own preferences
CREATE POLICY "Users can view own SDR preferences" ON sdr_user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own SDR preferences" ON sdr_user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own SDR preferences" ON sdr_user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own SDR preferences" ON sdr_user_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Campaign templates policies
CREATE POLICY "Users can view own campaign templates" ON sdr_campaign_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view public campaign templates" ON sdr_campaign_templates
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can insert own campaign templates" ON sdr_campaign_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaign templates" ON sdr_campaign_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaign templates" ON sdr_campaign_templates
  FOR DELETE USING (auth.uid() = user_id);

-- Performance tracking policies
CREATE POLICY "Users can view own agent performance" ON sdr_agent_performance
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agent performance" ON sdr_agent_performance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Preset configurations are readable by all authenticated users
CREATE POLICY "Authenticated users can view preset configurations" ON sdr_preset_configurations
  FOR SELECT USING (auth.role() = 'authenticated');

-- Insert default preset configurations
INSERT INTO sdr_preset_configurations (name, description, agent_id, category, preferences, recommended_for) VALUES
(
  'Conservative Follow-Up',
  'Gentle, professional follow-up sequence with longer delays',
  'sdr-follow-up',
  'conservative',
  '{
    "campaignLength": 4,
    "timing": "weekly",
    "tone": "professional",
    "style": "detailed",
    "personalizationLevel": "medium",
    "channels": {
      "primary": "email",
      "secondary": ["linkedin"],
      "conditions": {"email": "always", "linkedin": "after_3_emails"},
      "limits": {"email": 4, "linkedin": 1}
    }
  }'::jsonb,
  ARRAY['enterprise-sales', 'consulting', 'high-touch-sales']
),
(
  'Aggressive Cold Outreach',
  'Fast-paced, enthusiastic cold email sequence',
  'sdr-cold-email',
  'aggressive',
  '{
    "campaignLength": 6,
    "timing": "business-hours",
    "tone": "enthusiastic",
    "style": "comprehensive",
    "personalizationLevel": "high",
    "channels": {
      "primary": "email",
      "secondary": ["linkedin", "whatsapp"],
      "conditions": {"email": "always", "linkedin": "after_2_emails", "whatsapp": "after_4_emails"},
      "limits": {"email": 6, "linkedin": 2, "whatsapp": 1}
    }
  }'::jsonb,
  ARRAY['saas-startups', 'tech-sales', 'fast-moving-markets']
),
(
  'Balanced B2B Sequence',
  'Well-paced sequence balancing persistence with respect',
  'sdr-follow-up',
  'balanced',
  '{
    "campaignLength": 5,
    "timing": "business-hours",
    "tone": "conversational",
    "style": "detailed",
    "personalizationLevel": "high",
    "channels": {
      "primary": "email",
      "secondary": ["linkedin"],
      "conditions": {"email": "always", "linkedin": "after_3_emails"},
      "limits": {"email": 5, "linkedin": 2}
    }
  }'::jsonb,
  ARRAY['b2b-sales', 'professional-services', 'general-business']
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sdr_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_sdr_user_preferences_updated_at
  BEFORE UPDATE ON sdr_user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_sdr_updated_at();

CREATE TRIGGER update_sdr_campaign_templates_updated_at
  BEFORE UPDATE ON sdr_campaign_templates
  FOR EACH ROW EXECUTE FUNCTION update_sdr_updated_at();

CREATE TRIGGER update_sdr_preset_configurations_updated_at
  BEFORE UPDATE ON sdr_preset_configurations
  FOR EACH ROW EXECUTE FUNCTION update_sdr_preset_configurations_updated_at();