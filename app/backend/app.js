const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const mongoose = require('mongoose');

const app = express();

// Running behind a reverse proxy (Vercel, Render) — trust its X-Forwarded-For
// so express-rate-limit identifies real client IPs instead of throwing.
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
// Each of these can be a comma-separated list — Vercel assigns several valid
// domains (team alias, personal alias, deployment-specific alias, etc.) to
// every project, and any of them may be the one a browser actually loads.
const splitOrigins = (v) => (v || '').split(',').map(s => s.trim()).filter(Boolean);
const corsOrigins = [
  ...splitOrigins(process.env.USER_APP_URL),
  ...splitOrigins(process.env.ADMIN_APP_URL),
  ...splitOrigins(process.env.ADMIN_WEB_URL),
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);

    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Always allow localhost and Vercel domains (including preview/branch deployments)
    const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin);
    const isVercel = /\.vercel\.app$/.test(origin);

    if (isLocalhost || isVercel) {
      return callback(null, true);
    }

    // If no origins configured, default to allowing it
    if (corsOrigins.length === 0) {
      return callback(null, true);
    }

    return callback(null, false);
  }
}));
// Raised from the 100kb default so admin-uploaded question audio (stored as a
// base64 data URI on the Question — see adminCRUDController) fits in the body.
// Uploads are capped client-side at ~3MB (→ ~4MB base64) to also stay under
// Vercel's ~4.5MB serverless request-body limit; 8mb here leaves headroom for
// the encoded audio plus the rest of the question payload (options, etc.).
app.use(express.json({ limit: '8mb' }));

// On a persistent server (server.js), connectDB() already runs once at boot,
// so this is a no-op (readyState is already 1). On a serverless platform
// (e.g. Vercel), there's no boot-time hook — the connection has to be
// established lazily on first request and cached across warm invocations.
// Placed after cors() so CORS preflight (OPTIONS) is answered immediately
// without waiting on — or failing because of — the database.
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  try {
    if (!global.__tbtMongoConnect) global.__tbtMongoConnect = mongoose.connect(process.env.MONGO_URI);
    await global.__tbtMongoConnect;
    next();
  } catch (err) {
    global.__tbtMongoConnect = undefined;
    next(err);
  }
});
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
app.use('/api/v1/admin', require('./routes/adminQuestionSets'));
app.use('/api/v1/_migrate', require('./routes/tempMigrate')); // TEMP: remove after prod Question Set migration
app.use('/api/v1/user', require('./routes/userAuth'));
app.use('/api/v1/assessment', require('./routes/assessment'));

// SPA fallback — serve index.html for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/user/index.html'));
});

app.use(require('./middleware/errorHandler'));

module.exports = app;
