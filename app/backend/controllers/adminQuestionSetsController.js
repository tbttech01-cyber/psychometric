const QuestionSet = require('../models/QuestionSet');
const Question = require('../models/Question');
const SharedUserID = require('../models/SharedUserID');

// Dedupe an incoming questionIds array (order-preserving — the array order is
// the per-set question order) and verify every id references a real Question.
// Returns { ids } on success, or sends a 400 and returns { error: true }.
async function normalizeQuestionIds(questionIds, res) {
  const seen = new Set();
  const ids = [];
  for (const id of questionIds) {
    const key = String(id);
    if (!seen.has(key)) { seen.add(key); ids.push(id); }
  }
  const found = await Question.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) {
    res.status(400).json({ success: false, message: 'One or more selected questions do not exist.' });
    return { error: true };
  }
  return { ids };
}

exports.listSets = async (req, res, next) => {
  try {
    const sets = await QuestionSet.find().sort({ createdAt: -1 }).lean();
    // Count codes assigned to each set in one query rather than N.
    const counts = await SharedUserID.aggregate([
      { $match: { questionSetId: { $ne: null } } },
      { $group: { _id: '$questionSetId', count: { $sum: 1 } } },
    ]);
    const assignedBySet = Object.fromEntries(counts.map(c => [String(c._id), c.count]));
    const data = sets.map(s => ({
      ...s,
      questionCount: (s.questionIds || []).length,
      assignedCodeCount: assignedBySet[String(s._id)] || 0,
    }));
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
};

exports.getSet = async (req, res, next) => {
  try {
    const set = await QuestionSet.findById(req.params.id)
      .populate('questionIds', 'text order typeId dimension questionType marks');
    if (!set) return res.status(404).json({ success: false, message: 'Question set not found.' });
    res.json({ success: true, data: set });
  } catch (err) { next(err); }
};

exports.createSet = async (req, res, next) => {
  try {
    const { name, description = '', durationMinutes, questionIds } = req.body;
    const { ids, error } = await normalizeQuestionIds(questionIds, res);
    if (error) return;
    const doc = await QuestionSet.create({
      name: name.trim(), description, durationMinutes, questionIds: ids,
      createdBy: req.admin._id,
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    // Duplicate name → the unique index throws E11000; surface it as a 409.
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'A question set with that name already exists.' });
    next(err);
  }
};

exports.updateSet = async (req, res, next) => {
  try {
    const { name, description, durationMinutes, questionIds, isActive } = req.body;
    const { ids, error } = await normalizeQuestionIds(questionIds, res);
    if (error) return;
    const update = { name: name.trim(), durationMinutes, questionIds: ids };
    if (description !== undefined) update.description = description;
    if (isActive !== undefined) update.isActive = isActive;
    const doc = await QuestionSet.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Question set not found.' });
    res.json({ success: true, data: doc });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'A question set with that name already exists.' });
    next(err);
  }
};

exports.deleteSet = async (req, res, next) => {
  try {
    // Block deletion while any access code still points at this set — the
    // admin must reassign those cohorts first, so no code is left dangling.
    // (In-progress attempts are safe regardless: they snapshot their own
    // questions onto the session.)
    const assignedCodes = await SharedUserID.find({ questionSetId: req.params.id }).select('code');
    if (assignedCodes.length) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete: this set is still assigned to ${assignedCodes.length} access code(s). Reassign them first.`,
        codes: assignedCodes.map(c => c.code),
      });
    }
    const doc = await QuestionSet.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Question set not found.' });
    res.json({ success: true });
  } catch (err) { next(err); }
};
