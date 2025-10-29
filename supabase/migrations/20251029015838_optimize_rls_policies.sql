/*
  # Optimize RLS Policies for Performance

  1. **Performance Optimization**
    - Replaces `auth.uid()` with `(select auth.uid())` in all RLS policies
    - Prevents re-evaluation of auth functions for each row
    - Significantly improves query performance at scale

  2. **Tables Updated**
    - All tables with RLS policies using auth.uid()
    - Optimizes policies across contacts, deals, communications, analytics, and more

  3. **Security**
    - Maintains all existing security rules
    - No changes to access control logic
    - Only performance optimization

  Note: This migration recreates policies with optimized function calls.
  All existing security behavior is preserved.
*/

-- Journey Events Policies
DROP POLICY IF EXISTS "Users can view journey events for their contacts" ON journey_events;
CREATE POLICY "Users can view journey events for their contacts"
  ON journey_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = journey_events.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert journey events for their contacts" ON journey_events;
CREATE POLICY "Users can insert journey events for their contacts"
  ON journey_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = journey_events.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their journey events" ON journey_events;
CREATE POLICY "Users can update their journey events"
  ON journey_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = journey_events.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their journey events" ON journey_events;
CREATE POLICY "Users can delete their journey events"
  ON journey_events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = journey_events.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

-- App Content Metadata Policies
DROP POLICY IF EXISTS "Users can manage their own file metadata" ON app_content_metadata;
CREATE POLICY "Users can manage their own file metadata"
  ON app_content_metadata
  FOR ALL
  TO authenticated
  USING (uploaded_by = (select auth.uid()));

-- Assistant Reports Policies
DROP POLICY IF EXISTS "Users can manage their own reports" ON assistant_reports;
CREATE POLICY "Users can manage their own reports"
  ON assistant_reports
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Campaigns Policies
DROP POLICY IF EXISTS "Users can manage their campaigns" ON campaigns;
CREATE POLICY "Users can manage their campaigns"
  ON campaigns
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Communication Logs Policies
DROP POLICY IF EXISTS "Users can manage their communications" ON communication_logs;
CREATE POLICY "Users can manage their communications"
  ON communication_logs
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Apps Policies
DROP POLICY IF EXISTS "Users can view active apps for their context" ON apps;
CREATE POLICY "Users can view active apps for their context"
  ON apps FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (
      app_context = 'global'
      OR app_context = (select auth.jwt()->>'app_metadata'->>'app_context')
    )
  );

-- Content Templates Policies
DROP POLICY IF EXISTS "Users can manage their templates" ON content_templates;
CREATE POLICY "Users can manage their templates"
  ON content_templates
  FOR ALL
  TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can read public templates" ON content_templates;
CREATE POLICY "Users can read public templates"
  ON content_templates FOR SELECT
  TO authenticated
  USING (is_public = true OR created_by = (select auth.uid()));

-- Features Policies
DROP POLICY IF EXISTS "Users can view enabled features for their app" ON features;
CREATE POLICY "Users can view enabled features for their app"
  ON features FOR SELECT
  TO authenticated
  USING (
    is_enabled = true
    AND (
      app_context = 'global'
      OR app_context = (select auth.jwt()->>'app_metadata'->>'app_context')
    )
  );

-- Funnel Interactions Policies
DROP POLICY IF EXISTS "Users can view own interaction data" ON funnel_interactions;
CREATE POLICY "Users can view own interaction data"
  ON funnel_interactions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- LinkedIn Profiles Policies
DROP POLICY IF EXISTS "Users can manage their own LinkedIn profile data" ON linkedin_profiles;
CREATE POLICY "Users can manage their own LinkedIn profile data"
  ON linkedin_profiles
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage their profiles" ON linkedin_profiles;
CREATE POLICY "Users can manage their profiles"
  ON linkedin_profiles
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

-- OpenAI Embeddings Policies
DROP POLICY IF EXISTS "Users can manage their own embeddings" ON openai_embeddings;
CREATE POLICY "Users can manage their own embeddings"
  ON openai_embeddings
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Product Analyses Policies
DROP POLICY IF EXISTS "Users can manage their own analyses" ON product_analyses;
CREATE POLICY "Users can manage their own analyses"
  ON product_analyses
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Product Mappings Policies (admin only - using jwt claim)
DROP POLICY IF EXISTS "Product mappings are admin only" ON product_mappings;
CREATE POLICY "Product mappings are admin only"
  ON product_mappings
  FOR ALL
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'admin');

-- Purchase Events Policies (admin only)
DROP POLICY IF EXISTS "Purchase events are admin only" ON purchase_events;
CREATE POLICY "Purchase events are admin only"
  ON purchase_events
  FOR ALL
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'admin');

-- Pending Entitlements Policies
DROP POLICY IF EXISTS "Users can view pending entitlements for their email" ON pending_entitlements;
CREATE POLICY "Users can view pending entitlements for their email"
  ON pending_entitlements FOR SELECT
  TO authenticated
  USING (
    email = (select auth.jwt()->>'email')
  );

-- Partners Policies
DROP POLICY IF EXISTS "Partners are viewable by authenticated users" ON partners;
CREATE POLICY "Partners are viewable by authenticated users"
  ON partners FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Partners can be inserted by authenticated users" ON partners;
CREATE POLICY "Partners can be inserted by authenticated users"
  ON partners FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Partners can be updated by owners" ON partners;
CREATE POLICY "Partners can be updated by owners"
  ON partners FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()));

-- Stripe Tables Policies (admin only)
DROP POLICY IF EXISTS "Stripe checkout sessions admin only" ON stripe_checkout_sessions;
CREATE POLICY "Stripe checkout sessions admin only"
  ON stripe_checkout_sessions
  FOR ALL
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'admin');

DROP POLICY IF EXISTS "Stripe charges admin only" ON stripe_charges;
CREATE POLICY "Stripe charges admin only"
  ON stripe_charges
  FOR ALL
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'admin');

DROP POLICY IF EXISTS "Stripe customers admin only" ON stripe_customers;
CREATE POLICY "Stripe customers admin only"
  ON stripe_customers
  FOR ALL
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'admin');

DROP POLICY IF EXISTS "Stripe invoices admin only" ON stripe_invoices;
CREATE POLICY "Stripe invoices admin only"
  ON stripe_invoices
  FOR ALL
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'admin');

DROP POLICY IF EXISTS "Stripe payment intents admin only" ON stripe_payment_intents;
CREATE POLICY "Stripe payment intents admin only"
  ON stripe_payment_intents
  FOR ALL
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'admin');

DROP POLICY IF EXISTS "Stripe products admin only" ON stripe_products;
CREATE POLICY "Stripe products admin only"
  ON stripe_products
  FOR ALL
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'admin');

DROP POLICY IF EXISTS "Stripe prices admin only" ON stripe_prices;
CREATE POLICY "Stripe prices admin only"
  ON stripe_prices
  FOR ALL
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'admin');

DROP POLICY IF EXISTS "Stripe payment methods admin only" ON stripe_payment_methods;
CREATE POLICY "Stripe payment methods admin only"
  ON stripe_payment_methods
  FOR ALL
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'admin');

DROP POLICY IF EXISTS "Stripe subscriptions admin only" ON stripe_subscriptions;
CREATE POLICY "Stripe subscriptions admin only"
  ON stripe_subscriptions
  FOR ALL
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'admin');

-- Storage Usage Policies
DROP POLICY IF EXISTS "Users can view their own storage usage" ON storage_usage;
CREATE POLICY "Users can view their own storage usage"
  ON storage_usage FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Template Steps Policies
DROP POLICY IF EXISTS "Template steps viewable with template" ON template_steps;
CREATE POLICY "Template steps viewable with template"
  ON template_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM content_templates
      WHERE content_templates.id = template_steps.template_id
      AND (content_templates.is_public = true OR content_templates.created_by = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can manage steps in own templates" ON template_steps;
CREATE POLICY "Users can manage steps in own templates"
  ON template_steps
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM content_templates
      WHERE content_templates.id = template_steps.template_id
      AND content_templates.created_by = (select auth.uid())
    )
  );

-- Tenants Policies
DROP POLICY IF EXISTS "Users can view tenants they belong to" ON tenants;
CREATE POLICY "Users can view tenants they belong to"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_tenant_roles
      WHERE user_tenant_roles.tenant_id = tenants.id
      AND user_tenant_roles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners and admins can update tenants" ON tenants;
CREATE POLICY "Owners and admins can update tenants"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_tenant_roles
      WHERE user_tenant_roles.tenant_id = tenants.id
      AND user_tenant_roles.user_id = (select auth.uid())
      AND user_tenant_roles.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Only owners can delete tenants" ON tenants;
CREATE POLICY "Only owners can delete tenants"
  ON tenants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_tenant_roles
      WHERE user_tenant_roles.tenant_id = tenants.id
      AND user_tenant_roles.user_id = (select auth.uid())
      AND user_tenant_roles.role = 'owner'
    )
  );

-- Sync Jobs Policies (super admin only)
DROP POLICY IF EXISTS "Super admins can read all sync jobs" ON sync_jobs;
CREATE POLICY "Super admins can read all sync jobs"
  ON sync_jobs FOR SELECT
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'super_admin');

DROP POLICY IF EXISTS "Super admins can manage sync jobs" ON sync_jobs;
CREATE POLICY "Super admins can manage sync jobs"
  ON sync_jobs
  FOR ALL
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'super_admin');

-- User Preferences Policies
DROP POLICY IF EXISTS "Users can manage their own preferences" ON user_preferences;
CREATE POLICY "Users can manage their own preferences"
  ON user_preferences
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage their preferences" ON user_preferences;
CREATE POLICY "Users can manage their preferences"
  ON user_preferences
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

-- User Entitlements Policies
DROP POLICY IF EXISTS "Users can view own entitlements" ON user_entitlements;
CREATE POLICY "Users can view own entitlements"
  ON user_entitlements FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Usage Logs Policies
DROP POLICY IF EXISTS "Users can view their own usage logs" ON usage_logs;
CREATE POLICY "Users can view their own usage logs"
  ON usage_logs FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their usage logs" ON usage_logs;
CREATE POLICY "Users can view their usage logs"
  ON usage_logs FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Video Sharing Policies
DROP POLICY IF EXISTS "Users can view their own shared videos" ON video_sharing;
CREATE POLICY "Users can view their own shared videos"
  ON video_sharing FOR SELECT
  TO authenticated
  USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can share their own videos" ON video_sharing;
CREATE POLICY "Users can share their own videos"
  ON video_sharing FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own sharing settings" ON video_sharing;
CREATE POLICY "Users can update their own sharing settings"
  ON video_sharing FOR UPDATE
  TO authenticated
  USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own sharing settings" ON video_sharing;
CREATE POLICY "Users can delete their own sharing settings"
  ON video_sharing FOR DELETE
  TO authenticated
  USING (owner_id = (select auth.uid()));

-- Videos Policies
DROP POLICY IF EXISTS "Users can view their own videos" ON videos;
CREATE POLICY "Users can view their own videos"
  ON videos FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Video Analytics Policies
DROP POLICY IF EXISTS "Users can view their own video analytics" ON video_analytics;
CREATE POLICY "Users can view their own video analytics"
  ON video_analytics FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- White Label Configs Policies
DROP POLICY IF EXISTS "White-label configs are viewable by authenticated users" ON white_label_configs;
CREATE POLICY "White-label configs are viewable by authenticated users"
  ON white_label_configs FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "White-label configs can be inserted by authenticated users" ON white_label_configs;
CREATE POLICY "White-label configs can be inserted by authenticated users"
  ON white_label_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_tenant_roles
      WHERE user_tenant_roles.tenant_id = white_label_configs.tenant_id
      AND user_tenant_roles.user_id = (select auth.uid())
      AND user_tenant_roles.role = 'owner'
    )
  );

DROP POLICY IF EXISTS "White-label configs can be updated by tenant owners" ON white_label_configs;
CREATE POLICY "White-label configs can be updated by tenant owners"
  ON white_label_configs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_tenant_roles
      WHERE user_tenant_roles.tenant_id = white_label_configs.tenant_id
      AND user_tenant_roles.user_id = (select auth.uid())
      AND user_tenant_roles.role = 'owner'
    )
  );

-- Relationship Mappings Policies
DROP POLICY IF EXISTS "Users can view relationships for their contacts" ON relationship_mappings;
CREATE POLICY "Users can view relationships for their contacts"
  ON relationship_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = relationship_mappings.source_contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert relationships for their contacts" ON relationship_mappings;
CREATE POLICY "Users can insert relationships for their contacts"
  ON relationship_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = relationship_mappings.source_contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their relationships" ON relationship_mappings;
CREATE POLICY "Users can update their relationships"
  ON relationship_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = relationship_mappings.source_contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their relationships" ON relationship_mappings;
CREATE POLICY "Users can delete their relationships"
  ON relationship_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = relationship_mappings.source_contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

-- User Tenant Roles Policies
DROP POLICY IF EXISTS "Users can view their own tenant roles" ON user_tenant_roles;
CREATE POLICY "Users can view their own tenant roles"
  ON user_tenant_roles FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can add themselves as tenant owner" ON user_tenant_roles;
CREATE POLICY "Users can add themselves as tenant owner"
  ON user_tenant_roles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()) AND role = 'owner');

DROP POLICY IF EXISTS "Owners and admins can add users to tenant" ON user_tenant_roles;
CREATE POLICY "Owners and admins can add users to tenant"
  ON user_tenant_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_tenant_roles utr
      WHERE utr.tenant_id = user_tenant_roles.tenant_id
      AND utr.user_id = (select auth.uid())
      AND utr.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Owners and admins can update user roles" ON user_tenant_roles;
CREATE POLICY "Owners and admins can update user roles"
  ON user_tenant_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_tenant_roles utr
      WHERE utr.tenant_id = user_tenant_roles.tenant_id
      AND utr.user_id = (select auth.uid())
      AND utr.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Owners and admins can remove users from tenant" ON user_tenant_roles;
CREATE POLICY "Owners and admins can remove users from tenant"
  ON user_tenant_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_tenant_roles utr
      WHERE utr.tenant_id = user_tenant_roles.tenant_id
      AND utr.user_id = (select auth.uid())
      AND utr.role IN ('owner', 'admin')
    )
  );

-- Contact Insights Policies
DROP POLICY IF EXISTS "Users can view insights for their contacts" ON contact_insights;
CREATE POLICY "Users can view insights for their contacts"
  ON contact_insights FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_insights.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert insights for their contacts" ON contact_insights;
CREATE POLICY "Users can insert insights for their contacts"
  ON contact_insights FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_insights.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their insights" ON contact_insights;
CREATE POLICY "Users can update their insights"
  ON contact_insights FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_insights.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their insights" ON contact_insights;
CREATE POLICY "Users can delete their insights"
  ON contact_insights FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_insights.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

-- Contacts Policies
DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
CREATE POLICY "Users can view own contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own contacts" ON contacts;
CREATE POLICY "Users can create own contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
CREATE POLICY "Users can update own contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;
CREATE POLICY "Users can delete own contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Analyzed Documents Policies
DROP POLICY IF EXISTS "Users can manage their documents" ON analyzed_documents;
CREATE POLICY "Users can manage their documents"
  ON analyzed_documents
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own document analyses" ON analyzed_documents;
CREATE POLICY "Users can manage their own document analyses"
  ON analyzed_documents
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Dashboard Layouts Policies
DROP POLICY IF EXISTS "Users can manage their own dashboard layouts" ON dashboard_layouts;
CREATE POLICY "Users can manage their own dashboard layouts"
  ON dashboard_layouts
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Funnel Metrics Daily Policies
DROP POLICY IF EXISTS "Users can view own funnel metrics" ON funnel_metrics_daily;
CREATE POLICY "Users can view own funnel metrics"
  ON funnel_metrics_daily FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM funnels
      WHERE funnels.id = funnel_metrics_daily.funnel_id
      AND funnels.user_id = (select auth.uid())
    )
  );

-- Funnel Steps Policies
DROP POLICY IF EXISTS "Users can manage their funnel steps" ON funnel_steps;
CREATE POLICY "Users can manage their funnel steps"
  ON funnel_steps
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM funnels
      WHERE funnels.id = funnel_steps.funnel_id
      AND funnels.user_id = (select auth.uid())
    )
  );

-- Generated Content Policies
DROP POLICY IF EXISTS "Users can manage their content" ON generated_content;
CREATE POLICY "Users can manage their content"
  ON generated_content
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own content" ON generated_content;
CREATE POLICY "Users can manage their own content"
  ON generated_content
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Partner Customers Policies
DROP POLICY IF EXISTS "Partner customers are viewable by authenticated users" ON partner_customers;
CREATE POLICY "Partner customers are viewable by authenticated users"
  ON partner_customers FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Partner customers can be inserted by authenticated users" ON partner_customers;
CREATE POLICY "Partner customers can be inserted by authenticated users"
  ON partner_customers FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Personalization Settings Policies
DROP POLICY IF EXISTS "Users can manage their own personalization settings" ON personalization_settings;
CREATE POLICY "Users can manage their own personalization settings"
  ON personalization_settings
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Stripe Entitlements Policies
DROP POLICY IF EXISTS "Users can read own entitlements" ON stripe_entitlements;
CREATE POLICY "Users can read own entitlements"
  ON stripe_entitlements FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Super admins can read all entitlements" ON stripe_entitlements;
CREATE POLICY "Super admins can read all entitlements"
  ON stripe_entitlements FOR SELECT
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'super_admin');

DROP POLICY IF EXISTS "Super admins can manage entitlements" ON stripe_entitlements;
CREATE POLICY "Super admins can manage entitlements"
  ON stripe_entitlements
  FOR ALL
  TO authenticated
  USING ((select auth.jwt()->>'role') = 'super_admin');

-- User Business Profiles Policies
DROP POLICY IF EXISTS "Users can manage their own business profile" ON user_business_profiles;
CREATE POLICY "Users can manage their own business profile"
  ON user_business_profiles
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

-- User Integrations Policies
DROP POLICY IF EXISTS "Users can manage their integrations" ON user_integrations;
CREATE POLICY "Users can manage their integrations"
  ON user_integrations
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()));

-- User Roles Policies
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- User Upload Logs Policies
DROP POLICY IF EXISTS "Users can view their own upload logs" ON user_upload_logs;
CREATE POLICY "Users can view their own upload logs"
  ON user_upload_logs FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own upload logs" ON user_upload_logs;
CREATE POLICY "Users can insert their own upload logs"
  ON user_upload_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- Contact Activities Policies
DROP POLICY IF EXISTS "Users can view own contact activities" ON contact_activities;
CREATE POLICY "Users can view own contact activities"
  ON contact_activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_activities.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create own contact activities" ON contact_activities;
CREATE POLICY "Users can create own contact activities"
  ON contact_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_activities.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own contact activities" ON contact_activities;
CREATE POLICY "Users can update own contact activities"
  ON contact_activities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_activities.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own contact activities" ON contact_activities;
CREATE POLICY "Users can delete own contact activities"
  ON contact_activities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_activities.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

-- Communication Records Policies
DROP POLICY IF EXISTS "Users can view communications for their contacts" ON communication_records;
CREATE POLICY "Users can view communications for their contacts"
  ON communication_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = communication_records.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert communications for their contacts" ON communication_records;
CREATE POLICY "Users can insert communications for their contacts"
  ON communication_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = communication_records.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their communications" ON communication_records;
CREATE POLICY "Users can update their communications"
  ON communication_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = communication_records.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their communications" ON communication_records;
CREATE POLICY "Users can delete their communications"
  ON communication_records FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = communication_records.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

-- Contact Files Policies
DROP POLICY IF EXISTS "Users can view files for their contacts" ON contact_files;
CREATE POLICY "Users can view files for their contacts"
  ON contact_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_files.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert files for their contacts" ON contact_files;
CREATE POLICY "Users can insert files for their contacts"
  ON contact_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_files.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their files" ON contact_files;
CREATE POLICY "Users can update their files"
  ON contact_files FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_files.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their files" ON contact_files;
CREATE POLICY "Users can delete their files"
  ON contact_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_files.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

-- Contact Analytics Policies
DROP POLICY IF EXISTS "Users can view analytics for their contacts" ON contact_analytics;
CREATE POLICY "Users can view analytics for their contacts"
  ON contact_analytics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_analytics.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert analytics for their contacts" ON contact_analytics;
CREATE POLICY "Users can insert analytics for their contacts"
  ON contact_analytics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_analytics.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their analytics" ON contact_analytics;
CREATE POLICY "Users can update their analytics"
  ON contact_analytics FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_analytics.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their analytics" ON contact_analytics;
CREATE POLICY "Users can delete their analytics"
  ON contact_analytics FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_analytics.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

-- Engagement Patterns Policies
DROP POLICY IF EXISTS "Users can view patterns for their contacts" ON engagement_patterns;
CREATE POLICY "Users can view patterns for their contacts"
  ON engagement_patterns FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = engagement_patterns.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert patterns for their contacts" ON engagement_patterns;
CREATE POLICY "Users can insert patterns for their contacts"
  ON engagement_patterns FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = engagement_patterns.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their patterns" ON engagement_patterns;
CREATE POLICY "Users can update their patterns"
  ON engagement_patterns FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = engagement_patterns.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their patterns" ON engagement_patterns;
CREATE POLICY "Users can delete their patterns"
  ON engagement_patterns FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = engagement_patterns.contact_id
      AND contacts.user_id = (select auth.uid())
    )
  );

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()));
