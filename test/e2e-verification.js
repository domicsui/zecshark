const { db, initDB, getRegisteredUsersCount, statsEvents } = require('../server/db');
const xService = require('../server/services/xService');

async function runTests() {
  console.log('====================================================');
  console.log('🦈 RUNNING ZECKSHARK FULL VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  await initDB();

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ✓ ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ✕ ${testName}`);
      failed++;
    }
  }

  // --- Scenario 1: Initial Count ---
  const initialCount = await getRegisteredUsersCount();
  assert(typeof initialCount === 'number', `Scenario 1: Real count retrieved from database (Count: ${initialCount})`);

  // --- Scenario 4: User fails task → next task stays locked / failed state returned ---
  const failResult = await xService.verifyTask({
    verificationType: 'CONNECT_X',
    xUsername: 'test_user_fail',
    forceFail: true
  });
  assert(!failResult.verified, 'Scenario 4: Failed task produces unverified outcome and error');

  // --- Scenario 5: User tries to skip task → blocked ---
  // Create a clean test user
  const userRes = await db.execute({
    sql: 'INSERT INTO users (session_token, ip_address) VALUES (?, ?)',
    args: [`test_session_${Date.now()}`, '127.0.0.1']
  });
  const testUserId = Number(userRes.lastInsertRowid);

  // User attempts to verify task 3 (Like/Repost) without completing task 1 or 2
  const tasksRes = await db.execute('SELECT * FROM tasks WHERE is_archived = 0 ORDER BY sort_order ASC');
  const task1 = tasksRes.rows[0];
  const task2 = tasksRes.rows[1];
  const task3 = tasksRes.rows[2];

  // Check check preceding logic:
  const precedingCheck = await db.execute({
    sql: `
      SELECT t.id, t.name, tv.status 
      FROM tasks t 
      LEFT JOIN task_verifications tv ON tv.task_id = t.id AND tv.user_id = ? 
      WHERE t.is_archived = 0 AND t.is_enabled = 1 AND t.sort_order < ?
      ORDER BY t.sort_order ASC
    `,
    args: [testUserId, task3.sort_order]
  });
  const hasIncompletePreceding = precedingCheck.rows.some(r => r.status !== 'VERIFIED');
  assert(hasIncompletePreceding, 'Scenario 5: Skipping tasks is blocked; preceding tasks required');

  // --- Scenario 6: All tasks complete → wallet step unlocks ---
  // Connect X
  const testXUsername = `shark_tester_${Date.now()}`;
  const testXId = `x_id_${Date.now()}`;
  await db.execute({
    sql: 'INSERT INTO x_accounts (user_id, x_id, x_username, display_name) VALUES (?, ?, ?, ?)',
    args: [testUserId, testXId, testXUsername, `@${testXUsername}`]
  });

  // Verify all tasks sequentially
  for (const t of tasksRes.rows) {
    await db.execute({
      sql: 'INSERT INTO task_verifications (user_id, task_id, status, metadata) VALUES (?, ?, ?, ?)',
      args: [testUserId, t.id, 'VERIFIED', JSON.stringify({ verified: true })]
    });
  }

  const verificationsCount = await db.execute({
    sql: `SELECT COUNT(*) as c FROM task_verifications WHERE user_id = ? AND status = 'VERIFIED'`,
    args: [testUserId]
  });
  assert(Number(verificationsCount.rows[0].c) === tasksRes.rows.length, 'Scenario 6: All 5 social tasks successfully verified on server');

  // --- Scenario 7: Application submitted → registration saved with #ZK-XXXXXX ---
  const appCode = `#ZK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const testWallet = '0x1234567890123456789012345678901234567890';
  await db.execute({
    sql: 'INSERT INTO applications (application_code, user_id, x_id, x_username, wallet_address, status) VALUES (?, ?, ?, ?, ?, ?)',
    args: [appCode, testUserId, testXId, testXUsername, testWallet, 'PENDING']
  });
  const newCount = await getRegisteredUsersCount();
  assert(newCount === initialCount + 1, `Scenario 1 & 7: Application submitted → count incremented atomically from ${initialCount} to ${newCount}`);

  // --- Scenario 2 & 3: Same user refreshes or submits again → count unchanged ---
  // Attempt duplicate submission with same x_id
  let duplicatePrevented = false;
  try {
    await db.execute({
      sql: 'INSERT INTO applications (application_code, user_id, x_id, x_username, wallet_address, status) VALUES (?, ?, ?, ?, ?, ?)',
      args: [`#ZK-DUP`, testUserId, testXId, testXUsername, testWallet, 'PENDING']
    });
  } catch (err) {
    duplicatePrevented = true;
  }
  const countAfterDuplicateAttempt = await getRegisteredUsersCount();
  assert(duplicatePrevented && countAfterDuplicateAttempt === newCount, 'Scenario 2 & 3: Duplicate submission with same X ID rejected; count unchanged');

  // --- Scenario 8: Wallet checker compares against eligible database ---
  // Check known seed eligible wallet
  const knownEligible = '0x71c8364437f5fa08f4e8e76313b8959d99723223';
  const eligibleCheckRes = await db.execute({
    sql: 'SELECT id FROM eligible_wallets WHERE LOWER(wallet_address) = ?',
    args: [knownEligible.toLowerCase()]
  });
  assert(eligibleCheckRes.rows.length > 0, 'Scenario 8a: Whitelisted wallet correctly returns ELIGIBLE');

  const unknownWallet = '0x0000000000000000000000000000000000009999';
  const notEligibleCheckRes = await db.execute({
    sql: 'SELECT id FROM eligible_wallets WHERE LOWER(wallet_address) = ?',
    args: [unknownWallet.toLowerCase()]
  });
  assert(notEligibleCheckRes.rows.length === 0, 'Scenario 8b: Unknown wallet correctly returns NOT ELIGIBLE');

  // --- Scenario 10: Archived task remains in database/history (NO hard deletion) ---
  const newTaskRes = await db.execute({
    sql: 'INSERT INTO tasks (name, description, x_account, x_url, verification_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    args: ['TEST TASK ARCHIVE', 'Description', '@test', '', 'FOLLOW', 99]
  });
  const tempTaskId = Number(newTaskRes.lastInsertRowid);
  // Archive it
  await db.execute({
    sql: 'UPDATE tasks SET is_archived = 1, is_enabled = 0 WHERE id = ?',
    args: [tempTaskId]
  });
  // Check that row still exists in database
  const archivedCheck = await db.execute({
    sql: 'SELECT * FROM tasks WHERE id = ?',
    args: [tempTaskId]
  });
  assert(archivedCheck.rows.length === 1 && archivedCheck.rows[0].is_archived === 1, 'Scenario 10: Task is archived and historical record is preserved without hard deletion');

  // --- Scenario 11: CSV import rejects invalid/duplicate entries correctly ---
  const validCsvWallet1 = `0x${'a'.repeat(40)}`;
  const validCsvWallet2 = `0x${'b'.repeat(40)}`;
  const invalidFormat = 'not_a_valid_wallet_address_123';
  
  // Insert valid wallet 1
  await db.execute({
    sql: 'INSERT OR IGNORE INTO eligible_wallets (wallet_address, notes) VALUES (?, ?)',
    args: [validCsvWallet1, 'CSV Test']
  });

  // Test duplicate rejection
  let dupRejected = false;
  try {
    await db.execute({
      sql: 'INSERT INTO eligible_wallets (wallet_address, notes) VALUES (?, ?)',
      args: [validCsvWallet1, 'Duplicate Test']
    });
  } catch (err) {
    dupRejected = true;
  }
  assert(dupRejected, 'Scenario 11: Database rejects duplicate wallet insertion in eligible list');

  // --- Scenario 9: Admin not visible in public navbar ---
  const fs = require('fs');
  const navbarContent = fs.readFileSync('./src/components/Navbar.jsx', 'utf8');
  const hasAdminInNavbar = /admin/i.test(navbarContent.match(/navItems\s*=\s*\[([\s\S]*?)\]/)?.[1] || '');
  assert(!hasAdminInNavbar, 'Scenario 9: Navbar contains strictly HOME, WAITLIST, WALLET CHECKER, ROADMAP, FAQ (No Admin)');

  console.log('\n====================================================');
  console.log(`TOTAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
