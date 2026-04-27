#!/usr/bin/env node

/**
 * Migration Runner for Twenty CRM Calendar Integration (Phase 6)
 *
 * This script applies the database migrations for calendar integration features.
 * Run this after deploying the code to ensure the database schema is up to date.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Starting Twenty CRM Calendar Integration Phase 6 migration...');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../../supabase/migrations/20260427050000_twenty_calendar_integration_phase6.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Applying database schema changes...');

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          console.error(`❌ Failed to execute statement:`, error);
          throw error;
        }
      }
    }

    console.log('✅ Database schema updated successfully');

    // Enable Phase 6 features
    console.log('🔧 Enabling Phase 6 feature flags...');

    const phase6Features = [
      'twenty_calendar_phase6',
      'calendar_oauth_google',
      'calendar_oauth_outlook',
      'calendar_bidirectional_sync',
      'calendar_meeting_scheduling',
      'calendar_event_linking',
      'deal_deadlines_calendar',
      'calendar_followup_reminders',
      'email_threading_auto_linking',
      'calendar_conflict_detection',
      'calendar_privacy_security'
    ];

    for (const featureKey of phase6Features) {
      const { error } = await supabase
        .from('feature_flags')
        .upsert({
          feature_key: featureKey,
          enabled: true,
          rollout_percentage: 100,
          description: `Phase 6 Calendar Integration: ${featureKey}`
        }, {
          onConflict: 'feature_key'
        });

      if (error) {
        console.warn(`⚠️  Failed to enable feature flag ${featureKey}:`, error);
      } else {
        console.log(`✅ Enabled feature flag: ${featureKey}`);
      }
    }

    console.log('🎉 Twenty CRM Calendar Integration Phase 6 migration completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Deploy the updated Netlify functions');
    console.log('2. Update your frontend to include the new calendar components');
    console.log('3. Configure OAuth credentials for Google Calendar and Outlook');
    console.log('4. Test the calendar integration features');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();