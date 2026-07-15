// Non-destructive migration for LEGACY zero-score results.
//
// Background: before the fix in utils/scoreCalculator.js, a zero-score
// submission stored EVERY category in `highestCategory` (they all tied at 0),
// which then rendered as a huge comma-separated "Top Category" in the admin
// table. New results now correctly store `[]` for those. This script backfills
// old rows so stored data matches the new rule.
//
// Safety:
//   * Touches ONLY the `highestCategory` field.
//   * Targets ONLY rows with `totalMarks === 0` (a genuine zero-score result
//     has no dominant category) that still have a non-empty `highestCategory`.
//   * DRY RUN by default — prints exactly what it WOULD change and writes
//     nothing. Pass `--apply` to actually update.
//
// Run against the target DB explicitly, e.g.:
//   MONGO_URI="<connection string>" node backend/scripts/migrateZeroScoreTopCategory.js          # dry run
//   MONGO_URI="<connection string>" node backend/scripts/migrateZeroScoreTopCategory.js --apply  # write
//
// Do NOT run against production without approval.
require('dotenv').config();
const mongoose = require('mongoose');
const Result = require('../models/Result');

const QUERY = { totalMarks: 0, 'highestCategory.0': { $exists: true } };

async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Refusing to run.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const dbName = mongoose.connection.name;
  console.log(`Connected to DB: ${dbName}`);
  console.log(`Mode: ${apply ? 'APPLY (will write)' : 'DRY RUN (no writes)'}\n`);

  const candidates = await Result.find(QUERY).select('_id totalMarks percentage highestCategory createdAt');
  console.log(`Found ${candidates.length} zero-score result(s) with a non-empty highestCategory:`);
  for (const r of candidates) {
    console.log(`  ${r._id}  (created ${r.createdAt && r.createdAt.toISOString().slice(0, 10)})  ` +
      `[${(r.highestCategory || []).length} categories] -> []`);
  }

  if (!candidates.length) {
    console.log('\nNothing to migrate.');
  } else if (!apply) {
    console.log('\nDRY RUN complete. Re-run with --apply to set highestCategory = [] on the rows above.');
  } else {
    const res = await Result.updateMany(QUERY, { $set: { highestCategory: [] } });
    console.log(`\nApplied. Modified ${res.modifiedCount} document(s).`);
  }

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
