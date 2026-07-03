const bcrypt = require('bcryptjs');
const SharedUserID = require('../models/SharedUserID');
const QuestionType = require('../models/QuestionType');
const Question = require('../models/Question');
const AnswerOption = require('../models/AnswerOption');
const AssessmentSession = require('../models/AssessmentSession');
const User = require('../models/User');

// ── Shared User IDs ─────────────────────────────────────────────────────────
exports.listSharedIDs = async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = search ? { $or: [{ code: new RegExp(search, 'i') }, { label: new RegExp(search, 'i') }] } : {};
    const data = await SharedUserID.find(query).sort({ createdAt: -1 }).populate('createdBy', 'email');
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
};

exports.createSharedID = async (req, res, next) => {
  try {
    const { code, label } = req.body;
    const exists = await SharedUserID.findOne({ code: code.toUpperCase() });
    if (exists) return res.status(409).json({ success: false, message: 'Code already exists.' });
    const doc = await SharedUserID.create({ code: code.toUpperCase(), label, createdBy: req.admin._id });
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.updateSharedID = async (req, res, next) => {
  try {
    const doc = await SharedUserID.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.deleteSharedID = async (req, res, next) => {
  try {
    await SharedUserID.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.sharedIDStats = async (req, res, next) => {
  try {
    const doc = await SharedUserID.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found.' });
    const users = await User.find({ sharedUserID: req.params.id }).select('name email createdAt');
    res.json({ success: true, usageCount: doc.usageCount, users });
  } catch (err) { next(err); }
};

// ── Question Types ───────────────────────────────────────────────────────────
exports.listQuestionTypes = async (req, res, next) => {
  try {
    const data = await QuestionType.find().sort('order');
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.createQuestionType = async (req, res, next) => {
  try {
    const activeCount = await QuestionType.countDocuments({ isActive: true });
    if (activeCount >= 8) return res.status(400).json({ success: false, message: 'Maximum 8 active question types allowed.' });
    const doc = await QuestionType.create(req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.updateQuestionType = async (req, res, next) => {
  try {
    if (req.body.order !== undefined) {
      const current = await QuestionType.findById(req.params.id);
      if (!current) return res.status(404).json({ success: false, message: 'Not found.' });
      if (current.order !== req.body.order) {
        const clash = await QuestionType.findOne({ order: req.body.order, _id: { $ne: req.params.id } });
        if (clash) {
          // Swap via a temporary out-of-range sentinel so the unique index is never violated mid-swap.
          await QuestionType.findByIdAndUpdate(clash._id, { order: 0 });
          await QuestionType.findByIdAndUpdate(req.params.id, { order: req.body.order });
          await QuestionType.findByIdAndUpdate(clash._id, { order: current.order });
        }
      }
    }
    const doc = await QuestionType.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.deleteQuestionType = async (req, res, next) => {
  try {
    const hasQ = await Question.exists({ typeId: req.params.id, isActive: true });
    if (hasQ) return res.status(400).json({ success: false, message: 'Cannot delete: active questions are linked.' });
    await QuestionType.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── Questions ────────────────────────────────────────────────────────────────
exports.listQuestions = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.typeId) filter.typeId = req.query.typeId;
    const data = await Question.find(filter).sort('order').populate('typeId', 'name color');
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getQuestion = async (req, res, next) => {
  try {
    const q = await Question.findById(req.params.id).populate('typeId', 'name');
    if (!q) return res.status(404).json({ success: false, message: 'Not found.' });
    const options = await AnswerOption.find({ questionId: q._id }).sort('order');
    res.json({ success: true, data: { ...q.toObject(), options } });
  } catch (err) { next(err); }
};

exports.createQuestion = async (req, res, next) => {
  try {
    const { typeId } = req.body;
    const activeCount = await Question.countDocuments({ typeId, isActive: true });
    if (activeCount >= 5)
      return res.status(400).json({ success: false, message: 'This category already has 5 active questions.' });
    const doc = await Question.create(req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.updateQuestion = async (req, res, next) => {
  try {
    const doc = await Question.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.deleteQuestion = async (req, res, next) => {
  try {
    await Question.findByIdAndUpdate(req.params.id, { isActive: false });
    await AnswerOption.updateMany({ questionId: req.params.id }, { $set: { order: 0 } }); // soft deactivate
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── Answer Options ───────────────────────────────────────────────────────────
exports.listAnswerOptions = async (req, res, next) => {
  try {
    const data = await AnswerOption.find({ questionId: req.query.questionId }).sort('order');
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.createAnswerOption = async (req, res, next) => {
  try {
    const count = await AnswerOption.countDocuments({ questionId: req.body.questionId });
    if (count >= 5) return res.status(400).json({ success: false, message: 'Max 5 options per question.' });
    const doc = await AnswerOption.create(req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.updateAnswerOption = async (req, res, next) => {
  try {
    const doc = await AnswerOption.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.deleteAnswerOption = async (req, res, next) => {
  try {
    const opt = await AnswerOption.findById(req.params.id);
    if (!opt) return res.status(404).json({ success: false, message: 'Not found.' });
    const used = await AssessmentSession.exists({ status: { $in: ['in-progress', 'submitted'] } });
    if (used) return res.status(400).json({ success: false, message: 'Cannot delete: options have been used in sessions.' });
    await opt.deleteOne();
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── Users ────────────────────────────────────────────────────────────────────
exports.listUsers = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { sharedCode: new RegExp(search, 'i') },
      ];
    }
    if (status === 'verified') filter.isVerified = true;
    if (status === 'unverified') filter.isVerified = false;
    if (status === 'completed') filter.hasCompletedAssessment = true;

    const [total, totalUsers, verifiedUsers, completedUsers, data] = await Promise.all([
      User.countDocuments(filter),
      User.countDocuments(),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ hasCompletedAssessment: true }),
      User.find(filter)
        .select('-passwordHash -otpCode -otpExpiry -activeToken')
        .sort({ createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit),
    ]);

    res.json({
      success: true,
      data,
      total,
      page: +page,
      pages: Math.ceil(total / +limit),
      stats: { totalUsers, verifiedUsers, completedUsers, pendingUsers: totalUsers - verifiedUsers },
    });
  } catch (err) { next(err); }
};

async function generateCandidateId() {
  let candidateId, exists = true;
  while (exists) {
    candidateId = `TBT-ID-${Math.floor(1000 + Math.random() * 9000)}`;
    exists = await User.exists({ candidateId });
  }
  return candidateId;
}

exports.generateCandidateId = async (req, res, next) => {
  try {
    res.json({ success: true, candidateId: await generateCandidateId() });
  } catch (err) { next(err); }
};

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, sharedCode, phone, batch, accessExpiry, restrictedAccess, candidateId: requestedCandidateId } = req.body;
    const lEmail = email.toLowerCase();

    const existing = await User.findOne({ email: lEmail });
    if (existing) return res.status(409).json({ success: false, message: 'Email already registered.' });

    const shared = await SharedUserID.findOne({ code: sharedCode.toUpperCase() });
    if (!shared) return res.status(400).json({ success: false, message: 'Invalid shared code.' });

    if (requestedCandidateId && await User.exists({ candidateId: requestedCandidateId }))
      return res.status(409).json({ success: false, message: 'Candidate ID already in use.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const candidateId = requestedCandidateId || await generateCandidateId();
    const user = await User.create({
      name: name.trim(), email: lEmail, passwordHash,
      sharedUserID: shared._id, sharedCode: shared.code,
      isVerified: true,
      candidateId,
      phone: phone?.trim() || undefined,
      batch: batch?.trim() || undefined,
      accessExpiry: accessExpiry || undefined,
      restrictedAccess: !!restrictedAccess,
    });
    await SharedUserID.findByIdAndUpdate(shared._id, { $inc: { usageCount: 1 } });

    res.status(201).json({ success: true, data: { _id: user._id, name: user.name, email: user.email, sharedCode: user.sharedCode, candidateId: user.candidateId } });
  } catch (err) { next(err); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Not found.' });
    await user.deleteOne();
    res.json({ success: true });
  } catch (err) { next(err); }
};
