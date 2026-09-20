const http = require('http');
const app = require('../server/index');
const { initDB } = require('../server/db');

async function testLogin() {
  await initDB();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  console.log('Testing Admin Login with new credentials:');

  // Test 1: Login with zecshark / zecshark@6644
  const res1 = await fetch(`${baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'zecshark', password: 'zecshark@6644' })
  });
  const data1 = await res1.json();
  console.log('Login attempt for zecshark / zecshark@6644:', {
    status: res1.status,
    success: data1.success,
    admin: data1.admin
  });
  if (!data1.success || data1.admin?.username !== 'zecshark') {
    throw new Error('Login failed for zecshark / zecshark@6644');
  }
  console.log('✓ Login successful for @zecshark');

  // Test 2: Verify /admin/me with token
  const res2 = await fetch(`${baseUrl}/admin/me`, {
    headers: { 'Authorization': `Bearer ${data1.token}` }
  });
  const data2 = await res2.json();
  console.log('/admin/me session verification:', data2);
  if (!data2.admin || data2.admin.username !== 'zecshark') {
    throw new Error('/admin/me failed');
  }
  console.log('✓ Session verified for @zecshark');

  // Test 3: Login with admin / zecshark@6644
  const res3 = await fetch(`${baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'zecshark@6644' })
  });
  const data3 = await res3.json();
  console.log('Login attempt for admin / zecshark@6644:', {
    status: res3.status,
    success: data3.success,
    admin: data3.admin
  });
  if (!data3.success) {
    throw new Error('Compatibility login failed for admin / zecshark@6644');
  }
  console.log('✓ Login successful for compatible username @admin');

  server.close();
  console.log('All login tests passed!');
  process.exit(0);
}

testLogin().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
