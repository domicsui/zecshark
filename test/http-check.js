async function testEndpoints() {
  const tests = [
    { name: 'Root HTML page', url: 'http://localhost:5000/', method: 'GET' },
    { name: 'Official Logo Image', url: 'http://localhost:5000/assets/zeckshark-logo.jpg', method: 'GET' },
    { name: 'Official Banner Image', url: 'http://localhost:5000/assets/zeckshark-banner.png', method: 'GET' },
    { name: 'Real Stats Counter', url: 'http://localhost:5000/api/stats', method: 'GET' },
    { name: 'Public Settings', url: 'http://localhost:5000/api/settings', method: 'GET' },
    { name: 'Waitlist Tasks', url: 'http://localhost:5000/api/waitlist/tasks', method: 'GET' },
    { 
      name: 'Wallet Checker (Whitelisted)',
      url: 'http://localhost:5000/api/checker/check', 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: '0x71c8364437f5fa08f4e8e76313b8959d99723223' })
    },
    { 
      name: 'Wallet Checker (Non-Whitelisted)',
      url: 'http://localhost:5000/api/checker/check', 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: '0x0000000000000000000000000000000000001234' })
    },
    { 
      name: 'Admin Login',
      url: 'http://localhost:5000/api/admin/login', 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'zeckshark2026!' })
    }
  ];

  console.log('--- TESTING LIVE RUNNING HTTP ENDPOINTS ---');
  for (const t of tests) {
    try {
      const res = await fetch(t.url, { method: t.method, headers: t.headers, body: t.body });
      const contentType = res.headers.get('content-type') || '';
      let snippet = '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        snippet = JSON.stringify(json);
      } else {
        const buf = await res.arrayBuffer();
        snippet = `[${contentType}] size: ${buf.byteLength} bytes`;
      }
      console.log(`[${res.status}] ${t.name} -> ${snippet.substring(0, 110)}`);
    } catch (err) {
      console.error(`FAILED ${t.name}:`, err.message);
    }
  }
}

testEndpoints();
