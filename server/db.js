const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const path = require('path');
const EventEmitter = require('events');

const statsEvents = new EventEmitter();
statsEvents.setMaxListeners(100);

const dbPath = path.resolve(__dirname, '..', 'zeckshark.db');
const db = createClient({
  url: 'file:' + dbPath.replace(/\\/g, '/')
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
      task_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      UNIQUE(user_id, task_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    )
  `);

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

module.exports = {
  db,
  initDB,
  getRegisteredUsersCount,
  statsEvents,
  logAudit
};
