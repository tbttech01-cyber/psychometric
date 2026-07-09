// TEMPORARY one-time endpoint to run the Question Set migration against the
// production database using the app's own runtime connection (production
// MONGO_URI is a "sensitive" Vercel env var and can't be pulled by CI).
// Protected by the standard admin JWT middleware — no secret lives in source.
// DELETE this file and its mount in app.js right after the migration has run.
const router = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const Admin = require('../models/Admin');
const Question = require('../models/Question');
const Setting = require('../models/Setting');
const SharedUserID = require('../models/SharedUserID');
const QuestionSet = require('../models/QuestionSet');
const AssessmentSession = require('../models/AssessmentSession');

router.use(adminAuth);

// Same steps as backend/scripts/migrateQuestionSets.js, minus the connect/exit
// (the request already has a live mongoose connection). Idempotent.
router.post('/question-sets', async (req, res, next) => {
  try {
    const admin = await Admin.findOne();
    if (!admin) return res.status(400).json({ success: false, message: 'No admin found.' });

    const durationSetting = await Setting.findOne({ key: 'assessment_duration_minutes' });
    const durationMinutes = durationSetting ? Number(durationSetting.value) : 30;
    const questionIds = (await Question.find({ isActive: true }).sort('order').select('_id')).map(q => q._id);

    let defaultSet = await QuestionSet.findOne({ name: 'Default Set' });
    let createdSet = false;
    if (!defaultSet) {
      defaultSet = await QuestionSet.create({
        name: 'Default Set',
        description: 'All questions — created by the Question Set migration.',
        durationMinutes, questionIds, createdBy: admin._id,
      });
      createdSet = true;
    }

    const assigned = await SharedUserID.updateMany(
      { $or: [{ questionSetId: { $exists: false } }, { questionSetId: null }] },
      { $set: { questionSetId: defaultSet._id } }
    );

    const orphans = await AssessmentSession.find({
      status: 'in-progress',
      $or: [{ questionIds: { $exists: false } }, { questionIds: { $size: 0 } }],
    }).select('_id');
    for (const s of orphans) {
      await AssessmentSession.updateOne({ _id: s._id }, { $set: { questionSetId: defaultSet._id, questionIds, durationMinutes } });
    }

    res.json({
      success: true,
      defaultSetId: defaultSet._id,
      createdDefaultSet: createdSet,
      questionCount: questionIds.length,
      durationMinutes,
      codesAssigned: assigned.modifiedCount,
      sessionsBackfilled: orphans.length,
    });
  } catch (err) { next(err); }
});

module.exports = router;
