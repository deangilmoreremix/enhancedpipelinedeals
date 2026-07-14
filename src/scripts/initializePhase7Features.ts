/**
 * Phase 7 AI Enhancements Feature Flags Initialization
 * Initialize feature flags for gradual rollout of AI features
 */

import { getSupabaseService } from './supabaseService';

export async function initializePhase7FeatureFlags(): Promise<void> {
  try {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    const featureFlags = [
      // Deal Scoring
      {
        feature_key: 'ai_deal_scoring',
        enabled: false,
        rollout_percentage: 0,
        description: 'AI-powered deal qualification and scoring'
      },
      {
        feature_key: 'ai_deal_scoring_auto_refresh',
        enabled: false,
        rollout_percentage: 0,
        description: 'Automatically refresh deal scores based on activity'
      },

      // Competitor Analysis
      {
        feature_key: 'ai_competitor_analysis',
        enabled: false,
        rollout_percentage: 0,
        description: 'AI analysis of competitive landscape'
      },
      {
        feature_key: 'ai_competitor_alerts',
        enabled: false,
        rollout_percentage: 0,
        description: 'Real-time alerts for competitive threats'
      },

      // Deal Insights
      {
        feature_key: 'ai_deal_insights',
        enabled: false,
        rollout_percentage: 0,
        description: 'AI-generated recommendations for deal progression'
      },
      {
        feature_key: 'ai_predictive_analytics',
        enabled: false,
        rollout_percentage: 0,
        description: 'Predictive metrics and forecasting'
      },

      // Automated Note Taking
      {
        feature_key: 'ai_automated_notes',
        enabled: false,
        rollout_percentage: 0,
        description: 'AI summarization of deal communications'
      },
      {
        feature_key: 'ai_action_item_extraction',
        enabled: false,
        rollout_percentage: 0,
        description: 'Extract action items from communications'
      },

      // AI Chatbot
      {
        feature_key: 'ai_chatbot',
        enabled: false,
        rollout_percentage: 0,
        description: 'Conversational assistant with CRM data access'
      },
      {
        feature_key: 'ai_context_awareness',
        enabled: false,
        rollout_percentage: 0,
        description: 'Page context awareness in AI interactions'
      },
      {
        feature_key: 'ai_natural_language_queries',
        enabled: false,
        rollout_percentage: 0,
        description: 'Natural language queries without navigation'
      },

      // AI Agents in Workflows
      {
        feature_key: 'ai_workflow_agents',
        enabled: false,
        rollout_percentage: 0,
        description: 'Autonomous agents for multi-step workflow tasks'
      },
      {
        feature_key: 'ai_agent_collaboration',
        enabled: false,
        rollout_percentage: 0,
        description: 'Multi-agent collaboration in workflows'
      },

      // Data Enrichment
      {
        feature_key: 'ai_data_enrichment',
        enabled: false,
        rollout_percentage: 0,
        description: 'Enrich records from public sources'
      },
      {
        feature_key: 'ai_social_enrichment',
        enabled: false,
        rollout_percentage: 0,
        description: 'Social media and professional profile enrichment'
      },
      {
        feature_key: 'ai_firmographic_enrichment',
        enabled: false,
        rollout_percentage: 0,
        description: 'Company size, revenue, and industry data'
      },

      // Record Classification
      {
        feature_key: 'ai_record_classification',
        enabled: false,
        rollout_percentage: 0,
        description: 'Automatic categorization and classification'
      },
      {
        feature_key: 'ai_custom_classification',
        enabled: false,
        rollout_percentage: 0,
        description: 'Custom classification schemas'
      },

      // Summary Generation
      {
        feature_key: 'ai_summary_generation',
        enabled: false,
        rollout_percentage: 0,
        description: 'AI-generated summaries and insights'
      },
      {
        feature_key: 'ai_executive_summaries',
        enabled: false,
        rollout_percentage: 0,
        description: 'Executive-level summaries and reports'
      },

      // Custom AI Prompts
      {
        feature_key: 'ai_custom_prompts',
        enabled: false,
        rollout_percentage: 0,
        description: 'Define custom AI prompts and templates'
      },
      {
        feature_key: 'ai_prompt_versioning',
        enabled: false,
        rollout_percentage: 0,
        description: 'Version control and performance tracking for prompts'
      },

      // Performance and Security
      {
        feature_key: 'ai_performance_optimization',
        enabled: true,
        rollout_percentage: 100,
        description: 'Performance optimization for AI operations'
      },
      {
        feature_key: 'ai_privacy_protection',
        enabled: true,
        rollout_percentage: 100,
        description: 'Privacy and security for AI data processing'
      },
      {
        feature_key: 'ai_rate_limiting',
        enabled: true,
        rollout_percentage: 100,
        description: 'Rate limiting for AI API calls'
      }
    ];

    // Insert feature flags
    const { error } = await supabase
      .from('feature_flags')
      .upsert(featureFlags, { onConflict: 'feature_key' });

    if (error) {
      console.error('Failed to initialize Phase 7 feature flags:', error);
      throw error;
    }

    console.log('✅ Phase 7 AI Enhancements feature flags initialized successfully');

    // Create database tables if they don't exist
    await createPhase7Tables();

  } catch (error) {
    console.error('Failed to initialize Phase 7 feature flags:', error);
    throw error;
  }
}

async function createPhase7Tables(): Promise<void> {
  try {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    // SQL to create necessary tables for Phase 7 features
    const createTablesSQL = `
      -- Deal Scorings Table
      CREATE TABLE IF NOT EXISTS deal_scorings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id UUID NOT NULL,
        overall_score DECIMAL(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
        qualification_level TEXT NOT NULL CHECK (qualification_level IN ('cold', 'warm', 'hot', 'qualified', 'sales_ready')),
        scoring_factors JSONB,
        confidence DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
        last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ai_provider TEXT NOT NULL DEFAULT 'openai',
        model_version TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(deal_id)
      );

      -- Competitor Analyses Table
      CREATE TABLE IF NOT EXISTS competitor_analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id UUID NOT NULL,
        primary_competitors JSONB,
        competitive_position TEXT NOT NULL CHECK (competitive_position IN ('leading', 'competitive', 'challenged', 'losing')),
        threats JSONB,
        opportunities JSONB,
        recommendations TEXT[],
        last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        confidence DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(deal_id)
      );

      -- Deal Insights Table
      CREATE TABLE IF NOT EXISTS deal_insights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id UUID NOT NULL,
        progression_insights JSONB,
        risk_assessments JSONB,
        action_recommendations JSONB,
        predictive_metrics JSONB,
        communication_suggestions JSONB,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        confidence DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
        ai_provider TEXT NOT NULL DEFAULT 'openai',
        model_version TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Automated Notes Table
      CREATE TABLE IF NOT EXISTS automated_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id UUID NOT NULL,
        contact_id UUID NOT NULL,
        communication_id UUID NOT NULL,
        summary TEXT NOT NULL,
        key_points TEXT[],
        sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
        action_items JSONB,
        follow_ups JSONB,
        tags TEXT[],
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        confidence DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
        ai_provider TEXT NOT NULL DEFAULT 'openai',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(communication_id)
      );

      -- Action Items Table
      CREATE TABLE IF NOT EXISTS action_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id UUID,
        communication_id UUID,
        description TEXT NOT NULL,
        priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
        assignee TEXT,
        due_date TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Follow-ups Table
      CREATE TABLE IF NOT EXISTS follow_ups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id UUID,
        communication_id UUID,
        type TEXT NOT NULL CHECK (type IN ('email', 'call', 'meeting', 'task')),
        description TEXT NOT NULL,
        timing TEXT,
        priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Data Enrichments Table
      CREATE TABLE IF NOT EXISTS data_enrichments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_id UUID NOT NULL,
        entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal')),
        enrichment_type TEXT NOT NULL CHECK (enrichment_type IN ('social', 'firmographic', 'technographic', 'intent', 'news')),
        source TEXT NOT NULL,
        data JSONB,
        confidence DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
        last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ai_provider TEXT NOT NULL DEFAULT 'openai',
        cost DECIMAL(10,4),
        status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Record Classifications Table
      CREATE TABLE IF NOT EXISTS record_classifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_id UUID NOT NULL,
        entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal')),
        classifications JSONB,
        primary_category TEXT NOT NULL,
        secondary_categories TEXT[],
        confidence DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
        classified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        classifier_version TEXT NOT NULL,
        user_feedback BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(entity_id, entity_type)
      );

      -- Summary Generations Table
      CREATE TABLE IF NOT EXISTS summary_generations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_id UUID NOT NULL,
        entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal')),
        summary_type TEXT NOT NULL CHECK (summary_type IN ('executive', 'detailed', 'bullet_points', 'timeline', 'risk_analysis')),
        content TEXT NOT NULL,
        key_insights TEXT[],
        recommendations TEXT[],
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ai_provider TEXT NOT NULL DEFAULT 'openai',
        model_version TEXT NOT NULL,
        confidence DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
        word_count INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Custom AI Prompts Table
      CREATE TABLE IF NOT EXISTS custom_ai_prompts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL CHECK (category IN ('scoring', 'analysis', 'communication', 'classification', 'enrichment', 'general')),
        prompt_template TEXT NOT NULL,
        variables JSONB,
        model TEXT NOT NULL DEFAULT 'gpt-4o',
        temperature DECIMAL(3,2) NOT NULL DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
        max_tokens INTEGER NOT NULL DEFAULT 2000,
        system_message TEXT,
        examples JSONB,
        version TEXT NOT NULL DEFAULT '1.0.0',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        usage_count INTEGER NOT NULL DEFAULT 0,
        performance_metrics JSONB
      );

      -- Prompt Executions Table
      CREATE TABLE IF NOT EXISTS prompt_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prompt_id UUID NOT NULL REFERENCES custom_ai_prompts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        variables JSONB,
        success BOOLEAN NOT NULL,
        execution_time INTEGER NOT NULL,
        confidence DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_deal_scorings_deal_id ON deal_scorings(deal_id);
      CREATE INDEX IF NOT EXISTS idx_competitor_analyses_deal_id ON competitor_analyses(deal_id);
      CREATE INDEX IF NOT EXISTS idx_deal_insights_deal_id ON deal_insights(deal_id);
      CREATE INDEX IF NOT EXISTS idx_automated_notes_communication_id ON automated_notes(communication_id);
      CREATE INDEX IF NOT EXISTS idx_data_enrichments_entity ON data_enrichments(entity_id, entity_type);
      CREATE INDEX IF NOT EXISTS idx_record_classifications_entity ON record_classifications(entity_id, entity_type);
      CREATE INDEX IF NOT EXISTS idx_custom_ai_prompts_category ON custom_ai_prompts(category);
      CREATE INDEX IF NOT EXISTS idx_prompt_executions_prompt_id ON prompt_executions(prompt_id);
    `;

    // Execute the SQL to create tables
    const { error } = await supabase.rpc('exec_sql', { sql: createTablesSQL });

    if (error) {
      console.warn('Could not create tables via RPC, they may already exist:', error);
    } else {
      console.log('✅ Phase 7 database tables created successfully');
    }

  } catch (error) {
    console.error('Failed to create Phase 7 database tables:', error);
    // Don't throw here as tables might already exist
  }
}

// Export for use in other parts of the application
export { initializePhase7FeatureFlags };