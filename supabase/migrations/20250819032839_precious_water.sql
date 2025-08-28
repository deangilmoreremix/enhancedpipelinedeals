/*
  # Create app_settings table for user preferences

  1. New Tables
    - `app_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, nullable for global settings)
      - `setting_key` (text, e.g., 'default_deal_view')
      - `setting_value` (jsonb, stores preference data)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `app_settings` table
    - Add policy for users to manage their own settings
*/

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique constraint on user_id + setting_key to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_user_key_unique 
ON app_settings (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), setting_key);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own settings
CREATE POLICY "Users can manage own settings"
  ON app_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow anonymous users to manage global settings (for demo purposes)
CREATE POLICY "Anonymous users can manage global settings"
  ON app_settings
  FOR ALL
  TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_app_settings_updated_at_trigger
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_app_settings_updated_at();