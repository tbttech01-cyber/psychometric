const Question = require('../models/Question');
const AnswerOption = require('../models/AnswerOption');
const AssessmentSession = require('../models/AssessmentSession');
const UserAnswer = require('../models/UserAnswer');
const Result = require('../models/Result');
const User = require('../models/User');
const QuestionType = require('../models/QuestionType');
const { calculateResult } = require('../utils/scoreCalculator');
const { evaluateAnswer } = require('../utils/evaluationEngine');

exports.getQuestions = async (req, res, next) => {
  try {
    const types = await QuestionType.find({ isActive: true }).sort('order');
    const questions = await Question.find({ isActive: true }).sort('order');
    const questionIds = questions.map(q => q._id);
    // Scoring secrets (score/isCorrect/dimensionScores) must never reach the
    // candidate — same rule as the old `-marks` projection, generalized.
    const options = await AnswerOption.find({ questionId: { $in: questionIds } })
      .select('-score -isCorrect -dimensionScores')
      .sort('order');

    const optionsByQuestion = {};
    for (const opt of options) {
      const qId = opt.questionId.toString();
      if (!optionsByQuestion[qId]) optionsByQuestion[qId] = [];
      optionsByQuestion[qId].push({ _id: opt._id, optionText: opt.optionText, optionImageUrl: opt.optionImageUrl, order: opt.order });
    }

    const result = types.map(type => ({
      typeId: type._id,
      typeName: type.name,
      typeIcon: type.icon,
      typeColor: type.color,
      questions: questions
        .filter(q => q.typeId.toString() === type._id.toString())
        .map(q => ({
          // correctOptionId, explanation, idealOrder, correctOptionIds,
          // scoringMode, isReverseScored are deliberately NOT included here.
          _id: q._id, text: q.text, order: q.order,
          questionType: q.questionType, dimension: q.dimension, difficulty: q.difficulty,
          timeLimitSeconds: q.timeLimitSeconds, imageUrl: q.imageUrl, instructionText: q.instructionText,
          hasAudio: q.hasAudio, audioUrl: q.audioUrl,
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
      return res.status(409).json({ success: false, sessionId: inProgress._id, expiresAt: inProgress.expiresAt, message: 'Assessment already in progress.' });

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

    // Fetched once up front and reused below to build categoryQuestionCounts —
    // must reflect ALL active questions (not just this submission's answers),
    // since an auto-submitted partial answer set would otherwise undercount
    // each category's true max score.
    const allActiveQuestions = await Question.find({ isActive: true });
    if (!autoSubmitted && answers.length !== allActiveQuestions.length)
      return res.status(400).json({ success: false, message: `All ${allActiveQuestions.length} questions must be answered.` });

    // Validate every answer
    const questionIds = answers.map(a => a.questionId);
    const questions = await Question.find({ _id: { $in: questionIds }, isActive: true });
    const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));

    const optionIds = answers.map(a => a.answerOptionId);
    const options = await AnswerOption.find({ _id: { $in: optionIds } });
    const optionMap = Object.fromEntries(options.map(o => [o._id.toString(), o]));

    // All options for every answered question — evaluateAnswer needs the
    // full option set (e.g. to validate the chosen id belongs to the
    // question), not just the one the candidate picked.
    const allOptionsForQuestions = await AnswerOption.find({ questionId: { $in: questionIds } });
    const optionsByQuestion = {};
    for (const o of allOptionsForQuestions) {
      const qid = o.questionId.toString();
      (optionsByQuestion[qid] ||= []).push(o);
    }

    const userAnswerDocs = [];
    for (const a of answers) {
      const q = questionMap[a.questionId];
      if (!q) return res.status(400).json({ success: false, message: 'Invalid question reference.' });
      const opt = optionMap[a.answerOptionId];
      if (!opt || opt.questionId.toString() !== a.questionId)
        return res.status(400).json({ success: false, message: 'Invalid answer option for question.' });

      let evalResult;
      try {
        evalResult = evaluateAnswer(q, optionsByQuestion[a.questionId] || [], a.answerOptionId);
      } catch (evalErr) {
        return res.status(400).json({ success: false, message: evalErr.message });
      }

      userAnswerDocs.push({
        sessionId, userId, questionId: a.questionId,
        answerOptionId: a.answerOptionId,
        score: evalResult.score, maxScore: evalResult.maxScore, isCorrect: evalResult.isCorrect,
        dimension: q.dimension, dimensionScores: evalResult.dimensionScores,
        questionOrder: q.order, answeredAt: new Date(),
      });
    }

    await UserAnswer.insertMany(userAnswerDocs);

    // Build questionType map: questionId → typeName
    const types = await QuestionType.find();
    const typeMap = Object.fromEntries(types.map(t => [t._id.toString(), t.name]));
    const questionTypeMap = Object.fromEntries(questions.map(q => [q._id.toString(), typeMap[q.typeId.toString()]]));

    // Each category's live total marks, used to compute its max score —
    // marks are now admin-configurable per question, not a fixed 5.
    const categoryQuestionMax = {};
    for (const q of allActiveQuestions) {
      const name = typeMap[q.typeId.toString()];
      if (!name) continue;
      categoryQuestionMax[name] = (categoryQuestionMax[name] || 0) + q.marks;
    }

    // Score calculation
    const scored = calculateResult(userAnswerDocs, questionTypeMap, categoryQuestionMax);

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
