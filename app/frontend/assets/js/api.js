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
      // Login is served at "/"; don't bounce if we're already there.
      if (window.location.pathname !== '/')
        window.location.replace('/');
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
      window.location.replace('/');
      return null;
    }
    return token;
  },

  // bfcache hardening: when a protected page is restored from the browser's
  // back/forward cache (persisted=true), its guard scripts do NOT re-run, which
  // would let the back button reveal a page the user should no longer see (e.g.
  // the assessment after submitting). Force a fresh load so every guard re-runs.
  protectBack: () => {
    window.addEventListener('pageshow', (e) => { if (e.persisted) window.location.reload(); });
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
      window.location.replace('/assessment-code');
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

  // Shared logout-with-confirmation used by the candidate pages (welcome,
  // access-code, result). Injects a themed modal on first use; Cancel /
  // overlay-click / Escape dismiss it, Confirm revokes the token, clears
  // session state, and returns to login. Duplicate-click safe.
  logoutWithConfirm: (token) => {
    let modal = document.getElementById('tbt-logout-modal');
    if (modal) { modal.classList.remove('hidden'); modal.querySelector('[data-act="cancel"]').focus(); return; }
    modal = document.createElement('div');
    modal.id = 'tbt-logout-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Confirm logout');
    modal.innerHTML =
      '<div class="card w-full max-w-sm text-center">' +
      '<div class="text-4xl mb-3">👋</div>' +
      '<h3 class="text-lg font-bold mb-1" style="color:var(--tbt-primary)">Logout?</h3>' +
      '<p class="text-sm mb-5" style="color:var(--tbt-muted)">Are you sure you want to logout?</p>' +
      '<div class="flex gap-3">' +
      '<button data-act="cancel" class="btn btn-outline flex-1">Cancel</button>' +
      '<button data-act="confirm" class="btn btn-primary flex-1">Yes, Logout</button>' +
      '</div></div>';
    document.body.appendChild(modal);
    const close = () => modal.classList.add('hidden');
    modal.querySelector('[data-act="cancel"]').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
    modal.querySelector('[data-act="confirm"]').addEventListener('click', async () => {
      const b = modal.querySelector('[data-act="confirm"]');
      b.disabled = true; b.textContent = 'Logging out...';
      await api.post('/user/logout', {}, token).catch(() => {});
      api.clearSession();
      window.location.replace('/');
    });
    modal.querySelector('[data-act="cancel"]').focus();
  },
};
