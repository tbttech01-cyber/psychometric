require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Question = require('../models/Question');

// One-time, idempotent backfill of Question.language. Existing questions have
// no language value; this normalizes any legacy/variant value to the canonical
// 'en' | 'ta' and defaults everything else to English — WITHOUT touching text,
// answers, marks, dimensions, order, set assignment, or audio. Safe to re-run.
//
//   MONGO_URI="<uri>" node backend/scripts/migrateQuestionLanguage.js
function normalizeLanguage(value) {
  const v = String(value == null ? '' : value).trim().toLowerCase();
  if (v === 'ta' || v === 'tamil' || v === 'ta-in' || v === 'ta_in') return 'ta';
  if (v === 'en' || v === 'english' || v === 'en-us' || v === 'en_us' || v === 'en-in') return 'en';
  return 'en'; // missing / unknown -> safe English default
}

async function migrateQuestionLanguage({ log = () => {} } = {}) {
  const summary = { total: 0, updated: 0, skipped: 0, errors: 0 };
  // Read raw docs (lean) so a not-yet-set field is visible as undefined rather
  // than filled by the schema default on hydrate.
  const rows = await Question.find({}).select('_id language').lean();
  summary.total = rows.length;
  for (const r of rows) {
    try {
      const desired = normalizeLanguage(r.language);
      if (r.language === desired) { summary.skipped++; continue; }
      await Question.updateOne({ _id: r._id }, { $set: { language: desired } });
      summary.updated++;
    } catch (err) {
      summary.errors++;
      log(`  error on ${r._id}: ${(err && err.message) || err}`);
    }
  }
  log(`Questions: ${summary.total} total | ${summary.updated} updated | ${summary.skipped} already correct | ${summary.errors} errors`);
  return summary;
}

module.exports = { migrateQuestionLanguage, normalizeLanguage };

if (require.main === module) {
  (async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');
    const summary = await migrateQuestionLanguage({ log: (m) => console.log(m) });
    console.log('Done:', JSON.stringify(summary));
    await mongoose.disconnect();
    process.exit(0);
  })().catch((err) => { console.error(err); process.exit(1); });
}
