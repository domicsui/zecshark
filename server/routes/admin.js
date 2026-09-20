const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { db, getRegisteredUsersCount, logAudit, statsEvents } = require('../db');
const { requireAdmin, JWT_SECRET } = require('../middleware/auth');
const supabaseService = require('../services/supabase');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ==========================================
// 1. ADMIN AUTHENTICATION
// ==========================================

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const adminRes = await db.execute({
      sql: 'SELECT * FROM admins WHERE username = ?',
      args: [username.trim()]
    });

    if (adminRes.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
    }

    const admin = adminRes.rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);

    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('zeckshark_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    await logAudit(admin.username, 'ADMIN_LOGIN', 'Admin Portal', 'Admin successfully logged in.');

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username
      }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ success: false, error: 'Login authentication failed.' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('zeckshark_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({
    success: true,
    admin: req.admin
  });
});

// ==========================================
// 2. DASHBOARD METRICS & GLOBAL SETTINGS
// ==========================================

router.get('/metrics', requireAdmin, async (req, res) => {
  try {
    // Application & User Counts from Supabase (Source of Truth)
    const appMetrics = await supabaseService.getApplicationMetrics();

    // Settings from Supabase (Source of Truth)
    const settings = await supabaseService.getSettings();
    const supabaseStatus = await supabaseService.getStatus();

    res.json({
      success: true,
      metrics: {
        totalRegisteredUsers: appMetrics.totalRegisteredUsers,
        completedApplications: appMetrics.completedApplications,
        pendingApplications: appMetrics.pendingApplications,
        eligibleWallets: appMetrics.eligibleWallets
      },
      settings,
      supabaseStatus
    });
  } catch (err) {
    console.error('Error fetching admin metrics:', err);
    res.status(500).json({ success: false, error: 'Failed to load metrics.' });
  }
});

router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await supabaseService.getSettings();
    const supabaseStatus = await supabaseService.getStatus();
    res.json({ success: true, settings, supabaseStatus });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch settings.' });
  }
});

router.post('/settings', requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    console.log(`[Admin] Settings update requested by @${req.admin.username}:`, updates);

    const result = await supabaseService.updateSettings(updates);

    if (!result.success) {
      console.error(`[Admin] Settings update failed:`, result.error);
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to update settings in Supabase.'
      });
    }

    await logAudit(req.admin.username, 'SETTINGS_UPDATE', 'Global Settings', JSON.stringify(updates));

    res.json({
      success: true,
      message: 'Settings saved successfully.',
      warning: result.warning || null,
      settings: result.settings,
      source: result.source
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ success: false, error: 'Failed to update settings.' });
  }
});

// ==========================================
// 3. TASK MANAGER (CRUD + ARCHIVAL)
// ==========================================

router.get('/tasks', requireAdmin, async (req, res) => {
  try {
    const tasksRes = await db.execute(`
      SELECT * FROM tasks ORDER BY sort_order ASC, id ASC
    `);
    res.json({ success: true, tasks: tasksRes.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load tasks.' });
  }
});

router.post('/tasks', requireAdmin, async (req, res) => {
  try {
    const { name, description, x_account, x_url, verification_type, sort_order, is_enabled } = req.body;

    if (!name || !description || !verification_type) {
      return res.status(400).json({ success: false, error: 'Name, description, and verification type are required.' });
    }

    const order = Number(sort_order) || 99;
    const enabled = is_enabled !== false ? 1 : 0;

    const ins = await db.execute({
      sql: `
        INSERT INTO tasks (name, description, x_account, x_url, verification_type, sort_order, is_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [name.trim(), description.trim(), x_account?.trim() || '', x_url?.trim() || '', verification_type.trim(), order, enabled]
    });

    await logAudit(req.admin.username, 'TASK_ADDED', name.trim(), { taskId: ins.lastInsertRowid });

    res.json({ success: true, message: 'Task added successfully.', taskId: ins.lastInsertRowid });
  } catch (err) {
    console.error('Error adding task:', err);
    res.status(500).json({ success: false, error: 'Failed to create task.' });
  }
});

router.put('/tasks/:id', requireAdmin, async (req, res) => {
  try {
    const taskId = req.params.id;
    const { name, description, x_account, x_url, verification_type, sort_order, is_enabled } = req.body;

    await db.execute({
      sql: `
        UPDATE tasks SET 
          name = ?,
          description = ?,
          x_account = ?,
          x_url = ?,
          verification_type = ?,
          sort_order = ?,
          is_enabled = ?
        WHERE id = ?
      `,
      args: [name, description, x_account, x_url, verification_type, Number(sort_order), is_enabled ? 1 : 0, taskId]
    });

    await logAudit(req.admin.username, 'TASK_EDITED', `Task #${taskId}`, { name, sort_order, is_enabled });

    res.json({ success: true, message: 'Task updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update task.' });
  }
});

router.put('/tasks/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const taskId = req.params.id;
    const currentRes = await db.execute({ sql: 'SELECT is_enabled, name FROM tasks WHERE id = ?', args: [taskId] });
    if (currentRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Task not found.' });

    const newStatus = currentRes.rows[0].is_enabled ? 0 : 1;
    await db.execute({ sql: 'UPDATE tasks SET is_enabled = ? WHERE id = ?', args: [newStatus, taskId] });

    await logAudit(req.admin.username, 'TASK_TOGGLED', currentRes.rows[0].name, { taskId, enabled: Boolean(newStatus) });

    res.json({ success: true, is_enabled: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to toggle task.' });
  }
});

// IMPORTANT: Never hard-delete tasks. Only archive them to preserve verification history!
router.delete('/tasks/:id', requireAdmin, async (req, res) => {
  try {
    const taskId = req.params.id;
    const currentRes = await db.execute({ sql: 'SELECT name FROM tasks WHERE id = ?', args: [taskId] });
    if (currentRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Task not found.' });

    await db.execute({
      sql: 'UPDATE tasks SET is_archived = 1, is_enabled = 0 WHERE id = ?',
      args: [taskId]
    });

    await logAudit(req.admin.username, 'TASK_ARCHIVED', currentRes.rows[0].name, {
      taskId,
      note: 'Soft archived to preserve verification integrity.'
    });

    res.json({ success: true, message: 'Task archived successfully. Historical records preserved.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to archive task.' });
  }
});

router.post('/tasks/reorder', requireAdmin, async (req, res) => {
  try {
    const { taskOrders } = req.body; // Array of { id, sort_order }
    if (Array.isArray(taskOrders)) {
      for (const item of taskOrders) {
        await db.execute({
          sql: 'UPDATE tasks SET sort_order = ? WHERE id = ?',
          args: [item.sort_order, item.id]
        });
      }
      await logAudit(req.admin.username, 'TASKS_REORDERED', 'Tasks List', { count: taskOrders.length });
    }
    res.json({ success: true, message: 'Tasks reordered.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to reorder tasks.' });
  }
});

// ==========================================
// 4. WAITLIST APPLICATIONS MANAGEMENT
// ==========================================

router.get('/applications', requireAdmin, async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    const result = await supabaseService.getApplications({
      search,
      status,
      page: Number(page) || 1,
      limit: Number(limit) || 50
    });

    res.json({
      success: true,
      applications: result.applications,
      total: result.total,
      page: result.page,
      source: result.source
    });
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).json({ success: false, error: 'Failed to load applications.' });
  }
});

router.put('/applications/:id/status', requireAdmin, async (req, res) => {
  try {
    const appId = req.params.id;
    const { status } = req.body;

    if (!['PENDING', 'COMPLETED', 'REJECTED', 'APPROVED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid application status.' });
    }

    const updateRes = await supabaseService.updateApplicationStatus(appId, status);
    if (!updateRes.success) {
      return res.status(500).json({ success: false, error: updateRes.error || 'Failed to update application status.' });
    }

    const newRegisteredCount = await getRegisteredUsersCount();
    statsEvents.emit('update', newRegisteredCount);

    await logAudit(req.admin.username, 'APPLICATION_STATUS_CHANGE', `Application #${appId}`, { newStatus: status });

    res.json({ success: true, message: `Application status changed to ${status}.`, source: updateRes.source });
  } catch (err) {
    console.error('Error updating application status:', err);
    res.status(500).json({ success: false, error: 'Failed to update application status.' });
  }
});

// ==========================================
// 5. ELIGIBLE WALLET MANAGER & CSV WORKFLOWS
// ==========================================

router.get('/wallets', requireAdmin, async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = 'SELECT * FROM eligible_wallets ';
    const args = [];

    if (search) {
      query += 'WHERE wallet_address LIKE ? OR notes LIKE ? ';
      args.push(`%${search}%`, `%${search}%`);
    }

    query += 'ORDER BY created_at DESC LIMIT ? OFFSET ?';
    args.push(Number(limit), offset);

    const walletsRes = await db.execute({ sql: query, args });
    const countRes = await db.execute('SELECT COUNT(*) as count FROM eligible_wallets');

    res.json({
      success: true,
      wallets: walletsRes.rows,
      total: Number(countRes.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load wallets.' });
  }
});

router.post('/wallets', requireAdmin, async (req, res) => {
  try {
    const { walletAddress, notes } = req.body;
    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({ success: false, error: 'Wallet address is required.' });
    }

    const clean = walletAddress.trim().toLowerCase();
    const isZcashSapling = /^zs1[a-z0-9]{75,78}$/i.test(clean);
    const isZcashUnified = /^u1[a-z0-9]{60,300}$/i.test(clean);

    if (!isZcashSapling && !isZcashUnified) {
      if (/^t[13]/i.test(clean)) {
        return res.status(400).json({
          success: false,
          error: 'Transparent address (t1...) rejected. Only Zcash Shielded addresses (Unified u1... or Sapling zs1...) are accepted.'
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format. Only Zcash Shielded addresses (Unified u1... or Sapling zs1...) are accepted.'
      });
    }

    await db.execute({
      sql: 'INSERT INTO eligible_wallets (wallet_address, notes, added_by) VALUES (?, ?, ?)',
      args: [clean, notes || 'Added manually', req.admin.username]
    });

    await logAudit(req.admin.username, 'WALLET_ADDED', clean, { notes });

    res.json({ success: true, message: 'Wallet added to eligible list.' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, error: 'This wallet is already in the eligible list.' });
    }
    res.status(500).json({ success: false, error: 'Failed to add wallet.' });
  }
});

router.delete('/wallets/:id', requireAdmin, async (req, res) => {
  try {
    const walletId = req.params.id;
    const wRes = await db.execute({ sql: 'SELECT wallet_address FROM eligible_wallets WHERE id = ?', args: [walletId] });
    if (wRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Wallet not found.' });

    await db.execute({ sql: 'DELETE FROM eligible_wallets WHERE id = ?', args: [walletId] });

    await logAudit(req.admin.username, 'WALLET_REMOVED', wRes.rows[0].wallet_address, { walletId });

    res.json({ success: true, message: 'Wallet removed from eligible list.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to remove wallet.' });
  }
});

// CSV Import
router.post('/wallets/import-csv', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    let fileContent = '';

    if (req.file) {
      fileContent = req.file.buffer.toString('utf8');
    } else if (req.body.csvText) {
      fileContent = req.body.csvText;
    } else {
      return res.status(400).json({ success: false, error: 'No CSV file or text provided.' });
    }

    const lines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      return res.status(400).json({ success: false, error: 'The CSV file is empty.' });
    }

    let importedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    // Check if header row exists
    let startIndex = 0;
    if (lines[0].toLowerCase().includes('wallet') || lines[0].toLowerCase().includes('address')) {
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const rawLine = lines[i];
      const parts = rawLine.split(/,|\t/);
      const rawAddress = parts[0]?.trim();

      if (!rawAddress) {
        invalidCount++;
        continue;
      }

      const clean = rawAddress.replace(/^["']|["']$/g, '').trim().toLowerCase();
      const isZcashSapling = /^zs1[a-z0-9]{75,78}$/i.test(clean);
      const isZcashUnified = /^u1[a-z0-9]{60,300}$/i.test(clean);

      if (!isZcashSapling && !isZcashUnified) {
        invalidCount++;
        continue;
      }

      try {
        await db.execute({
          sql: 'INSERT INTO eligible_wallets (wallet_address, notes, added_by) VALUES (?, ?, ?)',
          args: [clean, parts[1]?.replace(/^["']|["']$/g, '') || 'CSV Import', req.admin.username]
        });
        importedCount++;
      } catch (insertErr) {
        if (insertErr.message && insertErr.message.includes('UNIQUE')) {
          duplicateCount++;
        } else {
          invalidCount++;
        }
      }
    }

    await logAudit(req.admin.username, 'CSV_IMPORTED', 'Eligible Wallets', {
      imported: importedCount,
      duplicates: duplicateCount,
      invalids: invalidCount
    });

    res.json({
      success: true,
      message: `CSV Processed: ${importedCount} added, ${duplicateCount} duplicates skipped, ${invalidCount} invalid rows ignored.`,
      stats: {
        imported: importedCount,
        duplicates: duplicateCount,
        invalid: invalidCount
      }
    });
  } catch (err) {
    console.error('CSV import error:', err);
    res.status(500).json({ success: false, error: 'Failed to process CSV file.' });
  }
});

// CSV Export for Eligible Wallets
router.get('/wallets/export-csv', requireAdmin, async (req, res) => {
  try {
    const walletsRes = await db.execute('SELECT wallet_address, notes, added_by, created_at FROM eligible_wallets ORDER BY id ASC');

    let csv = 'wallet_address,notes,added_by,created_at\r\n';
    for (const w of walletsRes.rows) {
      csv += `"${w.wallet_address}","${(w.notes || '').replace(/"/g, '""')}","${w.added_by}","${w.created_at}"\r\n`;
    }

    await logAudit(req.admin.username, 'CSV_EXPORTED', 'Eligible Wallets', { rows: walletsRes.rows.length });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="zeckshark_eligible_wallets.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to export CSV.' });
  }
});

// CSV Export for Completed Waitlist Applications (The CSV Workflow)
router.get('/applications/export-csv', requireAdmin, async (req, res) => {
  try {
    const apps = await supabaseService.getApplicationsForExport();

    let csv = 'wallet_address,x_username,x_id,application_code,status,created_at\r\n';
    for (const a of apps) {
      csv += `"${a.wallet_address || a.walletAddress || ''}","${a.x_username || a.xUsername || ''}","${a.x_id || a.xId || ''}","${a.application_code || a.applicationCode || ''}","${a.status || ''}","${a.created_at || a.createdAt || ''}"\r\n`;
    }

    await logAudit(req.admin.username, 'CSV_EXPORTED', 'Waitlist Applications', { rows: apps.length });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="zeckshark_waitlist_wallets.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Error exporting waitlist CSV:', err);
    res.status(500).json({ success: false, error: 'Failed to export waitlist CSV.' });
  }
});

// ==========================================
// 6. AUDIT LOGS (READ-ONLY)
// ==========================================

router.get('/audit-logs', requireAdmin, async (req, res) => {
  try {
    const logsRes = await db.execute('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
    res.json({ success: true, logs: logsRes.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load audit logs.' });
  }
});

module.exports = router;
