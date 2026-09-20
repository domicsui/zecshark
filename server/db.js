const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const path = require('path');
const EventEmitter = require('events');

const statsEvents = new EventEmitter();
statsEvents.setMaxListeners(100);

let dbUrl;
if (process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL) {
  dbUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
} else if (process.env.VERCEL) {
  dbUrl = 'file:/tmp/zeckshark.db';
} else {
  const dbPath = path.resolve(__dirname, '..', 'zeckshark.db');
  dbUrl = 'file:' + dbPath.replace(/\\/g, '/');
}

const db = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function initDB() {
  await db.execute('PRAGMA foreign_keys = ON');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      x_account TEXT,
      x_url TEXT,
      verification_type TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      is_enabled INTEGER DEFAULT 1,
      is_archived INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_token TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS x_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      x_id TEXT UNIQUE NOT NULL,
      x_username TEXT NOT NULL,
      display_name TEXT,
      profile_image_url TEXT,
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS task_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      x_id TEXT,
      task_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      UNIQUE(user_id, task_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    )
  `);

  try {
    await db.execute('ALTER TABLE task_verifications ADD COLUMN x_id TEXT');
  } catch (err) {
    // Column already exists
  }
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_task_verifications_x_id ON task_verifications(x_id)');
  } catch (err) {
    // Index may already exist
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_code TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      x_id TEXT UNIQUE NOT NULL,
      x_username TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS eligible_wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT UNIQUE NOT NULL,
      notes TEXT,
      added_by TEXT DEFAULT 'SYSTEM',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_username TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const adminCheck = await db.execute({
    sql: 'SELECT id FROM admins WHERE username = ?',
    args: ['admin']
  });
  if (adminCheck.rows.length === 0) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('zeckshark2026!', salt);
    await db.execute({
      sql: 'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
      args: ['admin', hash]
    });
  }

  const defaultSettings = [
    ['project_name', 'ZECKSHARK'],
    ['hero_headline', '2222 PIXEL SHARKS'],
    ['hero_subheadline', 'BUILT FOR THE ZCASH ECOSYSTEM'],
    ['waitlist_enabled', 'true'],
    ['applications_open', 'true'],
    ['wallet_checker_enabled', 'true'],
    ['x_account_username', 'zecshark'],
    ['x_account_url', 'https://x.com/zecshark'],
    ['announcement_url', 'https://x.com/zecshark/status/1800000000000000000'],
    ['x_verification_mode', 'DEMO'],
    ['x_client_id', ''],
    ['x_bearer_token', '']
  ];

  for (const [key, val] of defaultSettings) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      args: [key, val]
    });
  }

  const tasksCheck = await db.execute('SELECT COUNT(*) as count FROM tasks');
  if (Number(tasksCheck.rows[0].count) === 0) {
    const initialTasks = [
      {
        name: 'CONNECT X',
        description: 'Connect your official X profile to establish your Web3 identity.',
        x_account: '@zecshark',
        x_url: 'https://x.com/zecshark',
        verification_type: 'CONNECT_X',
        sort_order: 1
      },
      {
        name: 'FOLLOW ZECKSHARK',
        description: 'Follow @zecshark on X to stay synchronized with official collection drops.',
        x_account: '@zecshark',
        x_url: 'https://x.com/zecshark',
        verification_type: 'FOLLOW',
        sort_order: 2
      },
      {
        name: 'LIKE + REPOST',
        description: 'Like and Repost our Genesis Announcement to propagate the signal.',
        x_account: '@zecshark',
        x_url: 'https://x.com/zecshark/status/1800000000000000000',
        verification_type: 'LIKE_RETWEET',
        sort_order: 3
      },
      {
        name: 'QUOTE TWEET',
        description: 'Quote Tweet the announcement with #ZECKSHARK #Zcash and tag 2 frens.',
        x_account: '@zecshark',
        x_url: 'https://x.com/zecshark/status/1800000000000000000',
        verification_type: 'QUOTE',
        sort_order: 4
      },
      {
        name: 'COMMENT',
        description: 'Leave an arcade comment on our post explaining why you want to swim in Zcash waters.',
        x_account: '@zecshark',
        x_url: 'https://x.com/zecshark/status/1800000000000000000',
        verification_type: 'COMMENT',
        sort_order: 5
      }
    ];

    for (const t of initialTasks) {
      await db.execute({
        sql: 'INSERT INTO tasks (name, description, x_account, x_url, verification_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        args: [t.name, t.description, t.x_account, t.x_url, t.verification_type, t.sort_order]
      });
    }
  }

  const sampleWallets = [
    ['u1ga08vee50u870vhfswr6s5p6gxgtl2nx8x3ujty2qx20lxgvmgv8mux2snn5ye3pg2h4rvkcx2e4crjl98qh8sw9glaq04wcj8pra8he00kxxssa8akhp7y5rv05qw1phqqhrd47y50ct4vuzdkw0yqt3eleldfh58a6x6xqjuv5cuam', 'Genesis Official Shielded u1 Wallet'],
    ['zs1z7rejlpsa98s2rrrfkwmaxu53e4ue0ulcrw0h4x5g8emcvtqmumahttv4ymvd2hs20qxxudq02m', 'Genesis Shielded Sapling Shark']
  ];

  for (const [w, note] of sampleWallets) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO eligible_wallets (wallet_address, notes, added_by) VALUES (?, ?, ?)',
      args: [w.toLowerCase(), note, 'GENESIS_SEED']
    });
  }
}

async function getRegisteredUsersCount() {
  const res = await db.execute(`
    SELECT COUNT(DISTINCT user_id) as total 
    FROM applications 
    WHERE status != 'REJECTED'
  `);
  return Number(res.rows[0].total || 0);
}

async function logAudit(admin_username, action, target, details = '') {
  try {
    await db.execute({
      sql: 'INSERT INTO audit_logs (admin_username, action, target, details) VALUES (?, ?, ?, ?)',
      args: [admin_username, action, target, typeof details === 'object' ? JSON.stringify(details) : String(details)]
    });
  } catch (err) {
    console.error('Failed to log audit:', err);
  }
}

async function linkUserToXAccount(userId, xId, xUsername, displayName, profileImageUrl) {
  // 1. Upsert x_accounts record
  await db.execute({
    sql: `
      INSERT INTO x_accounts (user_id, x_id, x_username, display_name, profile_image_url)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(x_id) DO UPDATE SET
        user_id = excluded.user_id,
        x_username = excluded.x_username,
        display_name = COALESCE(excluded.display_name, x_accounts.display_name),
        profile_image_url = COALESCE(excluded.profile_image_url, x_accounts.profile_image_url),
        connected_at = CURRENT_TIMESTAMP
    `,
    args: [userId, xId, xUsername, displayName || `@${xUsername}`, profileImageUrl || null]
  });

  // 2. Consolidate any existing verifications for this xId into the current user_id
  const prevVerifs = await db.execute({
    sql: 'SELECT task_id, status, verified_at, metadata FROM task_verifications WHERE x_id = ? AND user_id != ?',
    args: [xId, userId]
  });

  for (const pv of prevVerifs.rows) {
    await db.execute({
      sql: `
        INSERT INTO task_verifications (user_id, x_id, task_id, status, verified_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, task_id) DO UPDATE SET
          x_id = excluded.x_id,
          status = CASE WHEN excluded.status = 'VERIFIED' THEN 'VERIFIED' ELSE task_verifications.status END,
          verified_at = CASE WHEN excluded.status = 'VERIFIED' THEN excluded.verified_at ELSE task_verifications.verified_at END,
          metadata = COALESCE(excluded.metadata, task_verifications.metadata)
      `,
      args: [userId, xId, pv.task_id, pv.status, pv.verified_at, pv.metadata]
    });
  }

  // Ensure any existing verifications under current user_id have x_id set
  await db.execute({
    sql: "UPDATE task_verifications SET x_id = ? WHERE user_id = ? AND (x_id IS NULL OR x_id = '')",
    args: [xId, userId]
  });

  // 3. Mark Task 01 (CONNECT_X) as VERIFIED for this user and xId
  const task1Res = await db.execute({
    sql: "SELECT id FROM tasks WHERE verification_type = 'CONNECT_X' AND is_archived = 0 ORDER BY sort_order ASC LIMIT 1"
  });

  const task1Id = task1Res.rows.length > 0 ? task1Res.rows[0].id : 1;

  await db.execute({
    sql: `
      INSERT INTO task_verifications (user_id, x_id, task_id, status, metadata)
      VALUES (?, ?, ?, 'VERIFIED', ?)
      ON CONFLICT(user_id, task_id) DO UPDATE SET
        x_id = excluded.x_id,
        status = 'VERIFIED',
        verified_at = CURRENT_TIMESTAMP,
        metadata = excluded.metadata
    `,
    args: [userId, xId, task1Id, JSON.stringify({ xId, xUsername, connectedAt: new Date().toISOString() })]
  });

  return { task1Id, xId, xUsername };
}

module.exports = {
  db,
  initDB,
  getRegisteredUsersCount,
  statsEvents,
  logAudit,
  linkUserToXAccount
};
