@@ .. @@
 CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
 CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(setting_key);
+CREATE UNIQUE INDEX IF NOT EXISTS app_settings_setting_key_null_user_id_idx ON app_settings (setting_key) WHERE user_id IS NULL;
 
 -- DML: Insert sample data (after all tables are created)