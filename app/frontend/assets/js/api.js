const API_BASE = (window.TBT_API_BASE || '') + '/api/v1';

const _req = async (method, path, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({ success: false, message: 'Server error' }));
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    console.error('Request failed:', error);
    return { ok: false, status: 0, data: { success: false, message: 'Connection failed. Please check your network or try again.' } };
  }
};

const api = {
  get: (path, token) => _req('GET', path, null, token),
  post: (path, body, token) => _req('POST', path, body, token),
  put: (path, body, token) => _req('PUT', path, body, token),
  delete: (path, token) => _req('DELETE', path, null, token),

  getToken: (role = 'user') => localStorage.getItem(`tbt_${role}_token`),
  setToken: (role, token) => localStorage.setItem(`tbt_${role}_token`, token),
  removeToken: (role) => localStorage.removeItem(`tbt_${role}_token`),

  getUser: () => { try { return JSON.parse(localStorage.getItem('tbt_user') || 'null'); } catch { return null; } },
  setUser: (u) => localStorage.setItem('tbt_user', JSON.stringify(u)),
  removeUser: () => localStorage.removeItem('tbt_user'),

  requireAuth: (role = 'user') => {
    const token = localStorage.getItem(`tbt_${role}_token`);
    if (!token) {
      window.location.href = '/user/login.html';
      return null;
    }
    return token;
  },
};
