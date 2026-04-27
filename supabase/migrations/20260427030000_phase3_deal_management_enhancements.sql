-- Migration for Phase 3: Deal Management Enhancements
-- This migration adds new tables and columns for deal health, probability, templates, bulk actions, and timeline

-- Add new columns to deals table
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS health_factors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS win_probability INTEGER,
ADD COLUMN IF NOT EXISTS probability_factors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES deal_templates(id),
ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_health_update TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_probability_update TIMESTAMPTZ;

-- Create deal_activities table for timeline tracking
CREATE TABLE IF NOT EXISTS deal_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for deal_activities
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal_id ON deal_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_activities_type ON deal_activities(type);
CREATE INDEX IF NOT EXISTS idx_deal_activities_created_at ON deal_activities(created_at DESC);

-- Update deal_templates table (if it doesn't exist, create it)
CREATE TABLE IF NOT EXISTS deal_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'general',
    template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for deal_templates
CREATE INDEX IF NOT EXISTS idx_deal_templates_category ON deal_templates(category);
CREATE INDEX IF NOT EXISTS idx_deal_templates_is_public ON deal_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_deal_templates_created_by ON deal_templates(created_by);

-- Create feature_flags table if it doesn't exist
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    feature_key VARCHAR(255) UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    rollout_percentage INTEGER DEFAULT 100,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default feature flags for Phase 3 features
INSERT INTO feature_flags (feature_key, enabled, description) VALUES
    ('deal_health_indicators', false, 'Visual health scores for deals'),
    ('win_probability_calculator', false, 'Advanced probability algorithms'),
    ('deal_templates_phase3', false, 'Pre-built deal templates system'),
    ('bulk_deal_actions', false, 'Multi-deal operations and updates'),
    ('deal_timeline', false, 'Activity tracking for deals')
ON CONFLICT (feature_key) DO NOTHING;

-- Create a function to automatically update health and probability scores
CREATE OR REPLACE FUNCTION update_deal_scores()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last_health_update if health-related fields changed
    IF OLD.health_score IS DISTINCT FROM NEW.health_score OR
       OLD.health_factors IS DISTINCT FROM NEW.health_factors THEN
        NEW.last_health_update = NOW();
    END IF;

    -- Update last_probability_update if probability-related fields changed
    IF OLD.win_probability IS DISTINCT FROM NEW.win_probability OR
       OLD.probability_factors IS DISTINCT FROM NEW.probability_factors THEN
        NEW.last_probability_update = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS trigger_update_deal_scores ON deals;
CREATE TRIGGER trigger_update_deal_scores
    BEFORE UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION update_deal_scores();

-- Create function to log deal activities automatically
CREATE OR REPLACE FUNCTION log_deal_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Log stage changes
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        INSERT INTO deal_activities (deal_id, type, title, description, metadata)
        VALUES (NEW.id, 'stage_changed', 'Stage Changed',
                format('Deal moved from %s to %s', OLD.stage, NEW.stage),
                jsonb_build_object('oldStage', OLD.stage, 'newStage', NEW.stage));
    END IF;

    -- Log probability changes
    IF OLD.probability IS DISTINCT FROM NEW.probability THEN
        INSERT INTO deal_activities (deal_id, type, title, description, metadata)
        VALUES (NEW.id, 'probability_updated', 'Probability Updated',
                format('Probability changed from %s%% to %s%%', OLD.probability, NEW.probability),
                jsonb_build_object('oldProbability', OLD.probability, 'newProbability', NEW.probability));
    END IF;

    -- Log value changes
    IF OLD.value IS DISTINCT FROM NEW.value THEN
        INSERT INTO deal_activities (deal_id, type, title, description, metadata)
        VALUES (NEW.id, 'updated', 'Deal Value Updated',
                format('Value changed from $%s to $%s', OLD.value, NEW.value),
                jsonb_build_object('oldValue', OLD.value, 'newValue', NEW.value));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic activity logging
DROP TRIGGER IF EXISTS trigger_log_deal_activity ON deals;
CREATE TRIGGER trigger_log_deal_activity
    AFTER UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION log_deal_activity();

-- Create RLS policies for the new tables
ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Policies for deal_activities (users can only see activities for deals they have access to)
CREATE POLICY "Users can view deal activities" ON deal_activities
    FOR SELECT USING (true); -- Adjust based on your deal access control

CREATE POLICY "Users can insert deal activities" ON deal_activities
    FOR INSERT WITH CHECK (true); -- Adjust based on your permissions

-- Policies for deal_templates
CREATE POLICY "Users can view public templates and their own" ON deal_templates
    FOR SELECT USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Users can create templates" ON deal_templates
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own templates" ON deal_templates
    FOR UPDATE USING (created_by = auth.uid());

-- Policies for feature_flags (admin only)
CREATE POLICY "Users can view feature flags" ON feature_flags
    FOR SELECT USING (true);

-- Only allow updates to feature flags for admin users (adjust based on your admin system)
-- CREATE POLICY "Admins can update feature flags" ON feature_flags
--     FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');

-- For now, allow all updates (remove this in production)
CREATE POLICY "Allow feature flag updates" ON feature_flags
    FOR UPDATE USING (true);

-- Update existing deals to have default values
UPDATE deals
SET
    health_score = 50,
    win_probability = probability,
    last_health_update = NOW(),
    last_probability_update = NOW()
WHERE health_score IS NULL;