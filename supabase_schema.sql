-- ==========================================================
-- ZECKSHARK SUPABASE COMPLETE CANONICAL SCHEMA & MIGRATION
-- ==========================================================
-- Instructions:
-- 1. Open Supabase Dashboard: https://supabase.com/dashboard/project/_/sql
-- 2. Click "New Query" (SQL Editor)
-- 3. Paste this ENTIRE file and click "Run" (Ctrl + Enter)
-- ==========================================================

-- ----------------------------------------------------------
-- 1. SETTINGS TABLE (Single Source of Truth for Admin Toggles)
-- ----------------------------------------------------------
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
  x_client_secret TEXT DEFAULT '',
  x_bearer_token TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT single_row_check CHECK (id = 1)
);

-- Insert canonical default row (id = 1)
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

-- Enable RLS for settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Explicit Table Grants for PostgreSQL Roles
GRANT SELECT, INSERT, UPDATE ON settings TO anon;
GRANT ALL ON settings TO authenticated;
GRANT ALL ON settings TO service_role;

-- 1. Public SELECT Policy: Anyone can read settings
DROP POLICY IF EXISTS "Public read settings" ON settings;
CREATE POLICY "Public read settings"
  ON settings FOR SELECT
  USING (true);

-- 2. Service Role Policy: Full backend bypass/access
DROP POLICY IF EXISTS "Service role update settings" ON settings;
DROP POLICY IF EXISTS "Service role insert settings" ON settings;
DROP POLICY IF EXISTS "Service role manage settings" ON settings;
CREATE POLICY "Service role manage settings"
  ON settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Authenticated Policy
DROP POLICY IF EXISTS "Authenticated manage settings" ON settings;
CREATE POLICY "Authenticated manage settings"
  ON settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Server-Side Custom Auth Policy:
-- Allows Express backend (connecting via SUPABASE_ANON_KEY or SUPABASE_KEY)
-- to update canonical settings strictly for row id = 1
DROP POLICY IF EXISTS "Allow update settings row 1" ON settings;
CREATE POLICY "Allow update settings row 1"
  ON settings FOR UPDATE
  TO anon
  USING (id = 1)
  WITH CHECK (id = 1);

DROP POLICY IF EXISTS "Allow insert settings row 1" ON settings;
CREATE POLICY "Allow insert settings row 1"
  ON settings FOR INSERT
  TO anon
  WITH CHECK (id = 1);


-- ----------------------------------------------------------
-- 2. SYSTEM_SETTINGS (Key-Value fallback table)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

GRANT ALL ON system_settings TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public read system_settings" ON system_settings;
CREATE POLICY "Public read system_settings"
  ON system_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role update system_settings" ON system_settings;
DROP POLICY IF EXISTS "Service role manage system_settings" ON system_settings;
CREATE POLICY "Service role manage system_settings"
  ON system_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon manage system_settings" ON system_settings;
CREATE POLICY "Allow anon manage system_settings"
  ON system_settings FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

INSERT INTO system_settings (key, value) VALUES
  ('waitlist_enabled', 'true'),
  ('applications_open', 'true'),
  ('wallet_checker_enabled', 'true')
ON CONFLICT (key) DO NOTHING;


-- ----------------------------------------------------------
-- 3. APPLICATIONS TABLE (Waitlist Submissions)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
  id BIGSERIAL PRIMARY KEY,
  application_code TEXT UNIQUE NOT NULL,
  user_id BIGINT,
  x_id TEXT NOT NULL,
  x_username TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure strict uniqueness per X user ID (Atomic Idempotence)
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_unique_x_id ON applications(x_id);
CREATE INDEX IF NOT EXISTS idx_applications_wallet ON applications(wallet_address);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created ON applications(created_at DESC);

-- Grants for PostgreSQL Roles
GRANT ALL ON applications TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read applications" ON applications;
CREATE POLICY "Public read applications"
  ON applications FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public insert applications" ON applications;
CREATE POLICY "Public insert applications"
  ON applications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow manage applications" ON applications;
DROP POLICY IF EXISTS "Service role manage applications" ON applications;
CREATE POLICY "Allow manage applications"
  ON applications FOR ALL
  USING (true)
  WITH CHECK (true);


-- ----------------------------------------------------------
-- 4. ELIGIBLE WALLETS TABLE (Wallet Eligibility Checker)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS eligible_wallets (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  notes TEXT,
  added_by TEXT DEFAULT 'SYSTEM',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eligible_wallets_address_unique ON eligible_wallets(wallet_address);

GRANT ALL ON eligible_wallets TO anon, authenticated, service_role;

ALTER TABLE eligible_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read eligible_wallets" ON eligible_wallets;
CREATE POLICY "Public read eligible_wallets"
  ON eligible_wallets FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow manage eligible_wallets" ON eligible_wallets;
DROP POLICY IF EXISTS "Service role manage eligible_wallets" ON eligible_wallets;
CREATE POLICY "Allow manage eligible_wallets"
  ON eligible_wallets FOR ALL
  USING (true)
  WITH CHECK (true);


-- ----------------------------------------------------------
-- 5. TASKS & TASK VERIFICATIONS (X Quests & Verification Flow)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  x_account TEXT,
  x_url TEXT,
  verification_type TEXT NOT NULL,
  sort_order INT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT ALL ON tasks TO anon, authenticated, service_role;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read tasks" ON tasks;
CREATE POLICY "Public read tasks"
  ON tasks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow manage tasks" ON tasks;
CREATE POLICY "Allow manage tasks"
  ON tasks FOR ALL
  USING (true)
  WITH CHECK (true);

-- Populate default tasks if empty
INSERT INTO tasks (id, name, description, x_account, x_url, verification_type, sort_order) VALUES
  (1, 'CONNECT X', 'Link your official X account to start the verification process.', 'zecshark', 'https://x.com/zecshark', 'OAUTH', 1),
  (2, 'FOLLOW @ZECSHARK', 'Follow the official @zecshark handle on X for project updates.', 'zecshark', 'https://x.com/zecshark', 'FOLLOW', 2),
  (3, 'REPOST ANNOUNCEMENT', 'Repost the official launch announcement on X.', 'zecshark', 'https://x.com/zecshark/status/1800000000000000000', 'REPOST', 3),
  (4, 'LIKE ANNOUNCEMENT', 'Like the official launch announcement on X.', 'zecshark', 'https://x.com/zecshark/status/1800000000000000000', 'LIKE', 4),
  (5, 'SUBMIT SHIELDED WALLET', 'Provide a valid Zcash Shielded address (Unified u1... or Sapling zs1...).', NULL, NULL, 'WALLET', 5)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS task_verifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  x_id TEXT,
  task_id INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VERIFIED',
  metadata JSONB,
  verified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_verifications_x_id ON task_verifications(x_id);
CREATE INDEX IF NOT EXISTS idx_task_verifications_user_id ON task_verifications(user_id);

GRANT ALL ON task_verifications TO anon, authenticated, service_role;

ALTER TABLE task_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read task_verifications" ON task_verifications;
CREATE POLICY "Public read task_verifications"
  ON task_verifications FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow manage task_verifications" ON task_verifications;
DROP POLICY IF EXISTS "Service role manage task_verifications" ON task_verifications;
CREATE POLICY "Allow manage task_verifications"
  ON task_verifications FOR ALL
  USING (true)
  WITH CHECK (true);
