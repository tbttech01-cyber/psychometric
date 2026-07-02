const Question = require('../models/Question');
const AnswerOption = require('../models/AnswerOption');
const AssessmentSession = require('../models/AssessmentSession');
const UserAnswer = require('../models/UserAnswer');
const Result = require('../models/Result');
const User = require('../models/User');
const QuestionType = require('../models/QuestionType');
const { calculateResult } = require('../utils/scoreCalculator');

exports.getQuestions = async (req, res, next) => {
  try {
    const types = await QuestionType.find({ isActive: true }).sort('order');
    const questions = await Question.find({ isActive: true }).sort('order');
    const questionIds = questions.map(q => q._id);
    const options = await AnswerOption.find({ questionId: { $in: questionIds } })
      .select('-marks') // marks NEVER sent to users
      .sort('order');

    const optionsByQuestion = {};
    for (const opt of options) {
      const qId = opt.questionId.toString();
      if (!optionsByQuestion[qId]) optionsByQuestion[qId] = [];
      optionsByQuestion[qId].push({ _id: opt._id, label: opt.label, order: opt.order });
    }

    const result = types.map(type => ({
      typeId: type._id,
      typeName: type.name,
      typeIcon: type.icon,
      typeColor: type.color,
      questions: questions
        .filter(q => q.typeId.toString() === type._id.toString())
        .map(q => ({
          _id: q._id, text: q.text, order: q.order,
          options: optionsByQuestion[q._id.toString()] || [],
        })),
    }));

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.startSession = async (req, res, next) => {
  try {
    const userId = req.user._id;

    if (req.user.hasCompletedAssessment)
      return res.status(403).json({ success: false, message: 'You have already completed this assessment.' });

    const inProgress = await AssessmentSession.findOne({ userId, status: 'in-progress' });
    if (inProgress)
      return res.status(409).json({ success: false, sessionId: inProgress._id, message: 'Assessment already in progress.' });

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + 30 * 60 * 1000);
    const session = await AssessmentSession.create({
      userId, startedAt, expiresAt,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, sessionId: session._id, startedAt, expiresAt });
  } catch (err) { next(err); }
};

exports.submitAssessment = async (req, res, next) => {
  try {
    const { sessionId, answers, autoSubmitted = false } = req.body;
    const userId = req.user._id;

    const session = await AssessmentSession.findById(sessionId);
    if (!session || session.userId.toString() !== userId.toString())
      return res.status(403).json({ success: false, message: 'Session not found or not yours.' });
    if (session.status !== 'in-progress')
      return res.status(400).json({ success: false, message: 'Session already submitted or expired.' });

    const BUFFER_MS = 30 * 1000;
    if (!autoSubmitted && Date.now() > session.expiresAt.getTime() + BUFFER_MS)
      return res.status(400).json({ success: false, message: 'Assessment time has expired.' });

    if (!autoSubmitted && answers.length !== 40)
      return res.status(400).json({ success: false, message: 'All 40 questions must be answered.' });

    // Validate every answer
    const questionIds = answers.map(a => a.questionId);
    const questions = await Question.find({ _id: { $in: questionIds }, isActive: true });
    const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));

    const optionIds = answers.map(a => a.answerOptionId);
    const options = await AnswerOption.find({ _id: { $in: optionIds } });
    const optionMap = Object.fromEntries(options.map(o => [o._id.toString(), o]));

    const userAnswerDocs = [];
    for (const a of answers) {
      const q = questionMap[a.questionId];
      if (!q) return res.status(400).json({ success: false, message: 'Invalid question reference.' });
      const opt = optionMap[a.answerOptionId];
      if (!opt || opt.questionId.toString() !== a.questionId)
        return res.status(400).json({ success: false, message: 'Invalid answer option for question.' });

      userAnswerDocs.push({
        sessionId, userId, questionId: a.questionId,
        answerOptionId: a.answerOptionId, marks: opt.marks,
        questionOrder: q.order, answeredAt: new Date(),
      });
    }

    await UserAnswer.insertMany(userAnswerDocs);

    // Build questionType map: questionId → typeName
    const types = await QuestionType.find();
    const typeMap = Object.fromEntries(types.map(t => [t._id.toString(), t.name]));
    const questionTypeMap = Object.fromEntries(questions.map(q => [q._id.toString(), typeMap[q.typeId.toString()]]));

    // Score calculation
    const scored = calculateResult(userAnswerDocs, questionTypeMap);

    const resultDoc = await Result.create({
      userId, sessionId,
      ...scored,
      categoryScores: scored.categoryScores,
      categoryPercentages: scored.categoryPercentages,
    });

    session.status = 'submitted';
    session.submittedAt = new Date();
    session.autoSubmitted = autoSubmitted;
    session.totalAnswered = answers.length;
    await session.save();

    await User.findByIdAndUpdate(userId, { hasCompletedAssessment: true });

    res.json({ success: true, resultId: resultDoc._id });
  } catch (err) { next(err); }
};

exports.getResult = async (req, res, next) => {
  try {
    const result = await Result.findOne({ userId: req.user._id })
      .populate('userId', 'name email sharedCode');
    if (!result) return res.status(404).json({ success: false, message: 'No result found.' });

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};
