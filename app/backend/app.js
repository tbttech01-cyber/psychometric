const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
const corsOrigins = [process.env.USER_APP_URL, process.env.ADMIN_APP_URL, process.env.ADMIN_WEB_URL].filter(Boolean);
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : {}));
app.use(express.json());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// The legacy vanilla admin UI has been retired — admin-web (Next.js) is the
// single admin application now. Send old bookmarks/links there instead of
// falling through to the user-app SPA fallback below.
app.get(['/admin', '/admin/*'], (req, res) => {
  if (process.env.ADMIN_WEB_URL) return res.redirect(process.env.ADMIN_WEB_URL);
  res.status(404).send('The admin UI has moved. Set ADMIN_WEB_URL to enable redirecting here.');
});

// Rate limiting on auth endpoints
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { success: false, message: 'Too many requests. Please wait a minute.' } });
app.use('/api/v1/admin/login', authLimiter);
app.use('/api/v1/user/login', authLimiter);
app.use('/api/v1/user/verify-otp', authLimiter);

// Routes
app.use('/api/v1/admin', require('./routes/adminAuth'));
app.use('/api/v1/admin', require('./routes/adminCRUD'));
app.use('/api/v1/admin', require('./routes/adminDashboard'));
app.use('/api/v1/admin', require('./routes/adminBusinessMatrix'));
app.use('/api/v1/user', require('./routes/userAuth'));
app.use('/api/v1/assessment', require('./routes/assessment'));

// SPA fallback — serve index.html for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/user/index.html'));
});

app.use(require('./middleware/errorHandler'));

module.exports = app;
