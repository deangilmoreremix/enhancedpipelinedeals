/**
 * Complete Database and Feature Initialization for Twenty CRM + GTM Analytics
 * 
 * This script initializes:
 * 1. All missing database tables
 * 2. Feature flags (Twenty CRM + GTM + AI)
 * 3. Verifies installation
 */

import { getSupabaseService } from '../services/supabaseService';

export async function initializeAllFeatures(): Promise<void> {
  console.log('🚀 Starting complete feature initialization...');
  
  const supabaseService = getSupabaseService();
  
  // Wait for service to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    // 1. Initialize feature flags ( Twenty CRM + AI )
    console.log('📋 Initializing feature flags...');
    await initializeFeatureFlags(supabaseService);
    
    // 2. Verify critical tables exist
    console.log('🔍 Verifying database tables...');
    await verifyTables(supabaseService);
    
    // 3. Initialize app settings defaults
    console.log('⚙️ Initializing app settings...');
    await initializeAppSettings(supabaseService);
    
    console.log('✅ Feature initialization complete!');
  } catch (error) {
    console.error('❌ Feature initialization failed:', error);
    throw error;
  }
}

async function initializeFeatureFlags(supabaseService: any): Promise<void> {
  // Call the database function that seeds all flags
  const { error } = await supabaseService.supabase
    .rpc('initialize_all_feature_flags');
  
  if (error) {
    // If function doesn't exist yet, try inserting directly
    console.warn('⚠️ initialize_all_feature_flags function not found, inserting directly...');
    await insertFeatureFlagsDirectly(supabaseService);
  } else {
    console.log('✅ Feature flags initialized via RPC');
  }
}

async function insertFeatureFlagsDirectly(supabaseService: any): Promise<void> {
  const flags = [
    // Twenty CRM Phase 1-6
    { feature_key: 'twenty_kanban_aggregation', enabled: true, rollout_percentage: 100, description: 'Show aggregation metrics in kanban column headers' },
    { feature_key: 'twenty_wip_limits', enabled: true, rollout_percentage: 100, description: 'Enable Work-in-Progress limits on kanban columns' },
    { feature_key: 'twenty_custom_columns', enabled: true, rollout_percentage: 100, description: 'Allow users to create and customize pipeline columns' },
    { feature_key: 'deal_health_indicators', enabled: true, rollout_percentage: 100, description: 'Display deal health scores and factors' },
    { feature_key: 'win_probability_calculator', enabled: true, rollout_percentage: 100, description: 'Show win probability calculations and factors' },
    { feature_key: 'deal_templates_phase3', enabled: true, rollout_percentage: 100, description: 'Deal templates system with create-from-current' },
    { feature_key: 'bulk_deal_actions', enabled: true, rollout_percentage: 100, description: 'Bulk operations on multiple deals' },
    { feature_key: 'deal_timeline', enabled: true, rollout_percentage: 100, description: 'Visual timeline of deal activities and milestones' },
    { feature_key: 'advanced_table_view', enabled: true, rollout_percentage: 100, description: 'Advanced table view with custom columns, filtering, sorting' },
    { feature_key: 'advanced_kanban_view', enabled: true, rollout_percentage: 100, description: 'Enhanced kanban with drag-drop and WIP limits' },
    { feature_key: 'advanced_dashboard', enabled: true, rollout_percentage: 100, description: 'Customizable dashboard with real-time widgets' },
    { feature_key: 'advanced_calendar_view', enabled: true, rollout_percentage: 100, description: 'Calendar view for date-based deal visualization' },
    { feature_key: 'saved_views', enabled: true, rollout_percentage: 100, description: 'Save and share custom view configurations' },
    { feature_key: 'custom_metrics', enabled: true, rollout_percentage: 100, description: 'User-defined KPI calculations' },
    { feature_key: 'advanced_export', enabled: true, rollout_percentage: 100, description: 'Enhanced export capabilities (Excel, PDF, XML)' },
    { feature_key: 'advanced_filtering', enabled: true, rollout_percentage: 100, description: 'Complex filtering with AND/OR logic' },
    { feature_key: 'export_templates', enabled: false, rollout_percentage: 0, description: 'Save and reuse export configurations' },
    { feature_key: 'scheduled_reports', enabled: false, rollout_percentage: 0, description: 'Automated report generation and delivery' },
    { feature_key: 'twenty_workflow_automation', enabled: true, rollout_percentage: 100, description: 'Automated deal progression workflows' },
    { feature_key: 'twenty_workflow_phase5', enabled: false, rollout_percentage: 0, description: 'Advanced Phase 5 workflow features' },
    { feature_key: 'twenty_sla_monitoring', enabled: false, rollout_percentage: 0, description: 'Service Level Agreement tracking and alerts' },
    { feature_key: 'twenty_calendar_integration', enabled: true, rollout_percentage: 100, description: 'Calendar integration for meetings, deadlines, and reminders' },
    { feature_key: 'twenty_views_reporting', enabled: true, rollout_percentage: 100, description: 'Saved views and reporting features' },
    { feature_key: 'twenty_deal_templates', enabled: true, rollout_percentage: 100, description: 'Deal templates panel in deals section' },
    { feature_key: 'twenty_workflow_phase5_features', enabled: false, rollout_percentage: 0, description: 'Enhanced workflow panel with visual builder' },
    
    // AI Features (all disabled by default)
    { feature_key: 'ai_deal_scoring', enabled: false, rollout_percentage: 0, description: 'AI-powered deal qualification and scoring' },
    { feature_key: 'ai_deal_scoring_auto_refresh', enabled: false, rollout_percentage: 0, description: 'Auto-refresh deal scores based on activity' },
    { feature_key: 'ai_competitor_analysis', enabled: false, rollout_percentage: 0, description: 'AI analysis of competitive landscape' },
    { feature_key: 'ai_competitor_alerts', enabled: false, rollout_percentage: 0, description: 'Real-time alerts for competitive threats' },
    { feature_key: 'ai_deal_insights', enabled: false, rollout_percentage: 0, description: 'AI-generated recommendations for deal progression' },
    { feature_key: 'ai_predictive_analytics', enabled: false, rollout_percentage: 0, description: 'Predictive metrics and forecasting' },
    { feature_key: 'ai_automated_notes', enabled: false, rollout_percentage: 0, description: 'AI summarization of deal communications' },
    { feature_key: 'ai_action_item_extraction', enabled: false, rollout_percentage: 0, description: 'Extract action items from communications' },
    { feature_key: 'ai_chatbot', enabled: false, rollout_percentage: 0, description: 'Conversational assistant with CRM data access' },
    { feature_key: 'ai_context_awareness', enabled: false, rollout_percentage: 0, description: 'Page context awareness in AI interactions' },
    { feature_key: 'ai_natural_language_queries', enabled: false, rollout_percentage: 0, description: 'Natural language queries without navigation' },
    { feature_key: 'ai_workflow_agents', enabled: false, rollout_percentage: 0, description: 'Autonomous agents for multi-step workflow tasks' },
    { feature_key: 'ai_agent_collaboration', enabled: false, rollout_percentage: 0, description: 'Multi-agent collaboration in workflows' },
    { feature_key: 'ai_data_enrichment', enabled: false, rollout_percentage: 0, description: 'Enrich records from public sources' },
    { feature_key: 'ai_social_enrichment', enabled: false, rollout_percentage: 0, description: 'Social media and professional profile enrichment' },
    { feature_key: 'ai_firmographic_enrichment', enabled: false, rollout_percentage: 0, description: 'Company size, revenue, and industry data' },
    { feature_key: 'ai_record_classification', enabled: false, rollout_percentage: 0, description: 'Automatic categorization and classification' },
    { feature_key: 'ai_custom_classification', enabled: false, rollout_percentage: 0, description: 'Custom classification schemas' },
    { feature_key: 'ai_summary_generation', enabled: false, rollout_percentage: 0, description: 'AI-generated summaries and insights' },
    { feature_key: 'ai_executive_summaries', enabled: false, rollout_percentage: 0, description: 'Executive-level summaries and reports' },
    { feature_key: 'ai_custom_prompts', enabled: false, rollout_percentage: 0, description: 'Define custom AI prompts and templates' },
    { feature_key: 'ai_prompt_versioning', enabled: false, rollout_percentage: 0, description: 'Version control and performance tracking for prompts' },
    { feature_key: 'ai_performance_optimization', enabled: true, rollout_percentage: 100, description: 'Performance optimization for AI operations' },
    { feature_key: 'ai_privacy_protection', enabled: true, rollout_percentage: 100, description: 'Privacy and security for AI data processing' },
    { feature_key: 'ai_rate_limiting', enabled: true, rollout_percentage: 100, description: 'Rate limiting for AI API calls' }
  ];

  for (const flag of flags) {
    try {
      await supabaseService.supabase
        .from('feature_flags')
        .upsert(flag, { onConflict: 'feature_key' });
    } catch (err) {
      console.warn(`⚠️ Failed to insert flag ${flag.feature_key}:`, err);
    }
  }
  
  console.log(`✅ Inserted/updated ${flags.length} feature flags`);
}

async function verifyTables(supabaseService: any): Promise<void> {
  const requiredTables = [
    'feature_flags',
    'saved_pipeline_views',
    'deal_workflows',
    'deal_templates',
    'enhanced_activities',
    'activity_comments',
    'activity_subscriptions',
    'realtime_sync_status',
    'deal_scorings',
    'competitor_analyses',
    'deal_insights',
    'automated_notes',
    'action_items',
    'follow_ups',
    'data_enrichments',
    'record_classifications',
    'summary_generations',
    'custom_ai_prompts',
    'prompt_executions'
  ];

  const missingTables: string[] = [];

  for (const table of requiredTables) {
    try {
      const { data, error } = await supabaseService.supabase
        .from(table)
        .select('count')
        .limit(1);
      
      if (error && error.code === '42P01') { // undefined_table
        missingTables.push(table);
      }
    } catch (err) {
      const error = err as any;
      if (error.code === '42P01') {
        missingTables.push(table);
      }
    }
  }

  if (missingTables.length > 0) {
    throw new Error(`Missing required tables: ${missingTables.join(', ')}. Please run migrations first.`);
  }

  console.log(`✅ All ${requiredTables.length} required tables exist`);
}

async function initializeAppSettings(supabaseService: any): Promise<void> {
  // Set default app settings if not present
  const defaultSettings = [
    { key: 'default_deal_view', value: 'kanban' },
    { key: 'table_columns', value: ['title', 'company', 'value', 'stage', 'probability'] },
    { key: 'list_sort_by', value: 'updated' },
    { key: 'list_sort_order', value: 'desc' },
    { key: 'pipeline_columns', value: [
      { id: 'qualification', name: 'Qualification', position: 1, config: { color: 'border-blue-500', wipLimit: 10 }, is_active: true },
      { id: 'proposal', name: 'Proposal', position: 2, config: { color: 'border-indigo-500', wipLimit: 8 }, is_active: true },
      { id: 'negotiation', name: 'Negotiation', position: 3, config: { color: 'border-purple-500', wipLimit: 6 }, is_active: true },
      { id: 'closed-won', name: 'Closed Won', position: 4, config: { color: 'border-green-500', wipLimit: 0 }, is_active: true },
      { id: 'closed-lost', name: 'Closed Lost', position: 5, config: { color: 'border-red-500', wipLimit: 0 }, is_active: true }
    ]}
  ];

  for (const setting of defaultSettings) {
    try {
      await supabaseService.supabase
        .from('app_settings')
        .upsert({
          setting_key: setting.key,
          setting_value: setting.value,
          user_id: null // Global setting
        }, { onConflict: 'setting_key' });
    } catch (err) {
      console.warn(`⚠️ Failed to set default setting ${setting.key}:`, err);
    }
  }

  console.log(`✅ Set ${defaultSettings.length} default app settings`);
}

// Export for use in main.tsx
export { initializeAllFeatures };
