-- DDL: Create all tables first
CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  position TEXT,
  linkedin_url TEXT,
  twitter_handle TEXT,
  website TEXT,
  notes TEXT,
  tags TEXT[],
  avatar_url TEXT,
  is_team_member BOOLEAN DEFAULT FALSE,
  gamification_stats JSONB,
  ai_insights JSONB,
  behavioral_data JSONB,
  communication_history JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  contact TEXT,
  value DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  stage TEXT NOT NULL,
  probability INTEGER DEFAULT 0,
  expected_close_date DATE,
  notes TEXT,
  tags TEXT[],
  ai_score DECIMAL(3,2),
  custom_fields JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'deal')),
  entity_id UUID NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL,
  setting_value JSONB,
  user_id TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(setting_key, user_id)
);

-- DDL: Enable Row Level Security
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- DDL: Create policies
CREATE POLICY "Allow all operations for contacts" ON contacts FOR ALL USING (true);
CREATE POLICY "Allow all operations for deals" ON deals FOR ALL USING (true);
CREATE POLICY "Allow all operations for activities" ON activities FOR ALL USING (true);
CREATE POLICY "Allow all operations for app_settings" ON app_settings FOR ALL USING (true);

-- DDL: Create indexes
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(setting_key);

-- DML: Insert sample data (after all tables are created)
INSERT INTO contacts (name, email, company, position, notes) VALUES
('John Doe', 'john.doe@example.com', 'Tech Corp', 'CEO', 'Key decision maker'),
('Jane Smith', 'jane.smith@startup.io', 'Startup Inc', 'CTO', 'Technical lead'),
('Bob Johnson', 'bob@consulting.com', 'Consulting LLC', 'Consultant', 'External advisor');

INSERT INTO deals (title, company, contact, value, stage, probability, notes) VALUES
('Enterprise Software License', 'Tech Corp', 'John Doe', 50000.00, 'Proposal', 75, 'High-value enterprise deal'),
('Consulting Services', 'Startup Inc', 'Jane Smith', 25000.00, 'Negotiation', 60, 'Technical consulting project'),
('Partnership Agreement', 'Consulting LLC', 'Bob Johnson', 15000.00, 'Discovery', 30, 'Potential partnership opportunity');