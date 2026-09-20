const API_BASE = '/api';

export function getSessionToken() {
  return localStorage.getItem('zeckshark_session_token') || '';
}

export function setSessionToken(token) {
  if (token) {
    localStorage.setItem('zeckshark_session_token', token);
  }
}

export function getAdminToken() {
  return localStorage.getItem('zeckshark_admin_token') || '';
}

export function setAdminToken(token) {
  if (token) {
    localStorage.setItem('zeckshark_admin_token', token);
  } else {
    localStorage.removeItem('zeckshark_admin_token');
  }
}

export async function fetchApi(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const sessionToken = getSessionToken();
  if (sessionToken) {
    headers['x-session-token'] = sessionToken;
  }

  const adminToken = getAdminToken();
  if (adminToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({ success: false, error: 'Failed to parse response' }));

  if (data.sessionToken) {
    setSessionToken(data.sessionToken);
  }

  return { ok: res.ok, status: res.status, data };
}
