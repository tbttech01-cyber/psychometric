// Vercel serverless entrypoint. Project root is app/ (where package.json and
// node_modules live, matching render.yaml's rootDir) — this bridges to the
// actual Express app in backend/app.js, which handles its own lazy DB
// connection (see the connection middleware near the top of that file).
module.exports = require('../backend/app');
