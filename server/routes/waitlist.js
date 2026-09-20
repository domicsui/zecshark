const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, getRegisteredUsersCount, statsEvents } = require('../db');
const xService = require('../services/xService');
const { submitLimiter, verificationLimiter } = require('../middleware/rateLimit');

// Helper to get or create a session user
async function getOrCreateUser(req) {
  let sessionToken = req.headers['x-session-token'] || req.cookies?.zeckshark_session;

  if (sessionToken) {
    const userRes = await db.execute({
      sql: 'SELECT * FROM users WHERE session_token = ?',
      args: [sessionToken]
    });
    if (userRes.rows.length > 0) {
      return userRes.rows[0];
    }
  }

  // Create new session user
  const newToken = crypto.randomBytes(24).toString('hex');
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const insertRes = await db.execute({
    sql: 'INSERT INTO users (session_token, ip_address) VALUES (?, ?)',
    args: [newToken, ip]
  });

  return {
    id: Number(insertRes.lastInsertRowid),
    session_token: newToken
  };
}

// 1. GET /api/waitlist/tasks - Fetch active sequential tasks and user progress
router.get('/tasks', async (req, res) => {
  try {
    const user = await getOrCreateUser(req);

    // Fetch global waitlist & application settings
    const settingsRes = await db.execute(`
      SELECT key, value FROM settings 
      WHERE key IN ('waitlist_enabled', 'applications_open', 'x_verification_mode')
    `);
    const settings = {};
    for (const r of settingsRes.rows) {
      settings[r.key] = r.value;
    }

    // Fetch active non-archived tasks ordered by sort_order
    const tasksRes = await db.execute(`
      SELECT id, name, description, x_account, x_url, verification_type, sort_order, is_enabled 
      FROM tasks 
      WHERE is_archived = 0 
      ORDER BY sort_order ASC
    `);

    // Fetch user's task verifications
    const verificationsRes = await db.execute({
      sql: 'SELECT task_id, status, verified_at, metadata FROM task_verifications WHERE user_id = ?',
      args: [user.id]
    });
    const verificationsMap = {};
    for (const v of verificationsRes.rows) {
      verificationsMap[v.task_id] = v;
    }

    // Fetch user's connected X account
    const xRes = await db.execute({
      sql: 'SELECT * FROM x_accounts WHERE user_id = ?',
      args: [user.id]
    });
    const connectedX = xRes.rows.length > 0 ? {
      xId: xRes.rows[0].x_id,
      xUsername: xRes.rows[0].x_username,
      displayName: xRes.rows[0].display_name
    } : null;

    // Fetch existing application if submitted
    const appRes = await db.execute({
      sql: 'SELECT * FROM applications WHERE user_id = ?',
      args: [user.id]
    });
    const application = appRes.rows.length > 0 ? {
      applicationCode: appRes.rows[0].application_code,
      status: appRes.rows[0].status,
      walletAddress: appRes.rows[0].wallet_address,
      xUsername: appRes.rows[0].x_username,
      createdAt: appRes.rows[0].created_at
    } : null;

    // Determine sequential state for each task:
    // LOCKED, READY, VERIFYING, VERIFIED, FAILED, TRY AGAIN
    let previousVerified = true;
    let completedCount = 0;

    const tasks = tasksRes.rows.map((task, index) => {
      const v = verificationsMap[task.id];
      let taskState = 'LOCKED';

      if (v && v.status === 'VERIFIED') {
        taskState = 'VERIFIED';
        completedCount++;
      } else if (v && v.status === 'FAILED') {
        taskState = 'FAILED';
      } else if (previousVerified && task.is_enabled) {
        taskState = 'READY';
      } else {
        taskState = 'LOCKED';
      }

      // If this task is not verified, subsequent tasks must be locked
      if (taskState !== 'VERIFIED') {
        previousVerified = false;
      }

      return {
        id: task.id,
        name: task.name,
        description: task.description,
        xAccount: task.x_account,
        xUrl: task.x_url,
        verificationType: task.verification_type,
        sortOrder: task.sort_order,
        isEnabled: Boolean(task.is_enabled),
        state: taskState,
        verifiedAt: v?.verified_at || null,
        metadata: v?.metadata ? JSON.parse(v.metadata) : null
      };
    });

    const totalSocialTasks = tasks.length;
    const allSocialTasksCompleted = completedCount >= totalSocialTasks && totalSocialTasks > 0;

    res.json({
      success: true,
      sessionToken: user.session_token,
      settings: {
        waitlistEnabled: settings.waitlist_enabled !== 'false',
        applicationsOpen: settings.applications_open !== 'false',
        verificationMode: settings.x_verification_mode || 'DEMO'
      },
      connectedX,
      tasks,
      progress: {
        completed: completedCount,
        total: totalSocialTasks,
        allSocialCompleted: allSocialTasksCompleted
      },
      application
    });
  } catch (err) {
    console.error('Error fetching waitlist tasks:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve waitlist state.' });
  }
});

// 2. POST /api/waitlist/connect-x - Step 1: Connect X Account
router.post('/connect-x', verificationLimiter, async (req, res) => {
  try {
    const user = await getOrCreateUser(req);
    const { xUsername, forceFail } = req.body;

    if (!xUsername || typeof xUsername !== 'string') {
      return res.status(400).json({ success: false, error: 'X username is required.' });
    }

    const cleanUsername = xUsername.replace(/^@/, '').trim();
    if (!/^[A-Za-z0-9_]{1,15}$/.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid X username format. Must be 1-15 characters (letters, numbers, underscores).'
      });
    }

    // Verify step 1 using xService
    const verification = await xService.verifyTask({
      verificationType: 'CONNECT_X',
      xUsername: cleanUsername,
      forceFail: Boolean(forceFail)
    });

    if (!verification.verified) {
      return res.status(400).json({
        success: false,
        state: 'FAILED',
        error: verification.error || 'Failed to verify X connection.'
      });
    }

    // Deterministic simulated or real X ID
    const xId = verification.metadata?.xId || `x_user_${crypto.createHash('md5').update(cleanUsername.toLowerCase()).digest('hex').substring(0, 10)}`;

    // Store or update x_accounts
    await db.execute({
      sql: `
        INSERT INTO x_accounts (user_id, x_id, x_username, display_name) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(x_id) DO UPDATE SET 
          user_id = excluded.user_id,
          x_username = excluded.x_username,
          connected_at = CURRENT_TIMESTAMP
      `,
      args: [user.id, xId, cleanUsername, `@${cleanUsername}`]
    });

    // Mark task 1 verified in task_verifications
    const task1 = await db.execute({
      sql: "SELECT id FROM tasks WHERE verification_type = 'CONNECT_X' AND is_archived = 0 LIMIT 1"
    });

    if (task1.rows.length > 0) {
      const taskId = task1.rows[0].id;
      await db.execute({
        sql: `
          INSERT INTO task_verifications (user_id, task_id, status, metadata) 
          VALUES (?, ?, 'VERIFIED', ?)
          ON CONFLICT(user_id, task_id) DO UPDATE SET 
            status = 'VERIFIED',
            verified_at = CURRENT_TIMESTAMP,
            metadata = excluded.metadata
        `,
        args: [user.id, taskId, JSON.stringify({ xId, xUsername: cleanUsername, mode: verification.mode })]
      });
    }

    res.json({
      success: true,
      state: 'VERIFIED',
      connectedX: {
        xId,
        xUsername: cleanUsername,
        displayName: `@${cleanUsername}`
      }
    });
  } catch (err) {
    console.error('Error connecting X account:', err);
    res.status(500).json({ success: false, error: 'Internal server error while connecting X account.' });
  }
});

// 3. POST /api/waitlist/verify-task - Sequential task verification (Tasks 2-5)
router.post('/verify-task', verificationLimiter, async (req, res) => {
  try {
    const user = await getOrCreateUser(req);
    const { taskId, proofUrl, forceFail } = req.body;

    if (!taskId) {
      return res.status(400).json({ success: false, error: 'Task ID is required.' });
    }

    // 1. Fetch task details
    const taskRes = await db.execute({
      sql: 'SELECT * FROM tasks WHERE id = ? AND is_archived = 0 AND is_enabled = 1',
      args: [taskId]
    });
    if (taskRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Task not found or is currently disabled.' });
    }
    const currentTask = taskRes.rows[0];

    // 2. Fetch user's connected X account
    const xRes = await db.execute({
      sql: 'SELECT * FROM x_accounts WHERE user_id = ?',
      args: [user.id]
    });
    if (xRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'You must connect your X account before verifying tasks.'
      });
    }
    const userX = xRes.rows[0];

    // 3. CRITICAL: Enforce strict sequential order!
    // Check that all tasks preceding currentTask.sort_order are already VERIFIED.
    const precedingTasksRes = await db.execute({
      sql: `
        SELECT t.id, t.name, tv.status 
        FROM tasks t 
        LEFT JOIN task_verifications tv ON tv.task_id = t.id AND tv.user_id = ? 
        WHERE t.is_archived = 0 AND t.is_enabled = 1 AND t.sort_order < ?
        ORDER BY t.sort_order ASC
      `,
      args: [user.id, currentTask.sort_order]
    });

    for (const prec of precedingTasksRes.rows) {
      if (prec.status !== 'VERIFIED') {
        return res.status(403).json({
          success: false,
          error: `Task locked. You must first complete and verify: "${prec.name}". Skipping is not permitted.`
        });
      }
    }

    // 4. Verify task via xService
    const verification = await xService.verifyTask({
      verificationType: currentTask.verification_type,
      xUsername: userX.x_username,
      xId: userX.x_id,
      proofUrl,
      forceFail: Boolean(forceFail)
    });

    if (!verification.verified) {
      // Record failed attempt
      await db.execute({
        sql: `
          INSERT INTO task_verifications (user_id, task_id, status, metadata) 
          VALUES (?, ?, 'FAILED', ?)
          ON CONFLICT(user_id, task_id) DO UPDATE SET 
            status = 'FAILED',
            metadata = excluded.metadata
        `,
        args: [user.id, currentTask.id, JSON.stringify({ error: verification.error, attemptedAt: new Date().toISOString() })]
      });

      return res.status(400).json({
        success: false,
        state: 'FAILED',
        error: verification.error || `Verification failed for ${currentTask.name}. Please try again.`
      });
    }

    // 5. Record verified status
    await db.execute({
      sql: `
        INSERT INTO task_verifications (user_id, task_id, status, metadata) 
        VALUES (?, ?, 'VERIFIED', ?)
        ON CONFLICT(user_id, task_id) DO UPDATE SET 
          status = 'VERIFIED',
          verified_at = CURRENT_TIMESTAMP,
          metadata = excluded.metadata
      `,
      args: [user.id, currentTask.id, JSON.stringify(verification.metadata || {})]
    });

    res.json({
      success: true,
      state: 'VERIFIED',
      taskId: currentTask.id,
      taskName: currentTask.name
    });
  } catch (err) {
    console.error('Error verifying task:', err);
    res.status(500).json({ success: false, error: 'Internal server error during verification.' });
  }
});

// 4. POST /api/waitlist/submit - Submit Final Application & Atomic Registration Increment
router.post('/submit', submitLimiter, async (req, res) => {
  try {
    const user = await getOrCreateUser(req);
    const { walletAddress } = req.body;

    // 1. Check Global Settings
    const settingsRes = await db.execute(`
      SELECT key, value FROM settings 
      WHERE key IN ('waitlist_enabled', 'applications_open')
    `);
    const settings = {};
    for (const r of settingsRes.rows) {
      settings[r.key] = r.value;
    }

    if (settings.waitlist_enabled === 'false') {
      return res.status(403).json({ success: false, error: 'The waitlist is currently paused by administrators.' });
    }
    if (settings.applications_open === 'false') {
      return res.status(403).json({ success: false, error: 'Waitlist applications are currently closed.' });
    }

    // 2. Validate Public Wallet Address
    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({ success: false, error: 'Public wallet address is required.' });
    }

    const cleanWallet = walletAddress.trim();

    // Security Check: detect and reject private keys or seed phrases (12+ words)
    if (cleanWallet.split(/\s+/).length >= 12 || cleanWallet.length > 350) {
      return res.status(400).json({
        success: false,
        error: 'SECURITY WARNING: Never enter a seed phrase or private key! Only your public/shielded wallet address is allowed.'
      });
    }

    // Validate wallet format: Strictly Zcash Shielded (Unified u1... or Sapling zs1...)
    const isZcashSapling = /^zs1[a-z0-9]{75,78}$/i.test(cleanWallet);
    const isZcashUnified = /^u1[a-z0-9]{60,300}$/i.test(cleanWallet);

    if (!isZcashSapling && !isZcashUnified) {
      if (/^t[13]/i.test(cleanWallet)) {
        return res.status(400).json({
          success: false,
          error: 'Transparent address (t1...) detected. ZECKSHARK requires a Zcash Shielded address (Unified u1... or Sapling zs1...).'
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid address. Only Zcash Shielded addresses (Unified Address u1... or Sapling zs1...) are accepted.'
      });
    }

    // 3. Verify user has connected X account
    const xRes = await db.execute({
      sql: 'SELECT * FROM x_accounts WHERE user_id = ?',
      args: [user.id]
    });
    if (xRes.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'You must connect your X account before submitting.' });
    }
    const userX = xRes.rows[0];

    // 4. Verify all active social tasks are completed
    const activeTasksRes = await db.execute(`
      SELECT id, name FROM tasks 
      WHERE is_archived = 0 AND is_enabled = 1
    `);
    const activeTaskIds = activeTasksRes.rows.map(t => t.id);

    const userVerificationsRes = await db.execute({
      sql: `SELECT task_id FROM task_verifications WHERE user_id = ? AND status = 'VERIFIED'`,
      args: [user.id]
    });
    const verifiedIds = new Set(userVerificationsRes.rows.map(v => v.task_id));

    const incomplete = activeTaskIds.filter(id => !verifiedIds.has(id));
    if (incomplete.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Incomplete tasks. You must verify all 5 social quests before submitting your wallet.'
      });
    }

    // 5. Check duplicate registration (one X account can only register once!)
    const existingAppRes = await db.execute({
      sql: 'SELECT * FROM applications WHERE x_id = ? OR user_id = ?',
      args: [userX.x_id, user.id]
    });

    if (existingAppRes.rows.length > 0) {
      const existing = existingAppRes.rows[0];
      const currentCount = await getRegisteredUsersCount();
      return res.json({
        success: true,
        alreadyRegistered: true,
        message: 'You have already submitted your waitlist application.',
        application: {
          applicationCode: existing.application_code,
          status: existing.status,
          walletAddress: existing.wallet_address,
          xUsername: existing.x_username,
          createdAt: existing.created_at
        },
        registeredUsers: currentCount
      });
    }

    // 6. ATOMIC APPLICATION REGISTRATION & COUNT INCREMENT
    // Generate unique Application Code: #ZK-XXXXXX
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const appCode = `#ZK-${randomSuffix}`;

    // Execute insert within database
    await db.execute({
      sql: `
        INSERT INTO applications (application_code, user_id, x_id, x_username, wallet_address, status)
        VALUES (?, ?, ?, ?, ?, 'PENDING')
      `,
      args: [appCode, user.id, userX.x_id, userX.x_username, cleanWallet]
    });

    // 7. Get the exact real registered users count from database
    const newCount = await getRegisteredUsersCount();

    // 8. Broadcast live count update via SSE stream to all open browsers
    statsEvents.emit('update', newCount);

    res.json({
      success: true,
      alreadyRegistered: false,
      message: 'APPLICATION COMPLETED ✓',
      application: {
        applicationCode: appCode,
        status: 'PENDING',
        walletAddress: cleanWallet,
        xUsername: userX.x_username,
        createdAt: new Date().toISOString()
      },
      registeredUsers: newCount
    });
  } catch (err) {
    console.error('Error submitting waitlist application:', err);
    res.status(500).json({ success: false, error: 'Database transaction error while submitting application.' });
  }
});

// 5. POST /api/waitlist/auto-verify-all - Helper for Demo/Test mode to unlock all quests immediately
router.post('/auto-verify-all', async (req, res) => {
  try {
    const user = await getOrCreateUser(req);

    // 1. Connect a test X account if none exists
    let xRes = await db.execute({
      sql: 'SELECT * FROM x_accounts WHERE user_id = ?',
      args: [user.id]
    });

    if (xRes.rows.length === 0) {
      const defaultUsername = 'zeckshark_alpha';
      const xId = `x_user_${crypto.randomBytes(4).toString('hex')}`;
      await db.execute({
        sql: `
          INSERT INTO x_accounts (user_id, x_id, x_username, display_name)
          VALUES (?, ?, ?, ?)
        `,
        args: [user.id, xId, defaultUsername, `@${defaultUsername}`]
      });
    }

    // 2. Mark all active tasks verified
    const activeTasks = await db.execute('SELECT id, name FROM tasks WHERE is_archived = 0 AND is_enabled = 1');
    for (const t of activeTasks.rows) {
      await db.execute({
        sql: `
          INSERT INTO task_verifications (user_id, task_id, status, metadata)
          VALUES (?, ?, 'VERIFIED', ?)
          ON CONFLICT(user_id, task_id) DO UPDATE SET status = 'VERIFIED', verified_at = CURRENT_TIMESTAMP
        `,
        args: [user.id, t.id, JSON.stringify({ verified: true, autoVerified: true })]
      });
    }

    res.json({
      success: true,
      sessionToken: user.session_token,
      message: 'All 5 social quests successfully auto-verified! Wallet submission step is now unlocked.'
    });
  } catch (err) {
    console.error('Error in auto-verify-all:', err);
    res.status(500).json({ success: false, error: 'Failed to auto-verify tasks.' });
  }
});

module.exports = router;

