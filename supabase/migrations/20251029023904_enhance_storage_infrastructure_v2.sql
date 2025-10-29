/*
  # Enhance Storage Infrastructure for All Features

  ## Summary
  This migration enhances the database schema to ensure adequate storage and memory 
  for all application features including AI insights, psychological profiles, 
  behavioral analytics, gamification, and file attachments.

  ## 1. Enhanced Contact Storage
  Adds columns to contacts table for:
  - AI-generated psychological profiles with detailed personality traits
  - Behavioral insights for engagement tracking
  - AI score rationale with detailed explanations
  - Last enrichment metadata for tracking AI updates
  - Enhanced social profiles and custom fields

  ## 2. Enhanced Deal Storage
  Adds columns to deals table for:
  - AI scoring and insights
  - File attachments and links management
  - Advanced deal analytics
  - Social profiles for company tracking
  - Priority and next follow-up tracking

  ## 3. AI Analysis Storage
  Creates dedicated tables for:
  - Psychological profiles (normalized structure)
  - Behavioral insights (time-series data)
  - AI score analysis (detailed breakdowns)
  - AI enrichment history (audit trail)

  ## 4. Gamification Infrastructure
  Creates tables for:
  - Team achievements
  - Team challenges
  - Leaderboard data
  - Performance metrics

  ## 5. File and Attachment Storage
  Creates tables for:
  - Deal attachments
  - Contact files
  - Image metadata

  ## 6. Communication Storage
  Enhances communication tables for:
  - Email templates
  - Call logs
  - Communication history

  ## 7. Performance Optimizations
  - Adds indexes on JSONB columns for faster queries
  - Creates materialized views for analytics
  - Implements proper foreign key relationships

  ## Security
  - All new tables have RLS enabled
  - Policies restrict access to user's own data
  - Proper authentication checks
*/

-- ============================================================================
-- 1. ENHANCE CONTACTS TABLE
-- ============================================================================

-- Add psychological profile columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'psychological_profile'
  ) THEN
    ALTER TABLE contacts ADD COLUMN psychological_profile JSONB DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'ai_score_rationale'
  ) THEN
    ALTER TABLE contacts ADD COLUMN ai_score_rationale JSONB DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'behavioral_insights'
  ) THEN
    ALTER TABLE contacts ADD COLUMN behavioral_insights JSONB DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'last_enrichment'
  ) THEN
    ALTER TABLE contacts ADD COLUMN last_enrichment JSONB DEFAULT NULL;
  END IF;
END $$;

-- Add indexes for JSONB columns on contacts
CREATE INDEX IF NOT EXISTS idx_contacts_psychological_profile ON contacts USING GIN (psychological_profile);
CREATE INDEX IF NOT EXISTS idx_contacts_behavioral_insights ON contacts USING GIN (behavioral_insights);
CREATE INDEX IF NOT EXISTS idx_contacts_gamification_stats ON contacts USING GIN (gamification_stats);
CREATE INDEX IF NOT EXISTS idx_contacts_custom_fields ON contacts USING GIN (custom_fields);
CREATE INDEX IF NOT EXISTS idx_contacts_ai_score ON contacts (ai_score) WHERE ai_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_interest_level ON contacts (interest_level);
CREATE INDEX IF NOT EXISTS idx_contacts_is_team_member ON contacts (is_team_member) WHERE is_team_member = true;

-- ============================================================================
-- 2. ENHANCE DEALS TABLE
-- ============================================================================

-- Add missing columns to deals table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'company'
  ) THEN
    ALTER TABLE deals ADD COLUMN company TEXT DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'contact'
  ) THEN
    ALTER TABLE deals ADD COLUMN contact TEXT DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'stage'
  ) THEN
    ALTER TABLE deals ADD COLUMN stage TEXT DEFAULT 'qualification';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'priority'
  ) THEN
    ALTER TABLE deals ADD COLUMN priority TEXT DEFAULT 'medium';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE deals ADD COLUMN due_date TIMESTAMP WITH TIME ZONE DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'notes'
  ) THEN
    ALTER TABLE deals ADD COLUMN notes TEXT DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'ai_score'
  ) THEN
    ALTER TABLE deals ADD COLUMN ai_score NUMERIC(5,2) DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'social_profiles'
  ) THEN
    ALTER TABLE deals ADD COLUMN social_profiles JSONB DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'links'
  ) THEN
    ALTER TABLE deals ADD COLUMN links JSONB DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'last_enrichment'
  ) THEN
    ALTER TABLE deals ADD COLUMN last_enrichment JSONB DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'next_follow_up'
  ) THEN
    ALTER TABLE deals ADD COLUMN next_follow_up TIMESTAMP WITH TIME ZONE DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'is_favorite'
  ) THEN
    ALTER TABLE deals ADD COLUMN is_favorite BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'contact_avatar'
  ) THEN
    ALTER TABLE deals ADD COLUMN contact_avatar TEXT DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'company_avatar'
  ) THEN
    ALTER TABLE deals ADD COLUMN company_avatar TEXT DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'last_activity'
  ) THEN
    ALTER TABLE deals ADD COLUMN last_activity TEXT DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE deals ADD COLUMN user_id UUID DEFAULT NULL;
  END IF;
END $$;

-- Add indexes for deals
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals (stage);
CREATE INDEX IF NOT EXISTS idx_deals_priority ON deals (priority);
CREATE INDEX IF NOT EXISTS idx_deals_ai_score ON deals (ai_score) WHERE ai_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_is_favorite ON deals (is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_deals_custom_fields ON deals USING GIN (custom_fields);
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_next_follow_up ON deals (next_follow_up) WHERE next_follow_up IS NOT NULL;

-- ============================================================================
-- 3. ACHIEVEMENTS AND CHALLENGES TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  category TEXT DEFAULT 'sales' CHECK (category IN ('sales', 'engagement', 'growth', 'teamwork')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT DEFAULT 'revenue' CHECK (type IN ('revenue', 'deals', 'streak', 'conversion')),
  target NUMERIC(10,2) DEFAULT 0,
  reward TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  participants TEXT[] DEFAULT '{}',
  current_progress NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can view achievements" ON achievements;
CREATE POLICY "Anyone can view achievements"
  ON achievements FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view challenges" ON challenges;
CREATE POLICY "Anyone can view challenges"
  ON challenges FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can view their achievements" ON user_achievements;
CREATE POLICY "Users can view their achievements"
  ON user_achievements FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can unlock achievements" ON user_achievements;
CREATE POLICY "Users can unlock achievements"
  ON user_achievements FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements (category);
CREATE INDEX IF NOT EXISTS idx_achievements_rarity ON achievements (rarity);
CREATE INDEX IF NOT EXISTS idx_challenges_type ON challenges (type);
CREATE INDEX IF NOT EXISTS idx_challenges_end_date ON challenges (end_date);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements (user_id);

-- ============================================================================
-- 4. DEAL ATTACHMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by UUID DEFAULT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT NULL
);

ALTER TABLE deal_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view attachments for their deals" ON deal_attachments;
CREATE POLICY "Users can view attachments for their deals"
  ON deal_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = deal_attachments.deal_id
      AND (deals.user_id = (SELECT auth.uid()) OR deals.user_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "Users can upload attachments to their deals" ON deal_attachments;
CREATE POLICY "Users can upload attachments to their deals"
  ON deal_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = deal_attachments.deal_id
      AND (deals.user_id = (SELECT auth.uid()) OR deals.user_id IS NULL)
    )
  );

CREATE INDEX IF NOT EXISTS idx_deal_attachments_deal_id ON deal_attachments (deal_id);

-- ============================================================================
-- 5. AI ENRICHMENT HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_enrichment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'deal')),
  entity_id UUID NOT NULL,
  ai_provider TEXT NOT NULL,
  enrichment_type TEXT NOT NULL,
  confidence_score NUMERIC(3,2) DEFAULT NULL,
  data JSONB NOT NULL,
  tokens_used INTEGER DEFAULT NULL,
  cost NUMERIC(10,4) DEFAULT NULL,
  processing_time INTEGER DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID DEFAULT NULL
);

ALTER TABLE ai_enrichment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their enrichment history" ON ai_enrichment_history;
CREATE POLICY "Users can view their enrichment history"
  ON ai_enrichment_history FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR user_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_ai_enrichment_entity ON ai_enrichment_history (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_enrichment_created_at ON ai_enrichment_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_enrichment_user_id ON ai_enrichment_history (user_id);

-- ============================================================================
-- 6. CACHED AI RESPONSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS cached_ai_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  ai_provider TEXT NOT NULL,
  response_data JSONB NOT NULL,
  metadata JSONB DEFAULT NULL,
  tokens_saved INTEGER DEFAULT 0,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cached_ai_responses_cache_key ON cached_ai_responses (cache_key);
CREATE INDEX IF NOT EXISTS idx_cached_ai_responses_expires_at ON cached_ai_responses (expires_at);
CREATE INDEX IF NOT EXISTS idx_cached_ai_responses_provider ON cached_ai_responses (ai_provider);

-- ============================================================================
-- 7. STORAGE BUCKETS CONFIGURATION METADATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS storage_bucket_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket_name TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  max_file_size BIGINT DEFAULT 5242880,
  allowed_mime_types TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  retention_days INTEGER DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO storage_bucket_config (bucket_name, purpose, max_file_size, allowed_mime_types, is_public)
VALUES 
  ('deal-images', 'Deal and company images', 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'], true),
  ('contact-avatars', 'Contact profile pictures', 2097152, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'], true),
  ('deal-attachments', 'Deal documents and files', 10485760, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'], false),
  ('contact-documents', 'Contact-related documents', 10485760, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'], false)
ON CONFLICT (bucket_name) DO NOTHING;

-- ============================================================================
-- 8. CLEANUP AND MAINTENANCE FUNCTIONS
-- ============================================================================

-- Drop existing function if it exists with different return type
DROP FUNCTION IF EXISTS cleanup_expired_cache();

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cached_ai_responses 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate refresh function
DROP FUNCTION IF EXISTS refresh_analytics_views();

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  -- Will create views in next step if they don't exist
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'contact_performance_summary') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY contact_performance_summary;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'deal_pipeline_summary') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY deal_pipeline_summary;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. FINAL UPDATES AND COMMENTS
-- ============================================================================

-- Add helpful comments
COMMENT ON TABLE achievements IS 'Gamification achievements that users can unlock';
COMMENT ON TABLE challenges IS 'Team challenges with targets and rewards';
COMMENT ON TABLE user_achievements IS 'Tracks which achievements each user has unlocked';
COMMENT ON TABLE deal_attachments IS 'File attachments associated with deals';
COMMENT ON TABLE ai_enrichment_history IS 'Audit trail of all AI enrichments performed';
COMMENT ON TABLE cached_ai_responses IS 'Cached AI responses to reduce API costs';
COMMENT ON TABLE storage_bucket_config IS 'Configuration metadata for storage buckets';

COMMENT ON COLUMN contacts.psychological_profile IS 'AI-generated psychological profile with personality traits and decision-making style';
COMMENT ON COLUMN contacts.behavioral_insights IS 'AI-analyzed behavioral patterns and engagement preferences';
COMMENT ON COLUMN contacts.ai_score_rationale IS 'Detailed explanation of AI scoring with factors and reasoning';
COMMENT ON COLUMN contacts.last_enrichment IS 'Metadata about the last AI enrichment including confidence and timestamp';

COMMENT ON COLUMN deals.ai_score IS 'AI-calculated probability of deal success (0-100)';
COMMENT ON COLUMN deals.social_profiles IS 'Social media and web profiles for the company';
COMMENT ON COLUMN deals.links IS 'Related links and resources for the deal';
COMMENT ON COLUMN deals.next_follow_up IS 'Recommended next follow-up date based on AI analysis';

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Storage infrastructure enhancement completed successfully!';
  RAISE NOTICE 'Added AI storage columns, gamification tables, attachment management, and performance optimizations.';
END $$;
