const Notification = require('../models/Notification');

// Best-effort, idempotent notification creation. Notifications are a secondary
// concern: a failure here must NEVER break the primary flow (submitting an
// assessment, creating a retest request), so every error is swallowed. The
// unique (type, entityId) index makes retries a no-op instead of a duplicate.
async function notify(data) {
  try {
    await Notification.create(data);
  } catch (err) {
    if (err && err.code === 11000) return; // duplicate event → already notified
    console.error('Notification create failed:', err && err.message);
  }
}

module.exports = { notify };
