// Writes assets/js/env.js from the TBT_API_BASE env var at build time.
// Only matters for standalone hosting (e.g. Vercel) that has no server to
// serve this relative to — the default (unset) keeps same-origin behavior
// for the Express single-server deployment (see assets/js/env.js).
const fs = require('fs');
const path = require('path');

const apiBase = process.env.TBT_API_BASE || '';
const out = `window.TBT_API_BASE = ${JSON.stringify(apiBase)};\n`;
fs.writeFileSync(path.join(__dirname, 'assets/js/env.js'), out);
console.log('Wrote assets/js/env.js with TBT_API_BASE =', apiBase || '(empty — same-origin)');
