import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function initializeDatabase() {
  try {
    // Test the connection
    const { data, error } = await supabase
      .from('deals')
      .select('count')
      .limit(1);

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Database connection error:', error);
      throw error;
    }

    console.log('✅ Database connection established');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Database migration helper
export async function runMigrations() {
  const migrations = [
    // Deals table
    `
    CREATE TABLE IF NOT EXISTS deals (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      workspace_id UUID NOT NULL,
      title TEXT,
      company TEXT NOT NULL,
      contact TEXT NOT NULL,
      contact_id UUID,
      assigned_to_id UUID,
      assigned_to TEXT,
      value DECIMAL(15,2) NOT NULL DEFAULT 0,
      stage TEXT NOT NULL CHECK (stage IN ('qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
      probability DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
      due_date TIMESTAMP WITH TIME ZONE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      contact_avatar TEXT,
      company_avatar TEXT,
      last_activity TEXT,
      tags TEXT[] DEFAULT '{}',
      custom_fields JSONB DEFAULT '{}',
      is_favorite BOOLEAN DEFAULT FALSE,
      social_profiles JSONB DEFAULT '{}',
      last_enrichment JSONB,
      attachments JSONB DEFAULT '[]',
      links JSONB DEFAULT '[]',
      next_follow_up TEXT,
      ai_score DECIMAL(5,2),
      health_score DECIMAL(5,2),
      health_factors JSONB DEFAULT '[]',
      win_probability DECIMAL(5,2),
      probability_factors JSONB DEFAULT '[]',
      template_id UUID,
      timeline JSONB DEFAULT '[]',
      last_health_update TIMESTAMP WITH TIME ZONE,
      last_probability_update TIMESTAMP WITH TIME ZONE
    );
    `,

    // Contacts table
    `
    CREATE TABLE IF NOT EXISTS contacts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      workspace_id UUID NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      company TEXT,
      position TEXT,
      avatar TEXT,
      social_profiles JSONB DEFAULT '{}',
      tags TEXT[] DEFAULT '{}',
      custom_fields JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_activity TIMESTAMP WITH TIME ZONE,
      created_by UUID
    );
    `,

    // Deal activities table
    `
    CREATE TABLE IF NOT EXISTS deal_activities (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      metadata JSONB DEFAULT '{}',
      created_by UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    `,

    // Deal health factors table
    `
    CREATE TABLE IF NOT EXISTS deal_health_factors (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      score DECIMAL(5,2) NOT NULL,
      weight DECIMAL(5,2) NOT NULL,
      description TEXT,
      is_positive BOOLEAN DEFAULT TRUE,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    `,

    // Deal probability factors table
    `
    CREATE TABLE IF NOT EXISTS deal_probability_factors (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      impact DECIMAL(5,2) NOT NULL,
      confidence DECIMAL(5,2) NOT NULL,
      description TEXT,
      data JSONB DEFAULT '{}',
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    `,

    // Webhooks table
    `
    CREATE TABLE IF NOT EXISTS webhooks (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      workspace_id UUID NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT[] NOT NULL DEFAULT '{}',
      secret TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_triggered TIMESTAMP WITH TIME ZONE,
      failure_count INTEGER DEFAULT 0
    );
    `,

    // Integrations table
    `
    CREATE TABLE IF NOT EXISTS integrations (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      workspace_id UUID NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config JSONB NOT NULL DEFAULT '{}',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_sync TIMESTAMP WITH TIME ZONE,
      sync_status TEXT DEFAULT 'idle'
    );
    `,

    // API logs table
    `
    CREATE TABLE IF NOT EXISTS api_logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      workspace_id UUID NOT NULL,
      user_id UUID,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER,
      response_time INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    `,

    // Phase 10: Security & Compliance tables

    // Roles table
    `
    CREATE TABLE IF NOT EXISTS roles (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      permissions JSONB DEFAULT '[]',
      is_system_role BOOLEAN DEFAULT FALSE,
      workspace_id UUID,
      created_by UUID NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    `,

    // User roles table
    `
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id UUID NOT NULL,
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      workspace_id UUID NOT NULL,
      assigned_by UUID NOT NULL,
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE,
      PRIMARY KEY (user_id, role_id, workspace_id)
    );
    `,

    // Audit events table
    `
    CREATE TABLE IF NOT EXISTS audit_events (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      event_type TEXT NOT NULL,
      user_id UUID,
      workspace_id UUID NOT NULL,
      resource TEXT NOT NULL,
      resource_id UUID,
      action TEXT NOT NULL,
      details JSONB DEFAULT '{}',
      ip_address INET,
      user_agent TEXT,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      session_id TEXT,
      compliance_flags TEXT[] DEFAULT '{}'
    );
    `,

    // SSO configurations table
    `
    CREATE TABLE IF NOT EXISTS sso_configs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      workspace_id UUID NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('saml', 'oidc', 'google', 'microsoft', 'okta')),
      config JSONB NOT NULL DEFAULT '{}',
      is_active BOOLEAN DEFAULT FALSE,
      created_by UUID NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    `,

    // GDPR requests table
    `
    CREATE TABLE IF NOT EXISTS gdpr_requests (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL,
      workspace_id UUID NOT NULL,
      request_type TEXT NOT NULL CHECK (request_type IN ('access', 'rectification', 'erasure', 'restriction', 'portability', 'objection')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
      data JSONB,
      requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      completed_at TIMESTAMP WITH TIME ZONE,
      completed_by UUID,
      notes TEXT
    );
    `,

    // Data retention policies table
    `
    CREATE TABLE IF NOT EXISTS data_retention_policies (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('deals', 'contacts', 'activities', 'audit_logs')),
      retention_period INTEGER NOT NULL,
      deletion_method TEXT NOT NULL DEFAULT 'hard_delete' CHECK (deletion_method IN ('hard_delete', 'soft_delete', 'anonymize')),
      conditions JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT TRUE,
      created_by UUID NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    `,

    // Export requests table
    `
    CREATE TABLE IF NOT EXISTS export_requests (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL,
      workspace_id UUID NOT NULL,
      entity_type TEXT NOT NULL,
      filters JSONB DEFAULT '[]',
      fields TEXT[] DEFAULT '{}',
      format TEXT NOT NULL CHECK (format IN ('csv', 'json', 'xlsx', 'pdf')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      file_url TEXT,
      expires_at TIMESTAMP WITH TIME ZONE,
      requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      completed_at TIMESTAMP WITH TIME ZONE,
      record_count INTEGER,
      file_size INTEGER
    );
    `,

    // Export policies table
    `
    CREATE TABLE IF NOT EXISTS export_policies (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      entity_type TEXT NOT NULL,
      max_records INTEGER NOT NULL,
      max_file_size INTEGER NOT NULL,
      allowed_formats TEXT[] DEFAULT '{}',
      requires_approval BOOLEAN DEFAULT FALSE,
      approval_roles TEXT[] DEFAULT '{}',
      retention_period INTEGER NOT NULL,
      rate_limit JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT TRUE,
      created_by UUID NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    `,

    // Security alerts table
    `
    CREATE TABLE IF NOT EXISTS security_alerts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      workspace_id UUID NOT NULL,
      user_id UUID,
      details JSONB DEFAULT '{}',
      detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      resolved_at TIMESTAMP WITH TIME ZONE,
      resolved_by UUID,
      actions TEXT[] DEFAULT '{}'
    );
    `,

    // Security policies table
    `
    CREATE TABLE IF NOT EXISTS security_policies (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      rules JSONB DEFAULT '[]',
      actions JSONB DEFAULT '[]',
      is_active BOOLEAN DEFAULT TRUE,
      created_by UUID NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    `,

    // Data classifications table
    `
    CREATE TABLE IF NOT EXISTS data_classifications (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      level TEXT NOT NULL CHECK (level IN ('public', 'internal', 'confidential', 'restricted')),
      name TEXT NOT NULL,
      description TEXT,
      handling_requirements TEXT[] DEFAULT '{}',
      retention_period INTEGER NOT NULL,
      encryption_required BOOLEAN DEFAULT FALSE,
      access_requirements TEXT[] DEFAULT '{}'
    );
    `,

    // Indexes for performance
    `CREATE INDEX IF NOT EXISTS idx_deals_workspace_id ON deals(workspace_id);`,
    `CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);`,
    `CREATE INDEX IF NOT EXISTS idx_deals_assigned_to_id ON deals(assigned_to_id);`,
    `CREATE INDEX IF NOT EXISTS idx_contacts_workspace_id ON contacts(workspace_id);`,
    `CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);`,
    `CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);`,
    `CREATE INDEX IF NOT EXISTS idx_deal_activities_deal_id ON deal_activities(deal_id);`,
    `CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_id ON webhooks(workspace_id);`,
    `CREATE INDEX IF NOT EXISTS idx_integrations_workspace_id ON integrations(workspace_id);`,
    // Security & Compliance indexes
    `CREATE INDEX IF NOT EXISTS idx_roles_workspace_id ON roles(workspace_id);`,
    `CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_user_roles_workspace_id ON user_roles(workspace_id);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_events_workspace_id ON audit_events(workspace_id);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_sso_configs_workspace_id ON sso_configs(workspace_id);`,
    `CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user_id ON gdpr_requests(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_gdpr_requests_workspace_id ON gdpr_requests(workspace_id);`,
    `CREATE INDEX IF NOT EXISTS idx_export_requests_user_id ON export_requests(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_export_requests_workspace_id ON export_requests(workspace_id);`,
    `CREATE INDEX IF NOT EXISTS idx_security_alerts_workspace_id ON security_alerts(workspace_id);`,
    `CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(type);`,
  ];

  for (const migration of migrations) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: migration });
      if (error) {
        console.error('Migration error:', error);
      }
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }

  console.log('✅ Database migrations completed');
}