const SharedUserID = require('../models/SharedUserID');
const QuestionType = require('../models/QuestionType');
const Question = require('../models/Question');
const AnswerOption = require('../models/AnswerOption');
const AssessmentSession = require('../models/AssessmentSession');

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
    const User = require('../models/User');
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
