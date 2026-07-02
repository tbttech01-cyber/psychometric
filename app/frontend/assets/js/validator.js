const Validator = {
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  password: v => v && v.length >= 6,
  required: v => v !== undefined && v !== null && String(v).trim() !== '',
  otp: v => /^\d{6}$/.test(v),

  show(fieldId, msg) {
    const el = document.getElementById(`${fieldId}-error`);
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
    const input = document.getElementById(fieldId);
    if (input) input.classList.add('border-red-500');
  },

  clear(fieldId) {
    const el = document.getElementById(`${fieldId}-error`);
    if (el) { el.textContent = ''; el.classList.add('hidden'); }
    const input = document.getElementById(fieldId);
    if (input) input.classList.remove('border-red-500');
  },

  clearAll(fieldIds) { fieldIds.forEach(f => this.clear(f)); },
};

function showToast(msg, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
