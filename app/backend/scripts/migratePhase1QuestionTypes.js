require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Question = require('../models/Question');
const QuestionType = require('../models/QuestionType');

// Every existing QuestionType.name happens to exactly match one of the 12
// canonical dimensions (hand-verified against the live DB, not assumed) —
// this is a one-time mapping, not a structural guarantee, which is why it
// lives here rather than as a schema default.
const CATEGORY_TO_DIMENSION = {
  'Communication': 'Communication',
  'Creativity': 'Creativity',
  'Problem Solving': 'Problem Solving',
  'Leadership': 'Leadership',
  'Risk Taking': 'Risk Taking',
  'Financial Awareness': 'Financial Awareness',
  'Business Mindset': 'Business Mindset',
  'Teamwork': 'Teamwork',
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  // 1. Backfill Question.dimension/questionType/marks for existing rows.
  const types = await QuestionType.find();
  const typeNameById = Object.fromEntries(types.map((t) => [t._id.toString(), t.name]));
  const questions = await Question.find({ dimension: { $exists: false } });
  console.log(`Backfilling ${questions.length} question(s)...`);
  let backfilled = 0;
  for (const q of questions) {
    const catName = typeNameById[q.typeId.toString()];
    const dimension = CATEGORY_TO_DIMENSION[catName];
    if (!dimension) {
      console.warn(`  SKIP ${q._id}: category "${catName}" has no dimension mapping — set manually.`);
      continue;
    }
    // A plain updateOne (not q.save()) deliberately skips full-document
    // validation — some soft-deleted questions carry a negative sentinel
    // `order` (see adminCRUDController.js::deleteQuestion) that predates
    // this migration and would otherwise fail Question.order's min:1 rule
    // on an unrelated field.
    await Question.updateOne(
      { _id: q._id },
      { $set: { dimension, questionType: 'LIKERT_SCALE', marks: 5 } }
    );
    backfilled++;
  }
  console.log(`  Backfilled ${backfilled} question(s).`);

  // 2. Rename AnswerOption.label -> optionText, marks -> score, on the raw
  //    collection (bypasses Mongoose so the old field names are still
  //    readable — the new schema doesn't declare them, so a normal Mongoose
  //    query would silently ignore them instead of letting us read/rename).
  const coll = mongoose.connection.collection('answeroptions');
  const renameResult = await coll.updateMany(
    { label: { $exists: true } },
    { $rename: { label: 'optionText', marks: 'score' } }
  );
  console.log(`Renamed fields on ${renameResult.modifiedCount} answer option(s).`);

  console.log('Migration complete.');
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
