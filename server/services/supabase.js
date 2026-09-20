const { createClient } = require('@supabase/supabase-js');
const { db } = require('../db');

// Detect Supabase environment variables across standard names
const supabaseUrl = process.env.SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.VITE_SUPABASE_URL;

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                    process.env.SUPABASE_KEY || 
                    process.env.SUPABASE_ANON_KEY || 
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                    process.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
let isConfigured = false;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    isConfigured = true;
    console.log(`[Supabase] Client initialized for: ${supabaseUrl.replace(/^(https:\/\/[^.]+).*/, '$1.supabase.co')}`);
  } catch (err) {
    console.error('[Supabase Init Error] Failed to create Supabase client:', err.message);
  }
} else {
  console.warn('[Supabase Warning] Missing SUPABASE_URL or SUPABASE_KEY/SUPABASE_ANON_KEY environment variables.');
  console.warn('[Supabase Warning] Persistent settings will fall back to local database. On Vercel, please configure SUPABASE_URL and SUPABASE_ANON_KEY in project environment variables.');
}

/**
 * Normalizes boolean/string values into standard boolean
 */
function toBoolean(val, defaultVal = true) {
  if (val === undefined || val === null) return defaultVal;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'false' || s === '0' || s === 'off' || s === 'closed') return false;
    if (s === 'true' || s === '1' || s === 'on' || s === 'open') return true;
  }
  return defaultVal;
}

/**
 * Fetch settings from Supabase (Single Source of Truth)
 * Falls back to local database if Supabase is not configured or fails.
 */
async function getSettings() {
  if (isConfigured && supabase) {
    try {
      // 1. Try canonical settings table (id = 1)
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        // Log detailed error (e.g. table missing, RLS policy error)
        console.error(`[Supabase Error] SELECT settings failed: ${error.message} (Code: ${error.code})`);
        
        // Try fallback key-value table if canonical table doesn't exist
        const kvRes = await supabase.from('system_settings').select('key, value');
        if (!kvRes.error && kvRes.data && kvRes.data.length > 0) {
          const kvMap = {};
          for (const item of kvRes.data) {
            kvMap[item.key] = item.value;
          }
          console.log('[Supabase] SELECT system_settings (key-value) succeeded');
          return formatSettings({
            waitlist_enabled: toBoolean(kvMap.waitlist_enabled),
            applications_enabled: toBoolean(kvMap.applications_open || kvMap.applications_enabled),
            wallet_checker_enabled: toBoolean(kvMap.wallet_checker_enabled),
            ...kvMap
          }, 'supabase_kv');
        }
      } else if (data) {
        console.log(`[Supabase] SELECT settings succeeded: waitlist=${data.waitlist_enabled}, apps=${data.applications_enabled}, checker=${data.wallet_checker_enabled}`);
        return formatSettings(data, 'supabase');
      } else {
        // Table exists but row id=1 is missing - insert it
        console.warn('[Supabase Warning] Row id=1 missing in settings table. Attempting initialization...');
        const initRow = {
          id: 1,
          waitlist_enabled: true,
          applications_enabled: true,
          wallet_checker_enabled: true
        };
        const { data: inserted, error: insertErr } = await supabase
          .from('settings')
          .upsert(initRow)
          .select()
          .maybeSingle();

        if (!insertErr && inserted) {
          console.log('[Supabase] Initialized canonical settings row id=1');
          return formatSettings(inserted, 'supabase');
        }
      }
    } catch (err) {
      console.error('[Supabase Unexpected Error] getSettings failed:', err.message);
    }
  }

  // Fallback: Read from local SQLite database
  return await getLocalSettings();
}

/**
 * Update settings in Supabase
 * @param {Object} updates - Settings to update
 * @returns {Promise<{ success: boolean, settings?: Object, error?: string, source: string }>}
 */
async function updateSettings(updates) {
  // Normalize fields
  const normalized = {};

  if ('waitlist_enabled' in updates) {
    normalized.waitlist_enabled = toBoolean(updates.waitlist_enabled);
  }

  if ('applications_enabled' in updates || 'applications_open' in updates) {
    const val = 'applications_enabled' in updates ? updates.applications_enabled : updates.applications_open;
    normalized.applications_enabled = toBoolean(val);
  }

  if ('wallet_checker_enabled' in updates) {
    normalized.wallet_checker_enabled = toBoolean(updates.wallet_checker_enabled);
  }

  // Handle other text settings if present
  const textKeys = ['project_name', 'hero_headline', 'hero_subheadline', 'x_account_username', 'x_account_url', 'announcement_url', 'x_verification_mode', 'x_client_id', 'x_bearer_token'];
  for (const k of textKeys) {
    if (k in updates) {
      normalized[k] = String(updates[k]);
    }
  }

  normalized.updated_at = new Date().toISOString();

  // Always sync to local SQLite cache
  await syncToLocalDb(normalized);

  if (isConfigured && supabase) {
    try {
      // 1. Direct update for canonical settings table (id = 1)
      let { data, error } = await supabase
        .from('settings')
        .update(normalized)
        .eq('id', 1)
        .select()
        .maybeSingle();

      // If row id = 1 didn't exist yet, insert it
      if (!error && !data) {
        const insertRes = await supabase
          .from('settings')
          .insert({ id: 1, ...normalized })
          .select()
          .maybeSingle();
        data = insertRes.data;
        error = insertRes.error;
      }

      if (error) {
        console.error(`[Supabase Error] UPDATE settings failed: ${error.message} (Code: ${error.code})`);

        // Check fallback key-value table
        try {
          const kvRows = Object.entries(normalized)
            .filter(([k]) => k !== 'updated_at' && k !== 'id')
            .map(([key, value]) => ({ key, value: String(value), updated_at: new Date().toISOString() }));

          const kvUpsert = await supabase.from('system_settings').upsert(kvRows);
          if (!kvUpsert.error) {
            console.log('[Supabase] Fallback system_settings updated successfully');
            const current = await getSettings();
            return {
              success: true,
              settings: current,
              source: 'supabase_kv'
            };
          }
        } catch (kvErr) {
          // ignore kv fallback error
        }

        return {
          success: false,
          error: `Supabase error: ${error.message}. Please run the updated supabase_schema.sql in your Supabase SQL Editor or configure SUPABASE_SERVICE_ROLE_KEY in Vercel.`,
          source: 'supabase_error'
        };
      }

      console.log(`[Supabase] UPDATE settings succeeded: ${JSON.stringify(normalized)}`);

      // Asynchronously sync system_settings in background (non-blocking)
      (async () => {
        try {
          const kvRows = Object.entries(normalized)
            .filter(([k]) => k !== 'updated_at' && k !== 'id')
            .map(([key, value]) => ({ key, value: String(value), updated_at: new Date().toISOString() }));
          await supabase.from('system_settings').upsert(kvRows);
        } catch (_) {}
      })();

      return {
        success: true,
        settings: formatSettings(data || normalized, 'supabase'),
        source: 'supabase'
      };
    } catch (err) {
      console.error('[Supabase Unexpected Error] updateSettings failed:', err.message);
      return {
        success: false,
        error: `Supabase network/runtime error: ${err.message}`,
        source: 'supabase_error'
      };
    }
  }

  // Supabase not configured: update succeeded in local SQLite only
  console.warn('[Supabase Warning] Settings updated in local SQLite only (SUPABASE_URL not configured)');
  const localCurrent = await getLocalSettings();
  return {
    success: true,
    warning: 'Supabase credentials not configured in environment. Changes saved to local storage.',
    settings: localCurrent,
    source: 'local_sqlite'
  };
}

/**
 * Format raw settings row into standardized structure
 */
function formatSettings(raw, source = 'local') {
  const waitlistEnabled = toBoolean(raw.waitlist_enabled, true);
  const applicationsEnabled = toBoolean(raw.applications_enabled !== undefined ? raw.applications_enabled : raw.applications_open, true);
  const walletCheckerEnabled = toBoolean(raw.wallet_checker_enabled, true);

  return {
    // Canonical boolean properties
    waitlist_enabled: waitlistEnabled ? 'true' : 'false',
    applications_enabled: applicationsEnabled ? 'true' : 'false',
    applications_open: applicationsEnabled ? 'true' : 'false', // compatibility
    wallet_checker_enabled: walletCheckerEnabled ? 'true' : 'false',
    
    // Boolean types
    isWaitlistEnabled: waitlistEnabled,
    isApplicationsEnabled: applicationsEnabled,
    isWalletCheckerEnabled: walletCheckerEnabled,

    // Additional text settings
    project_name: raw.project_name || 'ZECKSHARK',
    hero_headline: raw.hero_headline || '2222 PIXEL SHARKS',
    hero_subheadline: raw.hero_subheadline || 'BUILT FOR THE ZCASH ECOSYSTEM',
    x_account_username: raw.x_account_username || 'zecshark',
    x_account_url: raw.x_account_url || 'https://x.com/zecshark',
    announcement_url: raw.announcement_url || 'https://x.com/zecshark/status/1800000000000000000',
    x_verification_mode: raw.x_verification_mode || 'DEMO',
    x_client_id: raw.x_client_id || '',
    x_bearer_token: raw.x_bearer_token || '',
    updated_at: raw.updated_at || new Date().toISOString(),

    // Metadata
    _source: source,
    _supabaseConfigured: isConfigured
  };
}

/**
 * Read settings from local database (SQLite)
 */
async function getLocalSettings() {
  try {
    const res = await db.execute('SELECT key, value, updated_at FROM settings');
    const map = {};
    for (const row of res.rows) {
      map[row.key] = row.value;
    }
    return formatSettings(map, 'local_sqlite');
  } catch (err) {
    console.error('[Database Error] Failed to read local settings:', err.message);
    return formatSettings({}, 'hardcoded_fallback');
  }
}

/**
 * Write settings to local database (SQLite)
 */
async function syncToLocalDb(updates) {
  try {
    for (const [key, val] of Object.entries(updates)) {
      if (key === 'id' || key === 'updated_at') continue;
      await db.execute({
        sql: `
          INSERT INTO settings (key, value, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `,
        args: [key, String(val)]
      });
      // Also map applications_open <-> applications_enabled
      if (key === 'applications_enabled') {
        await db.execute({
          sql: `
            INSERT INTO settings (key, value, updated_at)
            VALUES ('applications_open', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
          `,
          args: [String(val)]
        });
      }
    }
  } catch (err) {
    console.error('[Database Warning] syncToLocalDb error:', err.message);
  }
}

/**
 * Returns connection diagnostic status for Admin Health Check
 */
async function getStatus() {
  const status = {
    configured: isConfigured,
    url: supabaseUrl ? supabaseUrl.replace(/^(https:\/\/[^.]+).*/, '$1.supabase.co') : null,
    hasKey: Boolean(supabaseKey),
    keyType: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : (process.env.SUPABASE_ANON_KEY ? 'anon' : 'none'),
    tableExists: false,
    error: null
  };

  if (isConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('settings').select('id, waitlist_enabled').limit(1);
      if (error) {
        status.error = error.message;
      } else {
        status.tableExists = true;
      }
    } catch (e) {
      status.error = e.message;
    }
  }

  return status;
}

module.exports = {
  supabase,
  isConfigured: () => isConfigured,
  getSettings,
  updateSettings,
  getStatus,
  formatSettings
};
