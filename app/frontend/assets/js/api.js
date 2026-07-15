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
    // Session-expiry handling in one place: an *authenticated* request (a token
    // was sent) that comes back 401 means the token is no longer valid
    // server-side — clear local state and bounce to login. Requests without a
    // token (login / register / OTP / code validation) are excluded, so their
    // own 401s (e.g. bad credentials) surface to the caller as normal.
    if (token && res.status === 401 && typeof window !== 'undefined') {
      api.clearSession();
      if (!window.location.pathname.endsWith('/login.html'))
        window.location.href = '/user/login.html';
    }
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

  // --- Post-login access-code gate -------------------------------------------
  // The candidate must validate an access code (POST /user/select-code) after
  // logging in before the assessment unlocks. The server enforces this too
  // (assessment endpoints 403 with code CODE_REQUIRED until then); these helpers
  // keep the client navigation in step and hold the selected code for display.
  setCode: (codeId, code) => {
    localStorage.setItem('tbt_code_id', codeId);
    localStorage.setItem('tbt_code', code || '');
    localStorage.setItem('tbt_code_selected', '1');
  },
  getCode: () => localStorage.getItem('tbt_code') || '',
  hasCode: () => localStorage.getItem('tbt_code_selected') === '1',
  clearCode: () => {
    localStorage.removeItem('tbt_code_id');
    localStorage.removeItem('tbt_code');
    localStorage.removeItem('tbt_code_selected');
  },
  // Route guard for pages behind the Access Code step (welcome). Sends the user
  // back to the access-code screen if the step hasn't been completed this login.
  requireCode: () => {
    if (localStorage.getItem('tbt_code_selected') !== '1') {
      window.location.href = '/user/index.html';
      return false;
    }
    return true;
  },

  // Full teardown on logout / session expiry: auth token, cached user, the
  // access-code gate, and any in-progress assessment session state.
  clearSession: () => {
    localStorage.removeItem('tbt_user_token');
    localStorage.removeItem('tbt_user');
    localStorage.removeItem('tbt_code_id');
    localStorage.removeItem('tbt_code');
    localStorage.removeItem('tbt_code_selected');
    localStorage.removeItem('tbt_session_id');
    localStorage.removeItem('tbt_session_expires');
  },
};
