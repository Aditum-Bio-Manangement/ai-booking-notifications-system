-- Room Notification Settings Table
-- Stores custom notification configuration per room

CREATE TABLE IF NOT EXISTS room_notification_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL UNIQUE,
  room_email TEXT,
  custom_notifications_enabled BOOLEAN DEFAULT false,
  suppress_exchange_notifications BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_room_notification_settings_room_id 
  ON room_notification_settings(room_id);

-- Enable RLS
ALTER TABLE room_notification_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read notification settings
CREATE POLICY "Allow authenticated users to read room notification settings"
  ON room_notification_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to manage notification settings
CREATE POLICY "Allow authenticated users to manage room notification settings"
  ON room_notification_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Global notification settings table
CREATE TABLE IF NOT EXISTS global_notification_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default global settings
INSERT INTO global_notification_settings (setting_key, setting_value)
VALUES 
  ('custom_notifications_enabled', '{"enabled": false}'::jsonb),
  ('notification_email_from', '{"address": ""}'::jsonb),
  ('default_suppress_exchange', '{"enabled": false}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE global_notification_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read global settings
CREATE POLICY "Allow authenticated users to read global notification settings"
  ON global_notification_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to manage global settings
CREATE POLICY "Allow authenticated users to manage global notification settings"
  ON global_notification_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
