/**
 * Populates the Business Matrix with a full 8x8 sample grid over the eight
 * personality traits (QuestionType categories order 1-8), each cell a business
 * recommendation matched to its trait pair. Safe to re-run (clears existing
 * cells first). The same data is also loadable from the admin panel via the
 * "Load sample data" button (POST /admin/business-matrix/seed-sample) — both
 * share backend/utils/businessMatrixSample.js.
 *
 *   node backend/scripts/seedBusinessMatrixDummy.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { seedSampleMatrix } = require('../utils/businessMatrixSample');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const { created, cleared } = await seedSampleMatrix();
    console.log(`Business matrix seed done: cleared ${cleared}, created ${created} cells (full 8x8 trait grid).`);
  } catch (err) {
    if (err.code === 'MISSING_TYPES') console.log(err.message + ' Run the main seed first. Aborting.');
    else throw err;
  }
  await mongoose.disconnect();
}
run().catch((err) => { console.error(err); process.exit(1); });
