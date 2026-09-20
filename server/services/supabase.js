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
  const textKeys = ['project_name', 'hero_headline', 'hero_subheadline', 'x_account_username', 'x_account_url', 'announcement_url', 'x_verification_mode', 'x_client_id', 'x_client_secret', 'x_bearer_token'];
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
    x_client_secret: raw.x_client_secret || '',
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

/**
 * -------------------------------------------------------------
 * APPLICATION PERSISTENCE (Supabase Source of Truth)
 * -------------------------------------------------------------
 */

/**
 * Save application atomically & idempotently to Supabase
 * Prevents duplicates for the same X ID
 */
async function saveApplication({ applicationCode, userId, xId, xUsername, walletAddress, status = 'PENDING' }) {
  const cleanWallet = String(walletAddress).trim();
  const cleanUsername = String(xUsername).replace(/^@/, '').trim();
  const appCode = applicationCode || Math.floor(100000 + Math.random() * 900000).toString();
  let cleanUserId = userId !== undefined ? userId : null;
  const now = new Date().toISOString();

  // If userId is missing for local SQLite fallback, ensure a fallback user exists
  if (!cleanUserId) {
    try {
      const userRes = await db.execute('SELECT id FROM users LIMIT 1');
      if (userRes.rows.length > 0) {
        cleanUserId = userRes.rows[0].id;
      } else {
        const createRes = await db.execute({
          sql: 'INSERT INTO users (session_token, ip_address) VALUES (?, ?)',
          args: ['sys_' + Date.now(), '127.0.0.1']
        });
        cleanUserId = Number(createRes.lastInsertRowid) || 1;
      }
    } catch (_) {
      cleanUserId = 1;
    }
  }

  // Deduplication check for local SQLite if Supabase is not configured
  if (!isConfigured || !supabase) {
    try {
      const localExisting = await db.execute({
        sql: 'SELECT * FROM applications WHERE x_id = ?',
        args: [xId]
      });
      if (localExisting.rows.length > 0) {
        return {
          success: true,
          alreadyRegistered: true,
          isDuplicate: true,
          application: formatApplication(localExisting.rows[0]),
          source: 'local_sqlite'
        };
      }
    } catch (_) {}
  }

  // Always sync to local SQLite cache
  try {
    await db.execute({
      sql: `
        INSERT INTO applications (application_code, user_id, x_id, x_username, wallet_address, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(x_id) DO UPDATE SET 
          wallet_address = excluded.wallet_address,
          x_username = excluded.x_username,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [appCode, cleanUserId, xId, cleanUsername, cleanWallet, status]
    });
  } catch (localErr) {
    console.warn('[Local SQLite Warning] Failed caching application locally:', localErr.message);
  }

  // 1. If Supabase is configured, write directly to Supabase applications table
  if (isConfigured && supabase) {
    try {
      // First, check if user already has an application in Supabase (Idempotency)
      const { data: existing, error: selectErr } = await supabase
        .from('applications')
        .select('*')
        .eq('x_id', xId)
        .maybeSingle();

      if (selectErr) {
        console.error(`[Supabase Error] Check existing application failed: ${selectErr.message}`);
      }

      if (existing) {
        console.log(`[Supabase] Application already exists for x_id=${xId} (Code: ${existing.application_code})`);
        return {
          success: true,
          alreadyRegistered: true,
          isDuplicate: true,
          application: formatApplication(existing),
          source: 'supabase'
        };
      }

      // Insert new application into Supabase
      const { data: inserted, error: insertErr } = await supabase
        .from('applications')
        .insert({
          application_code: appCode,
          user_id: cleanUserId,
          x_id: xId,
          x_username: cleanUsername,
          wallet_address: cleanWallet,
          status: status,
          created_at: now,
          updated_at: now
        })
        .select()
        .maybeSingle();

      if (insertErr) {
        console.error(`[Supabase Error] INSERT application failed: ${insertErr.message} (Code: ${insertErr.code})`);

        // Check if error was race-condition unique constraint violation
        if (insertErr.code === '23505' || (insertErr.message && insertErr.message.includes('unique'))) {
          const { data: raceApp } = await supabase
            .from('applications')
            .select('*')
            .eq('x_id', xId)
            .maybeSingle();

          if (raceApp) {
            return {
              success: true,
              alreadyRegistered: true,
              isDuplicate: true,
              application: formatApplication(raceApp),
              source: 'supabase'
            };
          }
        }

        return {
          success: false,
          error: `Supabase write failed: ${insertErr.message}. Check RLS policies on 'applications' table.`,
          source: 'supabase_error'
        };
      }

      console.log(`[Supabase] Application successfully saved: ${inserted.application_code} for @${cleanUsername}`);
      return {
        success: true,
        alreadyRegistered: false,
        isDuplicate: false,
        application: formatApplication(inserted),
        source: 'supabase'
      };
    } catch (err) {
      console.error('[Supabase Unexpected Error] saveApplication failed:', err.message);
      return {
        success: false,
        error: `Supabase network/runtime error: ${err.message}`,
        source: 'supabase_error'
      };
    }
  }

  // Fallback if Supabase not configured: Return local SQLite record
  try {
    const localRes = await db.execute({
      sql: 'SELECT * FROM applications WHERE x_id = ?',
      args: [xId]
    });
    if (localRes.rows.length > 0) {
      return {
        success: true,
        alreadyRegistered: false,
        isDuplicate: false,
        application: formatApplication(localRes.rows[0]),
        source: 'local_sqlite'
      };
    }
  } catch (_) {}

  return {
    success: true,
    alreadyRegistered: false,
    isDuplicate: false,
    application: formatApplication({
      application_code: appCode,
      user_id: cleanUserId,
      x_id: xId,
      x_username: cleanUsername,
      wallet_address: cleanWallet,
      status: status,
      created_at: now
    }),
    source: 'local_sqlite'
  };
}

/**
 * Fetch application by X ID from Supabase
 */
async function getApplicationByXId(xId) {
  if (!xId) return null;

  if (isConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('x_id', xId)
        .maybeSingle();

      if (!error && data) {
        return formatApplication(data);
      }
    } catch (err) {
      console.error('[Supabase Error] getApplicationByXId failed:', err.message);
    }
  }

  // Fallback to local database
  try {
    const res = await db.execute({
      sql: 'SELECT * FROM applications WHERE x_id = ?',
      args: [xId]
    });
    if (res.rows.length > 0) {
      return formatApplication(res.rows[0]);
    }
  } catch (_) {}

  return null;
}

/**
 * Fetch applications list for Admin Panel (Supabase First)
 */
async function getApplications({ search, status, page = 1, limit = 50 } = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  if (isConfigured && supabase) {
    try {
      let query = supabase
        .from('applications')
        .select('*', { count: 'exact' });

      if (status && status !== 'ALL') {
        if (status !== 'ELIGIBLE' && status !== 'NOT ELIGIBLE') {
          query = query.eq('status', status);
        }
      }

      if (search && search.trim()) {
        const s = search.trim();
        query = query.or(`x_username.ilike.%${s}%,wallet_address.ilike.%${s}%,application_code.ilike.%${s}%,x_id.ilike.%${s}%`);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      const { data, count, error } = await query;

      if (!error && data) {
        // Fetch eligible wallets to mark is_wallet_eligible
        let eligibleSet = new Set();
        try {
          const { data: eligibleWallets } = await supabase
            .from('eligible_wallets')
            .select('wallet_address');
          if (eligibleWallets) {
            eligibleSet = new Set(eligibleWallets.map(w => String(w.wallet_address).toLowerCase()));
          }
        } catch (_) {}

        let rows = data.map(app => {
          const formatted = formatApplication(app);
          const isEligible = eligibleSet.has(String(formatted.walletAddress).toLowerCase()) ? 1 : 0;
          return {
            ...formatted,
            is_wallet_eligible: isEligible
          };
        });

        if (status === 'ELIGIBLE') {
          rows = rows.filter(r => r.is_wallet_eligible === 1);
        } else if (status === 'NOT ELIGIBLE') {
          rows = rows.filter(r => r.is_wallet_eligible === 0);
        }

        return {
          success: true,
          applications: rows,
          total: count !== null ? count : rows.length,
          page: pageNum,
          source: 'supabase'
        };
      } else if (error) {
        console.error(`[Supabase Error] SELECT applications failed: ${error.message}`);
      }
    } catch (err) {
      console.error('[Supabase Unexpected Error] getApplications failed:', err.message);
    }
  }

  // Fallback: Read from local SQLite
  return await getLocalApplications({ search, status, page: pageNum, limit: limitNum, offset });
}

/**
 * Fetch application counts for Admin Metrics (Supabase First)
 */
async function getApplicationMetrics() {
  if (isConfigured && supabase) {
    try {
      const [allRes, pendingRes, eligibleRes] = await Promise.all([
        supabase.from('applications').select('id', { count: 'exact', head: true }).neq('status', 'REJECTED'),
        supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('eligible_wallets').select('id', { count: 'exact', head: true })
      ]);

      const completed = allRes.count !== null ? allRes.count : 0;
      const pending = pendingRes.count !== null ? pendingRes.count : 0;
      const eligible = eligibleRes.count !== null ? eligibleRes.count : 0;

      return {
        totalRegisteredUsers: completed,
        completedApplications: completed,
        pendingApplications: pending,
        eligibleWallets: eligible,
        source: 'supabase'
      };
    } catch (err) {
      console.error('[Supabase Error] getApplicationMetrics failed:', err.message);
    }
  }

  // Fallback: Local SQLite counts
  try {
    const [totalRegistered, completedRes, pendingRes, eligibleRes] = await Promise.all([
      db.execute("SELECT COUNT(*) as count FROM applications WHERE status != 'REJECTED'"),
      db.execute("SELECT COUNT(*) as count FROM applications WHERE status != 'REJECTED'"),
      db.execute("SELECT COUNT(*) as count FROM applications WHERE status = 'PENDING'"),
      db.execute("SELECT COUNT(*) as count FROM eligible_wallets")
    ]);

    return {
      totalRegisteredUsers: Number(totalRegistered.rows[0].count),
      completedApplications: Number(completedRes.rows[0].count),
      pendingApplications: Number(pendingRes.rows[0].count),
      eligibleWallets: Number(eligibleRes.rows[0].count),
      source: 'local_sqlite'
    };
  } catch (err) {
    return {
      totalRegisteredUsers: 0,
      completedApplications: 0,
      pendingApplications: 0,
      eligibleWallets: 0,
      source: 'fallback'
    };
  }
}

/**
 * Update application status in Supabase
 */
async function updateApplicationStatus(idOrCode, newStatus) {
  const isNumeric = !isNaN(Number(idOrCode)) && Number(idOrCode) > 0;
  const now = new Date().toISOString();

  // Always sync to local SQLite
  try {
    if (isNumeric) {
      await db.execute({
        sql: 'UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [newStatus, Number(idOrCode)]
      });
    } else {
      await db.execute({
        sql: 'UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE application_code = ?',
        args: [newStatus, idOrCode]
      });
    }
  } catch (_) {}

  if (isConfigured && supabase) {
    try {
      let query = supabase.from('applications').update({
        status: newStatus,
        updated_at: now
      });

      if (isNumeric) {
        query = query.eq('id', Number(idOrCode));
      } else {
        query = query.eq('application_code', idOrCode);
      }

      const { data, error } = await query.select().maybeSingle();
      if (!error && data) {
        return { success: true, application: formatApplication(data), source: 'supabase' };
      } else if (error) {
        console.error(`[Supabase Error] UPDATE application status failed: ${error.message}`);
        return { success: false, error: error.message };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  return { success: true, message: 'Status updated in local cache.', source: 'local_sqlite' };
}

/**
 * Fallback to read applications from local SQLite
 */
async function getLocalApplications({ search, status, page, limit, offset }) {
  try {
    let query = `
      SELECT a.*, 
        CASE WHEN ew.id IS NOT NULL THEN 1 ELSE 0 END as is_wallet_eligible
      FROM applications a
      LEFT JOIN eligible_wallets ew ON LOWER(ew.wallet_address) = LOWER(a.wallet_address)
      WHERE 1=1
    `;
    const args = [];

    if (status && status !== 'ALL') {
      if (status === 'ELIGIBLE') {
        query += ' AND ew.id IS NOT NULL ';
      } else if (status === 'NOT ELIGIBLE') {
        query += ' AND ew.id IS NULL ';
      } else {
        query += ' AND a.status = ? ';
        args.push(status);
      }
    }

    if (search) {
      query += ' AND (a.x_username LIKE ? OR a.x_id LIKE ? OR a.wallet_address LIKE ? OR a.application_code LIKE ?) ';
      const s = `%${search}%`;
      args.push(s, s, s, s);
    }

    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ? ';
    args.push(limit, offset);

    const appsRes = await db.execute({ sql: query, args });
    const countRes = await db.execute('SELECT COUNT(*) as total FROM applications');

    return {
      success: true,
      applications: appsRes.rows.map(formatApplication),
      total: Number(countRes.rows[0].total),
      page,
      source: 'local_sqlite'
    };
  } catch (err) {
    console.error('[Database Error] Failed to read local applications:', err.message);
    return { success: false, applications: [], total: 0, page: 1, error: err.message };
  }
}

/**
 * Standardize application object format across backend & frontend
 */
function formatApplication(raw) {
  if (!raw) return null;
  return {
    id: raw.id || null,
    application_code: raw.application_code || raw.applicationCode || '',
    applicationCode: raw.application_code || raw.applicationCode || '',
    user_id: raw.user_id || raw.userId || null,
    x_id: raw.x_id || raw.xId || '',
    x_username: raw.x_username || raw.xUsername || '',
    xUsername: raw.x_username || raw.xUsername || '',
    wallet_address: raw.wallet_address || raw.walletAddress || '',
    walletAddress: raw.wallet_address || raw.walletAddress || '',
    status: raw.status || 'PENDING',
    created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    updated_at: raw.updated_at || raw.updatedAt || new Date().toISOString(),
    is_wallet_eligible: raw.is_wallet_eligible !== undefined ? raw.is_wallet_eligible : 0,
    completed_tasks_count: raw.completed_tasks_count !== undefined ? raw.completed_tasks_count : 5,
    total_tasks_count: raw.total_tasks_count !== undefined ? raw.total_tasks_count : 5
  };
}

/**
 * Fetch applications specifically formatted for CSV export
 */
async function getApplicationsForExport() {
  if (isConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('application_code, x_username, x_id, wallet_address, status, created_at')
        .neq('status', 'REJECTED')
        .order('id', { ascending: true });
      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.error('[Supabase Error] getApplicationsForExport failed:', err.message);
    }
  }

  try {
    const appsRes = await db.execute(`
      SELECT application_code, x_username, x_id, wallet_address, status, created_at 
      FROM applications 
      WHERE status != 'REJECTED'
      ORDER BY id ASC
    `);
    return appsRes.rows;
  } catch (err) {
    return [];
  }
}

module.exports = {
  supabase,
  isConfigured: () => isConfigured,
  getSettings,
  updateSettings,
  getStatus,
  formatSettings,
  saveApplication,
  getApplicationByXId,
  getApplications,
  getApplicationMetrics,
  updateApplicationStatus,
  getApplicationsForExport,
  formatApplication
};
