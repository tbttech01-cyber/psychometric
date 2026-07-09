require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Question = require('../models/Question');
const Setting = require('../models/Setting');
const SharedUserID = require('../models/SharedUserID');
const QuestionSet = require('../models/QuestionSet');
const AssessmentSession = require('../models/AssessmentSession');

// One-time migration to the Question Set model (see CLAUDE.md). Bundles every
// active question into a single "Default Set" and assigns it to every existing
// access code, so the set-scoped assessment flow works without any manual
// admin setup. Idempotent — safe to re-run.
async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  // 1. An admin to own the set (createdBy is required). Any admin works.
  const admin = await Admin.findOne();
  if (!admin) { console.error('No admin found — run the seeder first.'); process.exit(1); }

  // 2. Duration comes from the old global setting so behaviour is unchanged
  //    on day one; 30 is the same fallback assessmentController used before.
  const durationSetting = await Setting.findOne({ key: 'assessment_duration_minutes' });
  const durationMinutes = durationSetting ? Number(durationSetting.value) : 30;

  // 3. All active questions, in global order, become the set's ordered members.
  const questionIds = (await Question.find({ isActive: true }).sort('order').select('_id')).map(q => q._id);
  console.log(`Default Set will contain ${questionIds.length} question(s), ${durationMinutes} min timer.`);

  // 4. Upsert the Default Set (find by name so re-runs don't duplicate it).
  let defaultSet = await QuestionSet.findOne({ name: 'Default Set' });
  if (!defaultSet) {
    defaultSet = await QuestionSet.create({
      name: 'Default Set',
      description: 'All questions — created by the Question Set migration.',
      durationMinutes,
      questionIds,
      createdBy: admin._id,
    });
    console.log(`Created Default Set ${defaultSet._id}.`);
  } else {
    console.log(`Default Set already exists (${defaultSet._id}) — leaving its questions/timer as-is.`);
  }

  // 5. Assign the Default Set to every code that has none yet.
  const assigned = await SharedUserID.updateMany(
    { $or: [{ questionSetId: { $exists: false } }, { questionSetId: null }] },
    { $set: { questionSetId: defaultSet._id } }
  );
  console.log(`Assigned Default Set to ${assigned.modifiedCount} access code(s).`);

  // 6. Backfill any in-progress attempt that predates the snapshot fields, so
  //    it can still submit (an empty snapshot would score against 0 questions).
  //    updateOne per session — each needs its own frozen list/duration.
  const orphanSessions = await AssessmentSession.find({
    status: 'in-progress',
    $or: [{ questionIds: { $exists: false } }, { questionIds: { $size: 0 } }],
  }).select('_id');
  for (const s of orphanSessions) {
    await AssessmentSession.updateOne(
      { _id: s._id },
      { $set: { questionSetId: defaultSet._id, questionIds, durationMinutes } }
    );
  }
  console.log(`Backfilled ${orphanSessions.length} in-progress session(s).`);

  console.log('Migration complete.');
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
