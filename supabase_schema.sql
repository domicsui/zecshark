-- ==========================================================
-- ZECKSHARK SUPABASE CANONICAL SCHEMA & MIGRATION SCRIPT
-- ==========================================================
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql

-- 1. Create canonical settings table
CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1,
  waitlist_enabled BOOLEAN NOT NULL DEFAULT true,
  applications_enabled BOOLEAN NOT NULL DEFAULT true,
  wallet_checker_enabled BOOLEAN NOT NULL DEFAULT true,
  project_name TEXT DEFAULT 'ZECKSHARK',
  hero_headline TEXT DEFAULT '2222 PIXEL SHARKS',
  hero_subheadline TEXT DEFAULT 'BUILT FOR THE ZCASH ECOSYSTEM',
  x_account_username TEXT DEFAULT 'zecshark',
  x_account_url TEXT DEFAULT 'https://x.com/zecshark',
  announcement_url TEXT DEFAULT 'https://x.com/zecshark/status/1800000000000000000',
  x_verification_mode TEXT DEFAULT 'DEMO',
  x_client_id TEXT DEFAULT '',
  x_bearer_token TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT single_row_check CHECK (id = 1)
);

-- 2. Insert canonical default row (id = 1) if not exists
INSERT INTO settings (
  id, 
  waitlist_enabled, 
  applications_enabled, 
  wallet_checker_enabled,
  project_name,
  hero_headline,
  hero_subheadline,
  x_account_username,
  x_account_url,
  announcement_url,
  x_verification_mode
)
VALUES (
  1, 
  true, 
  true, 
  true,
  'ZECKSHARK',
  '2222 PIXEL SHARKS',
  'BUILT FOR THE ZCASH ECOSYSTEM',
  'zecshark',
  'https://x.com/zecshark',
  'https://x.com/zecshark/status/1800000000000000000',
  'DEMO'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Public read access for settings
-- The public site and anon users can safely view global project settings
DROP POLICY IF EXISTS "Public read settings" ON settings;
CREATE POLICY "Public read settings"
  ON settings FOR SELECT
  USING (true);

-- 5. RLS Policy: Service role or Authenticated Admin update access
-- The backend server uses the Service Role key (or authenticated admin) to update settings
DROP POLICY IF EXISTS "Service role update settings" ON settings;
CREATE POLICY "Service role update settings"
  ON settings FOR UPDATE
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role insert settings" ON settings;
CREATE POLICY "Service role insert settings"
  ON settings FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- 6. Also support key-value table format if preferred by existing infrastructure
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read system_settings" ON system_settings;
CREATE POLICY "Public read system_settings"
  ON system_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role update system_settings" ON system_settings;
CREATE POLICY "Service role update system_settings"
  ON system_settings FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

INSERT INTO system_settings (key, value) VALUES
  ('waitlist_enabled', 'true'),
  ('applications_open', 'true'),
  ('wallet_checker_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
