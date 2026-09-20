const http = require('http');
const app = require('../server/index');
const { initDB, db } = require('../server/db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../server/middleware/auth');

async function runE2ESubmitTest() {
  console.log('=====================================================');
  console.log('STARTING END-TO-END APPLICATION SUBMIT & ADMIN TEST');
  console.log('=====================================================');

  await initDB();
  // Wait a moment for server to listen on port 5000
  await new Promise(r => setTimeout(r, 500));
  const baseUrl = `http://localhost:5000/api`;

  const adminToken = jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

  // 1. Initialize user session
  console.log('\n1. Initializing user session...');
  const tasksRes = await fetch(`${baseUrl}/waitlist/tasks`);
  const tasksData = await tasksRes.json();
  const sessionToken = tasksData.sessionToken;

  console.log('User session token:', sessionToken);
  if (!sessionToken) throw new Error('Failed to obtain session token');

  // Fetch userId from database
  const userRes = await db.execute({
    sql: 'SELECT id FROM users WHERE session_token = ?',
    args: [sessionToken]
  });
  const userId = userRes.rows[0].id;

  // 2. Connect X account directly into database
  const testXId = 'x_user_' + Date.now();
  const testUsername = 'zec_shark_' + Math.floor(Math.random() * 1000);
  const testWallet = 'zs1' + 'e'.repeat(76);

  console.log(`\n2. Linking X account @${testUsername} (${testXId}) to user #${userId}...`);
  await db.execute({
    sql: 'INSERT INTO x_accounts (user_id, x_id, x_username, display_name) VALUES (?, ?, ?, ?)',
    args: [userId, testXId, testUsername, 'Zec Shark Tester']
  });
  console.log('✓ Linked X account @' + testUsername);

  // 3. Verify all remaining tasks
  console.log('\n3. Verifying all tasks 2-5...');
  const activeTasks = await db.execute('SELECT id FROM tasks WHERE is_archived = 0 AND is_enabled = 1');
  for (const t of activeTasks.rows) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO task_verifications (user_id, task_id, x_id, status, verified_at) VALUES (?, ?, ?, 'VERIFIED', CURRENT_TIMESTAMP)`,
      args: [userId, t.id, testXId]
    });
  }
  console.log('✓ All 5 tasks verified in database.');

  // 4. Submit waitlist application
  console.log(`\n4. Submitting application with wallet: ${testWallet}...`);
  const submitRes = await fetch(`${baseUrl}/waitlist/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': sessionToken
    },
    body: JSON.stringify({
      walletAddress: testWallet
    })
  });
  const submitData = await submitRes.json();
  console.log('Submit response:', submitData);

  if (!submitData.success || !submitData.application) {
    throw new Error('Application submit failed: ' + JSON.stringify(submitData));
  }
  const submittedApp = submitData.application;
  console.log(`✓ Application submitted successfully! Code: ${submittedApp.applicationCode || submittedApp.application_code}, ID: ${submittedApp.id}`);

  // 5. Verify duplicate submit rejection
  console.log('\n5. Testing duplicate submission rejection...');
  const dupRes = await fetch(`${baseUrl}/waitlist/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': sessionToken
    },
    body: JSON.stringify({
      walletAddress: testWallet
    })
  });
  const dupData = await dupRes.json();
  console.log('Duplicate submit response:', dupData);
  if (!dupData.alreadyRegistered) {
    throw new Error('Duplicate application was not rejected!');
  }
  console.log('✓ Duplicate submission correctly detected and rejected.');

  // 6. Admin Panel queries applications list
  console.log('\n6. Admin Panel: Fetching applications list...');
  const adminAppsRes = await fetch(`${baseUrl}/admin/applications?search=${testUsername}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const adminAppsData = await adminAppsRes.json();
  console.log('Admin applications count found:', adminAppsData.applications?.length);

  const found = adminAppsData.applications?.find(a => (a.x_id === testXId || a.xId === testXId));
  if (!found) {
    throw new Error('Submitted application not found in Admin Panel applications list!');
  }
  console.log('✓ Submitted application found in Admin Panel:', {
    application_code: found.application_code,
    x_username: found.x_username,
    wallet_address: found.wallet_address,
    status: found.status,
    completed_tasks_count: found.completed_tasks_count,
    total_tasks_count: found.total_tasks_count
  });

  // 7. Admin updates application status
  console.log('\n7. Admin Panel: Updating application status to APPROVED/COMPLETED...');
  const targetId = found.id || found.application_code;
  const updateRes = await fetch(`${baseUrl}/admin/applications/${targetId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ status: 'COMPLETED' })
  });
  const updateData = await updateRes.json();
  console.log('Update status response:', updateData);
  if (!updateData.success) throw new Error('Failed to update status');
  console.log('✓ Status successfully updated.');

  // 8. Admin Refreshes / Refocuses Applications List
  console.log('\n8. Admin Panel: Simulating page refresh / refocus...');
  const refreshRes = await fetch(`${baseUrl}/admin/applications?search=${testUsername}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const refreshData = await refreshRes.json();
  const refreshedApp = refreshData.applications?.find(a => (a.x_id === testXId || a.xId === testXId));
  if (!refreshedApp || refreshedApp.status !== 'COMPLETED') {
    throw new Error('Application state was not persisted after refresh!');
  }
  console.log('✓ Application persisted after refresh with status: ' + refreshedApp.status);

  // 9. Admin CSV Export
  console.log('\n9. Admin Panel: Exporting waitlist CSV...');
  const csvRes = await fetch(`${baseUrl}/admin/applications/export-csv`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const csvText = await csvRes.text();
  if (!csvText.includes(testUsername) || !csvText.includes(testWallet)) {
    throw new Error('CSV export missing submitted application!');
  }
  console.log('✓ CSV export contains submitted application data.');

  console.log('\n=====================================================');
  console.log('🎉 ALL END-TO-END APPLICATION TESTS PASSED!');
  console.log('=====================================================');
}

runE2ESubmitTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ E2E Test Failed:', err);
    process.exit(1);
  });
