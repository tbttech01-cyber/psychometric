const Question = require('../models/Question');
const AnswerOption = require('../models/AnswerOption');
const AssessmentSession = require('../models/AssessmentSession');
const UserAnswer = require('../models/UserAnswer');
const Result = require('../models/Result');
const User = require('../models/User');
const Setting = require('../models/Setting');
const QuestionType = require('../models/QuestionType');
const { calculateResult, computeQuestionMaxes } = require('../utils/scoreCalculator');
const { evaluateAnswer } = require('../utils/evaluationEngine');

// RANKING questions store their options in the admin-authored *correct*
// order (see adminCRUDController.js's deriveAnswerKeyFields) — sending them
// to the candidate in that order would show the answer. Shuffle a copy
// before returning.
function shuffled(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

exports.getQuestions = async (req, res, next) => {
  try {
    const types = await QuestionType.find({ isActive: true }).sort('order');
    const session = await AssessmentSession.findOne({ userId: req.user._id, status: 'in-progress' });
    const remainingSeconds = session
      ? Math.max(0, Math.ceil((session.expiresAt - new Date()) / 1000))
      : 1800;
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
          options: q.questionType === 'RANKING'
            ? shuffled(optionsByQuestion[q._id.toString()] || [])
            : (optionsByQuestion[q._id.toString()] || []),
        })),
    }));

    res.json({ success: true, data: result, remainingSeconds });
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

    const durationSetting = await Setting.findOne({ key: 'assessment_duration_minutes' });
    const minutes = durationSetting ? Number(durationSetting.value) : 30;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + minutes * 60 * 1000);
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

    // Keyed by questionId so every active question can be resolved to its
    // answer (if any) in one pass below, regardless of submission order.
    const answerByQuestionId = new Map(answers.map(a => [a.questionId.toString(), a]));

    // A manual (non-auto) submit must account for every active question —
    // either a real answer or an explicit timeout/skip marker — but no
    // longer requires a real *selection* for each one, since a per-question
    // timeout legitimately has none.
    const unresolved = allActiveQuestions.filter(q => !answerByQuestionId.has(q._id.toString()));
    if (!autoSubmitted && unresolved.length)
      return res.status(400).json({ success: false, message: `All ${allActiveQuestions.length} questions must be answered or explicitly timed out.` });

    // All options for every active question — evaluateAnswer needs the full
    // option set (e.g. to validate the chosen id(s) belong to the question),
    // not just the one(s) the candidate picked. Also reused below to build
    // SITUATIONAL's per-dimension max without a second query.
    const allOptionsForQuestions = await AnswerOption.find({ questionId: { $in: allActiveQuestions.map(q => q._id) } });
    const optionsByQuestion = {};
    for (const o of allOptionsForQuestions) {
      const qid = o.questionId.toString();
      (optionsByQuestion[qid] ||= []).push(o);
    }

    // Which option id(s) the candidate actually submitted for this answer,
    // shape depends on the question's type. Returns [] for a missing/
    // timeout/skip entry.
    function referencedOptionIds(a, questionType) {
      if (!a) return [];
      if (questionType === 'MULTI_SELECT') return a.answerOptionIds || [];
      if (questionType === 'RANKING') return a.orderedOptionIds || [];
      return a.answerOptionId ? [a.answerOptionId] : [];
    }

    const userAnswerDocs = [];
    for (const q of allActiveQuestions) {
      const a = answerByQuestionId.get(q._id.toString());
      const questionOptions = optionsByQuestion[q._id.toString()] || [];
      const refIds = referencedOptionIds(a, q.questionType);

      if (!refIds.length) {
        // Never reached (auto-submit cutoff) or explicitly timed out/skipped
        // by the candidate — recorded with score 0 so it never inflates
        // category/dimension totals, but still an explicit, auditable row.
        userAnswerDocs.push({
          sessionId, userId, questionId: q._id,
          score: 0, maxScore: q.marks, isCorrect: null,
          dimension: q.dimension, dimensionScores: {},
          questionOrder: q.order, answeredAt: new Date(),
          timeTakenSeconds: a?.timeTakenSeconds,
          status: a?.status === 'timeout' ? 'timeout' : 'skipped',
        });
        continue;
      }

      const validIds = new Set(questionOptions.map((o) => o._id.toString()));
      if (!refIds.every((id) => validIds.has(id.toString())))
        return res.status(400).json({ success: false, message: 'Invalid answer option for question.' });

      const userAnswerValue = q.questionType === 'MULTI_SELECT' ? a.answerOptionIds
        : q.questionType === 'RANKING' ? a.orderedOptionIds
        : a.answerOptionId;

      let evalResult;
      try {
        evalResult = evaluateAnswer(q, questionOptions, userAnswerValue);
      } catch (evalErr) {
        return res.status(400).json({ success: false, message: evalErr.message });
      }

      userAnswerDocs.push({
        sessionId, userId, questionId: q._id,
        answerOptionId: q.questionType === 'MULTI_SELECT' || q.questionType === 'RANKING' ? undefined : a.answerOptionId,
        selectedOptionIds: q.questionType === 'MULTI_SELECT' ? a.answerOptionIds : undefined,
        rankingOrder: q.questionType === 'RANKING' ? a.orderedOptionIds : undefined,
        score: evalResult.score, maxScore: evalResult.maxScore, isCorrect: evalResult.isCorrect,
        dimension: q.dimension, dimensionScores: evalResult.dimensionScores,
        questionOrder: q.order, answeredAt: new Date(),
        timeTakenSeconds: a.timeTakenSeconds,
        status: a.status === 'timeout' ? 'timeout' : 'answered',
      });
    }

    await UserAnswer.insertMany(userAnswerDocs);

    // Build questionType map: questionId → typeName
    const types = await QuestionType.find();
    const typeMap = Object.fromEntries(types.map(t => [t._id.toString(), t.name]));
    const questionTypeMap = Object.fromEntries(allActiveQuestions.map(q => [q._id.toString(), typeMap[q.typeId.toString()]]));

    // SITUATIONAL's per-dimension max is the best value any of its options
    // offers for that dimension (a single question can contribute to
    // several dimensions at once) — everything else just adds its whole
    // `marks` to its single `dimension`; see computeQuestionMaxes.
    const situationalOptsByQ = {};
    for (const q of allActiveQuestions) {
      if (q.questionType === 'SITUATIONAL') situationalOptsByQ[q._id.toString()] = optionsByQuestion[q._id.toString()] || [];
    }
    const { categoryQuestionMax, dimensionQuestionMax } = computeQuestionMaxes(allActiveQuestions, typeMap, situationalOptsByQ);

    // Score calculation
    const scored = calculateResult(userAnswerDocs, questionTypeMap, categoryQuestionMax, dimensionQuestionMax, allActiveQuestions.length);

    const resultDoc = await Result.create({
      userId, sessionId,
      ...scored,
      categoryScores: scored.categoryScores,
      categoryPercentages: scored.categoryPercentages,
    });

    session.status = 'submitted';
    session.submittedAt = new Date();
    session.autoSubmitted = autoSubmitted;
    session.totalAnswered = userAnswerDocs.filter(d => d.status === 'answered').length;
    await session.save();

    await User.findByIdAndUpdate(userId, { hasCompletedAssessment: true });

    res.json({ success: true, resultId: resultDoc._id });
  } catch (err) { next(err); }
};

exports.getResult = async (req, res, next) => {
  try {
    const result = await Result.findOne({ userId: req.user._id })
      .populate({
        path: 'userId',
        select: 'name email sharedCode sharedUserID',
        populate: {
          path: 'sharedUserID',
          select: 'label'
        }
      });
    if (!result) return res.status(404).json({ success: false, message: 'No result found.' });

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.getSettings = async (req, res, next) => {
  try {
    const duration = await Setting.findOne({ key: 'assessment_duration_minutes' });
    res.json({
      success: true,
      data: {
        assessment_duration_minutes: duration ? Number(duration.value) : 30
      }
    });
  } catch (err) { next(err); }
};
