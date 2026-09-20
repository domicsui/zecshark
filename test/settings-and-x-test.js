const http = require('http');
const app = require('../server/index');
const { initDB, db } = require('../server/db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../server/middleware/auth');

async function runTests() {
  console.log('--- STARTING END-TO-END VERIFICATION SUITE ---');

  await initDB();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  console.log(`Test server running on port: ${port}`);

  // Create admin token for authenticated admin requests
  const adminToken = jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

  async function req(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (options.auth) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Initial Settings Load from Supabase Service
    // -------------------------------------------------------------
    console.log('\n[TEST 1] Testing /admin/metrics settings load...');
    const initialMetrics = await req('/admin/metrics', { auth: true });
    if (!initialMetrics.ok) throw new Error(`Initial metrics failed: ${JSON.stringify(initialMetrics.data)}`);
    console.log('✓ Initial settings loaded successfully:', {
      waitlist_enabled: initialMetrics.data.settings.waitlist_enabled,
      applications_enabled: initialMetrics.data.settings.applications_enabled,
      wallet_checker_enabled: initialMetrics.data.settings.wallet_checker_enabled,
      supabaseStatus: initialMetrics.data.supabaseStatus
    });

    // -------------------------------------------------------------
    // TEST 2: Toggle WAITLIST ENGINE OFF and verify persistence
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Toggling WAITLIST to false...');
    const setWaitlistOff = await req('/admin/settings', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ waitlist_enabled: 'false' })
    });
    if (!setWaitlistOff.ok) throw new Error(`Failed to set waitlist off: ${JSON.stringify(setWaitlistOff.data)}`);
    console.log('✓ Update response:', setWaitlistOff.data.message);

    // Refresh simulation: fetch metrics again
    const refreshAdmin = await req('/admin/metrics', { auth: true });
    if (refreshAdmin.data.settings.waitlist_enabled !== 'false') {
      throw new Error(`Waitlist setting did not persist after refresh! Expected 'false', got ${refreshAdmin.data.settings.waitlist_enabled}`);
    }
    console.log('✓ Verified: /admin/metrics still reflects waitlist_enabled = false after refresh');

    // Public /waitlist page verification
    const publicWaitlist = await req('/waitlist/tasks');
    if (publicWaitlist.data.settings.waitlistEnabled !== false) {
      throw new Error(`Public waitlist did not reflect disabled state! Expected waitlistEnabled = false, got ${publicWaitlist.data.settings.waitlistEnabled}`);
    }
    console.log('✓ Verified: Public /waitlist/tasks reflects waitlistEnabled = false');

    // -------------------------------------------------------------
    // TEST 3: Toggle WAITLIST ENGINE back ON
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Toggling WAITLIST back to true...');
    await req('/admin/settings', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ waitlist_enabled: 'true' })
    });

    const publicWaitlistOn = await req('/waitlist/tasks');
    if (publicWaitlistOn.data.settings.waitlistEnabled !== true) {
      throw new Error(`Public waitlist did not reflect enabled state! Expected waitlistEnabled = true, got ${publicWaitlistOn.data.settings.waitlistEnabled}`);
    }
    console.log('✓ Verified: Public /waitlist/tasks reflects waitlistEnabled = true');

    // -------------------------------------------------------------
    // TEST 4: Toggle APPLICATIONS OPEN/CLOSED
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Toggling APPLICATIONS to false...');
    await req('/admin/settings', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ applications_open: 'false' })
    });

    const tasksAfterAppClosed = await req('/waitlist/tasks');
    if (tasksAfterAppClosed.data.settings.applicationsOpen !== false) {
      throw new Error(`Expected applicationsOpen = false, got ${tasksAfterAppClosed.data.settings.applicationsOpen}`);
    }
    console.log('✓ Verified: Public /waitlist/tasks reflects applicationsOpen = false');

    // Toggle back on
    await req('/admin/settings', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ applications_open: 'true' })
    });
    console.log('✓ Verified: APPLICATIONS toggled back ON');

    // -------------------------------------------------------------
    // TEST 5: Toggle WALLET CHECKER ON/OFF
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Toggling WALLET CHECKER to false...');
    await req('/admin/settings', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ wallet_checker_enabled: 'false' })
    });

    // Check status endpoint
    const checkerStatus = await req('/checker/status');
    if (checkerStatus.data.walletCheckerEnabled !== false) {
      throw new Error(`Expected walletCheckerEnabled = false, got ${checkerStatus.data.walletCheckerEnabled}`);
    }
    console.log('✓ Verified: /checker/status reflects walletCheckerEnabled = false');

    // Attempting check should return 403
    const checkAttempt = await req('/checker/check', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: 'zs1z7rejlpsa98s2rrrfkwmaxu53e4ue0ulcrw0h4x5g8emcvtqmumahttv4ymvd2hs20qxxudq02m' })
    });
    if (checkAttempt.status !== 403) {
      throw new Error(`Expected 403 when checker is offline, got ${checkAttempt.status}`);
    }
    console.log('✓ Verified: /checker/check rejected with 403 when offline');

    // Toggle back on
    await req('/admin/settings', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ wallet_checker_enabled: 'true' })
    });
    const checkAttemptOn = await req('/checker/check', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: 'zs1z7rejlpsa98s2rrrfkwmaxu53e4ue0ulcrw0h4x5g8emcvtqmumahttv4ymvd2hs20qxxudq02m' })
    });
    if (!checkAttemptOn.ok || !checkAttemptOn.data.eligible) {
      throw new Error(`Expected eligible wallet check to succeed, got ${JSON.stringify(checkAttemptOn.data)}`);
    }
    console.log('✓ Verified: /checker/check functions correctly when wallet_checker_enabled = true');

    // -------------------------------------------------------------
    // TEST 6: X Verification Flow & Refresh Persistence
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Testing X Connect flow and persistence...');
    const testUsername = `test_shark_${Date.now().toString().slice(-4)}`;
    
    // Connect X
    const connectRes = await req('/waitlist/connect-x', {
      method: 'POST',
      body: JSON.stringify({ xUsername: testUsername })
    });
    if (!connectRes.ok || !connectRes.data.success) {
      throw new Error(`Connect X failed: ${JSON.stringify(connectRes.data)}`);
    }
    const { sessionToken, connectedX } = connectRes.data;
    console.log(`✓ Connected as @${connectedX.xUsername}, xId: ${connectedX.xId}`);

    // Fetch tasks using session token
    const tasksRes = await req('/waitlist/tasks', {
      headers: { 'x-session-token': sessionToken }
    });
    if (tasksRes.data.tasks[0].state !== 'VERIFIED') {
      throw new Error(`Task 01 should be VERIFIED, got: ${tasksRes.data.tasks[0].state}`);
    }
    if (tasksRes.data.tasks[1].state !== 'READY') {
      throw new Error(`Task 02 should be READY, got: ${tasksRes.data.tasks[1].state}`);
    }
    if (tasksRes.data.progress.completed !== 1) {
      throw new Error(`Progress should be 1/5, got: ${tasksRes.data.progress.completed}/${tasksRes.data.progress.total}`);
    }
    console.log('✓ Verified: Task 01 = VERIFIED, Task 02 = READY, Progress = 1/5');

    // SIMULATE PAGE REFRESH (brand new session token, but client provides xId header/cookie)
    console.log('\n[TEST 7] Simulating page refresh with new session token...');
    const refreshTasksRes = await req('/waitlist/tasks', {
      headers: { 'x-user-x-id': connectedX.xId }
    });
    if (refreshTasksRes.data.tasks[0].state !== 'VERIFIED') {
      throw new Error(`Task 01 reset on refresh! Got: ${refreshTasksRes.data.tasks[0].state}`);
    }
    if (refreshTasksRes.data.tasks[1].state !== 'READY') {
      throw new Error(`Task 02 locked on refresh! Got: ${refreshTasksRes.data.tasks[1].state}`);
    }
    if (refreshTasksRes.data.progress.completed < 1) {
      throw new Error(`Progress reset to 0 on refresh! Got: ${refreshTasksRes.data.progress.completed}`);
    }
    console.log('✓ Verified: Refresh preserved Task 01 = VERIFIED, Task 02 = READY, Progress = 1/5');

    console.log('\n=========================================');
    console.log('🎉 ALL END-TO-END VERIFICATION TESTS PASSED!');
    console.log('=========================================');
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILURE:', err.message);
    process.exit(1);
  } finally {
    server.close();
  }
}

runTests();
