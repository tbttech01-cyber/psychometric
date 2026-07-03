/**
 * Populates the Business Matrix (8x8 category-pair recommendation grid) with
 * the exact demo content shown in the reference design (Psychometric_removed.pdf,
 * "Business Matrix Management" page). That page's table overflows its own PDF
 * frame, so only columns 0-4 (Communication..Risk Taking) were ever rendered —
 * columns 5-7 (Financial Awareness/Business Mindset/Teamwork as columns) have
 * no source data and are intentionally left unconfigured, same as the source.
 *
 * Safe to re-run: clears existing cells first, so it always converges on this
 * exact dataset rather than layering on top of previous (e.g. randomized) seeds.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const QuestionType = require('../models/QuestionType');
const BusinessMatrixCell = require('../models/BusinessMatrixCell');

// [rowIndex][colIndex] = [businessName, rating, isActive] — read directly off
// the reference design's node cards (NODE ID: B<row><col>), row/col 0-4 only.
const GRID = {
  0: { 0: ['Strategic Branding', 1, true], 1: ['Budget Control', 3, true], 2: ['Design Director', 1, false], 3: ['Logic Analyst', 2, true], 4: ['VC Analyst', 4, true] },
  1: { 0: ['Corp Strategy', 2, true], 1: ['Strategic Branding', 3, true], /* 2: empty in source */ 3: ['Logic Analyst', 3, false], 4: ['Operations Management', 1, true] },
  2: { 0: ['Corp Strategy', 2, true], 1: ['HR Facilitation', 5, true], 2: ['Design Director', 5, true], 3: ['Strategic Branding', 1, true], 4: ['Operations Management', 3, true] },
  3: { 0: ['Operations Management', 4, true], 1: ['Design Director', 2, false], 2: ['Operations Management', 3, true], 3: ['Budget Control', 4, true], 4: ['Design Director', 3, true] },
  4: { 0: ['Logistics Lead', 5, true], 1: ['Budget Control', 4, false], 2: ['Operations Management', 1, true], 3: ['Design Director', 3, true], 4: ['Executive Coaching', 2, true] },
  5: { 0: ['Strategic Branding', 1, true], 1: ['VC Analyst', 1, true], 2: ['Executive Coaching', 4, false], 3: ['Operations Management', 5, true], 4: ['Budget Control', 3, true] },
  6: { 0: ['Logic Analyst', 3, true], 1: ['HR Facilitation', 3, false], 2: ['Operations Management', 3, true], 3: ['Logistics Lead', 1, true], 4: ['Logistics Lead', 2, true] },
  7: { 0: ['Executive Coaching', 2, true], 1: ['Corp Strategy', 1, true], 2: ['Corp Strategy', 3, true], 3: ['Corp Strategy', 4, true], 4: ['Corp Strategy', 4, true] },
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const types = await QuestionType.find({ isActive: true }).sort({ order: 1 });
  if (types.length !== 8) {
    console.log(`Expected 8 active question types, found ${types.length}. Run the main seed first. Aborting.`);
    await mongoose.disconnect();
    return;
  }

  const { deletedCount } = await BusinessMatrixCell.deleteMany({});
  console.log(`Cleared ${deletedCount} existing cell(s).`);

  let created = 0;
  for (const [ri, row] of Object.entries(GRID)) {
    for (const [ci, [businessName, rating, isActive]] of Object.entries(row)) {
      await BusinessMatrixCell.create({
        rowTypeId: types[ri]._id,
        colTypeId: types[ci]._id,
        businessName,
        rating,
        isActive,
      });
      created++;
    }
  }

  console.log(`Business matrix seed done: ${created} cells created (matching the reference design exactly). Columns 5-7 left unconfigured — no source data for those.`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
