const http = require('http');
const app = require('../server/index');
const { initDB, db } = require('../server/db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../server/middleware/auth');

async function runButtonFlowTests() {
  console.log('=====================================================');
  console.log('STARTING DEDICATED BUTTON FLOW & PERSISTENCE TEST');
  console.log('=====================================================');

  await initDB();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

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

  // -------------------------------------------------------------
  // TEST 1: WAITLIST BUTTON (ON -> OFF -> refresh -> ON -> refresh)
  // -------------------------------------------------------------
  console.log('\n--- 1. TESTING WAITLIST ENGINE BUTTON FLOW ---');
  
  // Step A: Turn WAITLIST OFF
  console.log('Clicking WAITLIST ENGINE button: ON -> OFF...');
  const offRes = await req('/admin/settings', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ waitlist_enabled: 'false' })
  });
  if (!offRes.ok) throw new Error(`Waitlist OFF request failed: ${JSON.stringify(offRes.data)}`);
  console.log('✓ POST /api/admin/settings succeeded:', offRes.data.message);

  // Check database after change
  const checkOffDB = await req('/admin/settings', { auth: true });
  if (checkOffDB.data.settings.waitlist_enabled !== 'false') {
    throw new Error(`Database check failed! Expected waitlist_enabled = 'false', got: ${checkOffDB.data.settings.waitlist_enabled}`);
  }
  console.log('✓ Database confirmed: waitlist_enabled is "false"');

  // Simulate browser page refresh: GET /api/admin/metrics
  const refreshOffAdmin = await req('/admin/metrics', { auth: true });
  if (refreshOffAdmin.data.settings.waitlist_enabled !== 'false') {
    throw new Error(`Admin refresh failed! Button would reset. Value: ${refreshOffAdmin.data.settings.waitlist_enabled}`);
  }
  console.log('✓ Browser refresh confirmed: Button initializes as OFF (does NOT reset to ON)');

  // Public /waitlist check
  const publicWaitlistOff = await req('/waitlist/tasks');
  if (publicWaitlistOff.data.settings.waitlistEnabled !== false) {
    throw new Error(`Public /waitlist failed to reflect OFF!`);
  }
  console.log('✓ Public /waitlist confirmed: waitlistEnabled is false (shows PAUSED state)');

  // Submit should be rejected when waitlist is OFF
  const submitWhenOff = await req('/waitlist/submit', {
    method: 'POST',
    body: JSON.stringify({ walletAddress: 'zs1testaddress1234567890123456789012345678901234567890123456789012345678901234567890' })
  });
  if (submitWhenOff.status !== 403) {
    throw new Error(`Expected 403 when waitlist is paused, got ${submitWhenOff.status}`);
  }
  console.log('✓ Public /waitlist/submit confirmed: Rejected with 403 ("The waitlist is currently paused by administrators.")');

  // Step B: Turn WAITLIST back ON
  console.log('\nClicking WAITLIST ENGINE button: OFF -> ON...');
  const onRes = await req('/admin/settings', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ waitlist_enabled: 'true' })
  });
  if (!onRes.ok) throw new Error(`Waitlist ON request failed: ${JSON.stringify(onRes.data)}`);
  
  const checkOnDB = await req('/admin/settings', { auth: true });
  if (checkOnDB.data.settings.waitlist_enabled !== 'true') {
    throw new Error(`Database check failed! Expected waitlist_enabled = 'true', got: ${checkOnDB.data.settings.waitlist_enabled}`);
  }
  console.log('✓ Database confirmed: waitlist_enabled is "true"');

  const refreshOnAdmin = await req('/admin/metrics', { auth: true });
  if (refreshOnAdmin.data.settings.waitlist_enabled !== 'true') {
    throw new Error(`Admin refresh failed! Value: ${refreshOnAdmin.data.settings.waitlist_enabled}`);
  }
  console.log('✓ Browser refresh confirmed: Button initializes as ON');

  const publicWaitlistOn = await req('/waitlist/tasks');
  if (publicWaitlistOn.data.settings.waitlistEnabled !== true) {
    throw new Error(`Public /waitlist failed to reflect ON!`);
  }
  console.log('✓ Public /waitlist confirmed: waitlistEnabled is true (active)');


  // -------------------------------------------------------------
  // TEST 2: APPLICATIONS BUTTON (OPEN -> CLOSED -> refresh -> OPEN)
  // -------------------------------------------------------------
  console.log('\n--- 2. TESTING APPLICATIONS BUTTON FLOW ---');

  // Step A: Turn APPLICATIONS to CLOSED
  console.log('Clicking APPLICATIONS button: OPEN -> CLOSED...');
  const appsClosedRes = await req('/admin/settings', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ applications_open: 'false' })
  });
  if (!appsClosedRes.ok) throw new Error(`Applications CLOSED failed: ${JSON.stringify(appsClosedRes.data)}`);

  const checkClosedDB = await req('/admin/settings', { auth: true });
  if (checkClosedDB.data.settings.applications_enabled !== 'false' && checkClosedDB.data.settings.applications_open !== 'false') {
    throw new Error(`Database check failed! Expected applications_enabled = 'false'`);
  }
  console.log('✓ Database confirmed: applications_enabled is "false"');

  const refreshClosedAdmin = await req('/admin/metrics', { auth: true });
  if (refreshClosedAdmin.data.settings.applications_enabled !== 'false') {
    throw new Error(`Admin refresh failed! Value: ${refreshClosedAdmin.data.settings.applications_enabled}`);
  }
  console.log('✓ Browser refresh confirmed: Button initializes as CLOSED (does NOT reset)');

  const publicAppsClosed = await req('/waitlist/tasks');
  if (publicAppsClosed.data.settings.applicationsOpen !== false) {
    throw new Error(`Public waitlist failed to reflect applicationsOpen = false!`);
  }
  console.log('✓ Public /waitlist confirmed: applicationsOpen is false (submission disabled)');

  // Step B: Turn APPLICATIONS back to OPEN
  console.log('\nClicking APPLICATIONS button: CLOSED -> OPEN...');
  const appsOpenRes = await req('/admin/settings', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ applications_open: 'true' })
  });
  if (!appsOpenRes.ok) throw new Error(`Applications OPEN failed: ${JSON.stringify(appsOpenRes.data)}`);

  const checkOpenDB = await req('/admin/settings', { auth: true });
  if (checkOpenDB.data.settings.applications_enabled !== 'true') {
    throw new Error(`Database check failed! Expected applications_enabled = 'true'`);
  }
  console.log('✓ Database confirmed: applications_enabled is "true"');

  const refreshOpenAdmin = await req('/admin/metrics', { auth: true });
  if (refreshOpenAdmin.data.settings.applications_enabled !== 'true') {
    throw new Error(`Admin refresh failed! Value: ${refreshOpenAdmin.data.settings.applications_enabled}`);
  }
  console.log('✓ Browser refresh confirmed: Button initializes as OPEN');

  const publicAppsOpen = await req('/waitlist/tasks');
  if (publicAppsOpen.data.settings.applicationsOpen !== true) {
    throw new Error(`Public waitlist failed to reflect applicationsOpen = true!`);
  }
  console.log('✓ Public /waitlist confirmed: applicationsOpen is true');


  // -------------------------------------------------------------
  // TEST 3: WALLET CHECKER BUTTON (ON -> OFF -> refresh -> ON)
  // -------------------------------------------------------------
  console.log('\n--- 3. TESTING WALLET CHECKER BUTTON FLOW ---');

  // Step A: Turn WALLET CHECKER to OFF
  console.log('Clicking WALLET CHECKER button: ON -> OFF...');
  const checkerOffRes = await req('/admin/settings', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ wallet_checker_enabled: 'false' })
  });
  if (!checkerOffRes.ok) throw new Error(`Checker OFF failed: ${JSON.stringify(checkerOffRes.data)}`);

  const checkCheckerOffDB = await req('/admin/settings', { auth: true });
  if (checkCheckerOffDB.data.settings.wallet_checker_enabled !== 'false') {
    throw new Error(`Database check failed! Expected wallet_checker_enabled = 'false'`);
  }
  console.log('✓ Database confirmed: wallet_checker_enabled is "false"');

  const refreshCheckerOffAdmin = await req('/admin/metrics', { auth: true });
  if (refreshCheckerOffAdmin.data.settings.wallet_checker_enabled !== 'false') {
    throw new Error(`Admin refresh failed! Value: ${refreshCheckerOffAdmin.data.settings.wallet_checker_enabled}`);
  }
  console.log('✓ Browser refresh confirmed: Button initializes as OFF (does NOT reset)');

  const publicCheckerStatusOff = await req('/checker/status');
  if (publicCheckerStatusOff.data.walletCheckerEnabled !== false) {
    throw new Error(`Public checker status failed to reflect false!`);
  }
  console.log('✓ Public /checker/status confirmed: walletCheckerEnabled is false');

  const publicCheckOff = await req('/checker/check', {
    method: 'POST',
    body: JSON.stringify({ walletAddress: 'zs1testaddress1234567890123456789012345678901234567890123456789012345678901234567890' })
  });
  if (publicCheckOff.status !== 403) {
    throw new Error(`Expected 403 when checker is disabled, got ${publicCheckOff.status}`);
  }
  console.log('✓ Public /checker/check confirmed: Rejected with 403 ("temporarily offline for maintenance")');

  // Step B: Turn WALLET CHECKER back to ON
  console.log('\nClicking WALLET CHECKER button: OFF -> ON...');
  const checkerOnRes = await req('/admin/settings', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ wallet_checker_enabled: 'true' })
  });
  if (!checkerOnRes.ok) throw new Error(`Checker ON failed: ${JSON.stringify(checkerOnRes.data)}`);

  const checkCheckerOnDB = await req('/admin/settings', { auth: true });
  if (checkCheckerOnDB.data.settings.wallet_checker_enabled !== 'true') {
    throw new Error(`Database check failed! Expected wallet_checker_enabled = 'true'`);
  }
  console.log('✓ Database confirmed: wallet_checker_enabled is "true"');

  const refreshCheckerOnAdmin = await req('/admin/metrics', { auth: true });
  if (refreshCheckerOnAdmin.data.settings.wallet_checker_enabled !== 'true') {
    throw new Error(`Admin refresh failed! Value: ${refreshCheckerOnAdmin.data.settings.wallet_checker_enabled}`);
  }
  console.log('✓ Browser refresh confirmed: Button initializes as ON');

  const publicCheckerStatusOn = await req('/checker/status');
  if (publicCheckerStatusOn.data.walletCheckerEnabled !== true) {
    throw new Error(`Public checker status failed to reflect true!`);
  }
  console.log('✓ Public /checker/status confirmed: walletCheckerEnabled is true (online)');

  console.log('\n=====================================================');
  console.log('ALL BUTTON FLOWS, DATABASE CHECKS & REFRESH TESTS PASSED!');
  console.log('=====================================================');

  server.close();
  process.exit(0);
}

runButtonFlowTests().catch(err => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});
