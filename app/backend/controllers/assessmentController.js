const crypto = require('crypto');
const Question = require('../models/Question');
const AnswerOption = require('../models/AnswerOption');
const QuestionAudio = require('../models/QuestionAudio');
const { getTtsConfig } = require('../utils/ttsSettings');
const AssessmentSession = require('../models/AssessmentSession');
const UserAnswer = require('../models/UserAnswer');
const Result = require('../models/Result');
const User = require('../models/User');
const Setting = require('../models/Setting');
const QuestionType = require('../models/QuestionType');
const SharedUserID = require('../models/SharedUserID');
const QuestionSet = require('../models/QuestionSet');
const RetestRequest = require('../models/RetestRequest');
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

// Reorder a fetched question list to match an ordered id array (a Mongo
// `$in` query does not preserve the array's order). Drops ids that didn't
// resolve to a document.
function orderByIds(questions, orderedIds) {
  const byId = new Map(questions.map(q => [q._id.toString(), q]));
  return orderedIds.map(id => byId.get(id.toString())).filter(Boolean);
}

// Only surface a question's audio to the candidate when it's genuinely
// playable: hasAudio is set AND audioUrl holds a real inline data URI (how the
// admin stores clips) or an absolute URL. Anything else — hasAudio with an
// empty/blank URL, or a stray URL with hasAudio off — is returned as no-audio
// so the candidate never renders a broken or empty player. audioUrl is omitted
// entirely when absent so the payload never ships an empty string.
function publicAudio(q) {
  const url = typeof q.audioUrl === 'string' ? q.audioUrl.trim() : '';
  const playable = !!q.hasAudio && !!url &&
    (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://'));
  return { hasAudio: playable, audioUrl: playable ? url : undefined };
}

// Must match utils/edgeTts.textHash — computed inline here so the request path
// never loads the msedge-tts module (only the offline generation script does).
const textHash = (t) => crypto.createHash('sha256').update(String(t || '')).digest('hex');

// Resolve which Question Set a user's assessment should draw from, via their
// access code (SharedUserID → questionSetId → QuestionSet). Returns the set
// plus its question ids filtered to currently-active questions and kept in
// the set's own order, or a typed `error` message when the cohort has no
// usable assessment. Used by startSession (to snapshot) and by getQuestions/
// getSettings before a session exists.
async function resolveUserSet(user) {
  const shared = await SharedUserID.findById(user.sharedUserID);
  if (!shared || !shared.questionSetId)
    return { error: 'No assessment has been assigned to your access code. Please contact your administrator.' };

  const set = await QuestionSet.findById(shared.questionSetId);
  if (!set || !set.isActive)
    return { error: 'Your assigned assessment is not available right now. Please contact your administrator.' };

  const activeQuestions = await Question.find({ _id: { $in: set.questionIds }, isActive: true }).select('_id');
  const activeIds = new Set(activeQuestions.map(q => q._id.toString()));
  const orderedIds = set.questionIds.map(id => id.toString()).filter(id => activeIds.has(id));
  if (!orderedIds.length)
    return { error: 'Your assigned assessment has no questions yet. Please contact your administrator.' };

  return { set, orderedIds };
}

exports.getQuestions = async (req, res, next) => {
  try {
    const types = await QuestionType.find({ isActive: true }).sort('order');
    const session = await AssessmentSession.findOne({ userId: req.user._id, status: 'in-progress' });

    // Source the question list from the session's frozen snapshot once an
    // attempt is under way; otherwise resolve it live from the user's set
    // (the candidate app fetches /questions before /start). Either way the
    // list is set-scoped and kept in the set's own order — NOT sorted by the
    // global Question.order.
    let orderedIds, remainingSeconds;
    if (session) {
      orderedIds = session.questionIds.map(id => id.toString());
      remainingSeconds = Math.max(0, Math.ceil((session.expiresAt - new Date()) / 1000));
    } else {
      // No attempt under way yet: the candidate must have completed the
      // post-login Access Code step. Enforced here (not just client-side) so
      // question data can never be fetched by skipping straight to this page.
      if (!req.user.codeSelected)
        return res.status(403).json({ success: false, code: 'CODE_REQUIRED', message: 'Please enter your access code to begin.' });
      const resolved = await resolveUserSet(req.user);
      if (resolved.error) return res.status(403).json({ success: false, message: resolved.error });
      orderedIds = resolved.orderedIds;
      remainingSeconds = resolved.set.durationMinutes * 60;
    }

    const questions = orderByIds(await Question.find({ _id: { $in: orderedIds } }), orderedIds);
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

    // Which questions have up-to-date cached neural-TTS audio (see
    // QuestionAudio / scripts/generateQuestionAudio.js). The candidate uses it
    // via GET /questions/:id/audio when set, else falls back to browser speech.
    // Honour the admin on/off toggle: when disabled, expose no neural audio.
    const ttsEnabled = (await getTtsConfig()).enabled;
    const audioHashByQid = {};
    if (ttsEnabled) {
      (await QuestionAudio.find({ questionId: { $in: questionIds } }).select('questionId textHash'))
        .forEach((r) => { audioHashByQid[r.questionId.toString()] = r.textHash; });
    }

    // Group by category for the candidate UI (unchanged contract). Questions
    // within a category preserve the set's order because `questions` is
    // already snapshot-ordered and .filter is stable. Categories the set
    // doesn't touch are dropped so the candidate isn't shown empty sections.
    const result = types.map(type => ({
      typeId: type._id,
      typeName: type.name,
      typeIcon: type.icon,
      typeColor: type.color,
      questions: questions
        .filter(q => q.typeId.toString() === type._id.toString())
        .map(q => {
          // correctOptionId, explanation, idealOrder, correctOptionIds,
          // scoringMode, isReverseScored are deliberately NOT included here.
          const audio = publicAudio(q);
          return {
            _id: q._id, text: q.text, order: q.order,
            questionType: q.questionType, dimension: q.dimension, difficulty: q.difficulty,
            timeLimitSeconds: q.timeLimitSeconds, imageUrl: q.imageUrl, instructionText: q.instructionText,
            // Admin-authored spoken explanation, played on demand by the "Explain"
            // button. Safe to send: it's help text, not scoring/answer data.
            explanationAudioText: q.explanationAudioText || '',
            hasAudio: audio.hasAudio, audioUrl: audio.audioUrl,
            neuralAudio: audioHashByQid[q._id.toString()] === textHash(q.text),
            options: q.questionType === 'RANKING'
              ? shuffled(optionsByQuestion[q._id.toString()] || [])
              : (optionsByQuestion[q._id.toString()] || []),
          };
        }),
    })).filter(type => type.questions.length > 0);

    res.json({ success: true, data: result, remainingSeconds });
  } catch (err) { next(err); }
};

exports.startSession = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Resuming a still-live in-progress attempt takes priority over any gate
    // below. But if that attempt has already expired past the submit grace
    // window (the candidate abandoned it), retire it here — otherwise it would
    // stay 'in-progress' forever, and every future start would 409 while submit
    // rejects it as expired, permanently stranding the candidate.
    const inProgress = await AssessmentSession.findOne({ userId, status: 'in-progress' });
    if (inProgress) {
      const GRACE_MS = 60 * 1000;
      const dead = Date.now() > inProgress.expiresAt.getTime() + GRACE_MS;
      if (!dead)
        return res.status(409).json({ success: false, sessionId: inProgress._id, expiresAt: inProgress.expiresAt, message: 'Assessment already in progress.' });
      inProgress.status = 'expired';
      await inProgress.save();
      // fall through to start a fresh attempt (retest approval, if any, is still
      // required below — an abandoned retest that expired stays consumed).
    }

    // A completed candidate can only start again via an admin-APPROVED retest
    // request, which grants exactly one more attempt. The approval is consumed
    // (marked 'used') below so it can never unlock a second retest.
    let approvedRetest = null;
    if (req.user.hasCompletedAssessment) {
      approvedRetest = await RetestRequest.findOne({ userId, status: 'approved' }).sort('-createdAt');
      if (!approvedRetest)
        return res.status(403).json({ success: false, message: 'You have already completed this assessment.' });
    }

    // A new attempt requires the post-login Access Code step to have run this
    // session — the same gate as getQuestions, so the assessment can't start
    // without it. (Resuming an existing attempt is handled by the 409 above.)
    if (!req.user.codeSelected)
      return res.status(403).json({ success: false, code: 'CODE_REQUIRED', message: 'Please enter your access code to begin.' });

    // Resolve the user's assigned set and snapshot it onto the session: the
    // timer comes from the set's own durationMinutes, and questionIds freeze
    // WHICH questions (and in what order) this attempt is scored against so
    // later admin edits to the set can't affect an in-flight attempt.
    const resolved = await resolveUserSet(req.user);
    if (resolved.error) return res.status(403).json({ success: false, message: resolved.error });
    const { set, orderedIds } = resolved;

    // Attempt number = the count of the candidate's prior submitted results + 1.
    const attemptNumber = (await Result.countDocuments({ userId })) + 1;

    const minutes = set.durationMinutes;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + minutes * 60 * 1000);
    const session = await AssessmentSession.create({
      userId, startedAt, expiresAt,
      ipAddress: req.ip,
      questionSetId: set._id,
      questionIds: orderedIds,
      durationMinutes: minutes,
      attemptNumber,
    });

    // Consume the retest approval exactly once. hasCompletedAssessment is left
    // true, so an abandoned retest can't be silently restarted without a new
    // approval — the used request is no longer 'approved', so the block returns.
    if (approvedRetest) {
      approvedRetest.status = 'used';
      approvedRetest.usedAt = new Date();
      await approvedRetest.save();
    }

    res.status(201).json({ success: true, sessionId: session._id, startedAt, expiresAt, attemptNumber });
  } catch (err) { next(err); }
};

exports.submitAssessment = async (req, res, next) => {
  try {
    const { sessionId, answers } = req.body;
    const userId = req.user._id;

    const session = await AssessmentSession.findById(sessionId);
    if (!session || session.userId.toString() !== userId.toString())
      return res.status(403).json({ success: false, message: 'Session not found or not yours.' });
    if (session.status !== 'in-progress')
      return res.status(400).json({ success: false, message: 'Session already submitted or expired.' });

    // Timing is server-authoritative — the client cannot send an `autoSubmitted`
    // flag to waive the expiry cutoff or the all-answered rule. A submit past
    // the grace window is rejected outright; a submit after expiry but within
    // grace (e.g. the client's own timeout auto-submit) counts as auto-submitted
    // and may be partial. GRACE absorbs network/clock skew on that auto-submit.
    const GRACE_MS = 60 * 1000;
    const now = Date.now();
    if (now > session.expiresAt.getTime() + GRACE_MS)
      return res.status(400).json({ success: false, message: 'Assessment time has expired.' });
    const autoSubmitted = now > session.expiresAt.getTime();

    // The questions this attempt is scored against are the session's frozen
    // snapshot (set at startSession), NOT the live set or all active questions
    // — this keeps scoring stable if an admin edits the set mid-attempt, and
    // makes every max/percentage below relative to the set the candidate
    // actually took. Reordered to the snapshot order; the full set (not just
    // answered questions) is needed so an auto-submitted partial answer set
    // doesn't undercount each category's true max score.
    const setQuestions = orderByIds(
      await Question.find({ _id: { $in: session.questionIds } }),
      session.questionIds.map(id => id.toString())
    );

    // Keyed by questionId so every active question can be resolved to its
    // answer (if any) in one pass below, regardless of submission order.
    const answerByQuestionId = new Map(answers.map(a => [a.questionId.toString(), a]));

    // A manual (non-auto) submit must account for every active question —
    // either a real answer or an explicit timeout/skip marker — but no
    // longer requires a real *selection* for each one, since a per-question
    // timeout legitimately has none.
    const unresolved = setQuestions.filter(q => !answerByQuestionId.has(q._id.toString()));
    if (!autoSubmitted && unresolved.length)
      return res.status(400).json({ success: false, message: `All ${setQuestions.length} questions must be answered or explicitly timed out.` });

    // All options for every active question — evaluateAnswer needs the full
    // option set (e.g. to validate the chosen id(s) belong to the question),
    // not just the one(s) the candidate picked. Also reused below to build
    // SITUATIONAL's per-dimension max without a second query.
    const allOptionsForQuestions = await AnswerOption.find({ questionId: { $in: setQuestions.map(q => q._id) } });
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
    for (const q of setQuestions) {
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

    // Atomically claim the session right before committing, so two concurrent
    // submits can't both write answers/results. Result.sessionId is unique too,
    // but this returns a clean 409 instead of a duplicate-key 500 and avoids a
    // second UserAnswer.insertMany. All validation above ran on the still
    // in-progress session, so an invalid submit never burns the attempt.
    const claimed = await AssessmentSession.findOneAndUpdate(
      { _id: sessionId, status: 'in-progress' },
      { status: 'submitted', submittedAt: new Date(), autoSubmitted },
      { new: true }
    );
    if (!claimed)
      return res.status(409).json({ success: false, message: 'Submission already in progress or completed.' });

    await UserAnswer.insertMany(userAnswerDocs);

    // Build questionType map: questionId → typeName
    const types = await QuestionType.find();
    const typeMap = Object.fromEntries(types.map(t => [t._id.toString(), t.name]));
    const questionTypeMap = Object.fromEntries(setQuestions.map(q => [q._id.toString(), typeMap[q.typeId.toString()]]));

    // SITUATIONAL's per-dimension max is the best value any of its options
    // offers for that dimension (a single question can contribute to
    // several dimensions at once) — everything else just adds its whole
    // `marks` to its single `dimension`; see computeQuestionMaxes.
    const situationalOptsByQ = {};
    for (const q of setQuestions) {
      if (q.questionType === 'SITUATIONAL') situationalOptsByQ[q._id.toString()] = optionsByQuestion[q._id.toString()] || [];
    }
    const { categoryQuestionMax, dimensionQuestionMax } = computeQuestionMaxes(setQuestions, typeMap, situationalOptsByQ);

    // Score calculation
    const scored = calculateResult(userAnswerDocs, questionTypeMap, categoryQuestionMax, dimensionQuestionMax, setQuestions.length);

    const resultDoc = await Result.create({
      userId, sessionId,
      attemptNumber: session.attemptNumber || 1,
      ...scored,
      categoryScores: scored.categoryScores,
      categoryPercentages: scored.categoryPercentages,
    });

    // Status/submittedAt/autoSubmitted were set atomically in the claim above.
    claimed.totalAnswered = userAnswerDocs.filter(d => d.status === 'answered').length;
    await claimed.save();

    await User.findByIdAndUpdate(userId, { hasCompletedAssessment: true });

    res.json({ success: true, resultId: resultDoc._id });
  } catch (err) { next(err); }
};

// Builds the retest UI state for a candidate: their latest request's status,
// any rejection note, and whether they may (re)request now (completed + no
// pending/approved request in flight).
async function buildRetestState(user) {
  const latest = await RetestRequest.findOne({ userId: user._id }).sort('-createdAt').select('status rejectionNote createdAt');
  const active = await RetestRequest.findOne({ userId: user._id, status: { $in: ['pending', 'approved'] } }).select('_id');
  return {
    status: latest ? latest.status : 'none',
    rejectionNote: latest ? latest.rejectionNote : undefined,
    canRequest: !!user.hasCompletedAssessment && !active,
  };
}

exports.getResult = async (req, res, next) => {
  try {
    // Latest result — a candidate may have retaken after an approved retest, and
    // every attempt keeps its own Result row (attempt #1 is never overwritten).
    const result = await Result.findOne({ userId: req.user._id })
      .sort('-createdAt')
      .populate({
        path: 'userId',
        select: 'name email sharedCode sharedUserID',
        populate: { path: 'sharedUserID', select: 'label' },
      });
    if (!result) return res.status(404).json({ success: false, message: 'No result found.' });

    // Full attempt history (newest first) for the "Previous Attempts" section.
    const history = await Result.find({ userId: req.user._id })
      .sort('-createdAt')
      .select('attemptNumber percentage level totalMarks maxScore createdAt');

    const retest = await buildRetestState(req.user);
    res.json({ success: true, data: result, attemptNumber: result.attemptNumber || 1, history, retest });
  } catch (err) { next(err); }
};

// Candidate's own retest status (for polling the button state).
exports.getMyRetest = async (req, res, next) => {
  try {
    const latest = await RetestRequest.findOne({ userId: req.user._id }).sort('-createdAt');
    const retest = await buildRetestState(req.user);
    res.json({ success: true, data: latest, retest });
  } catch (err) { next(err); }
};

// Candidate requests a retest. Allowed only after completing an assessment and
// when no request is already pending/approved; creates a RetestRequest snapshot
// that surfaces in the admin queue for approval.
exports.requestRetest = async (req, res, next) => {
  try {
    if (!req.user.hasCompletedAssessment)
      return res.status(400).json({ success: false, message: 'You can request a retest only after completing your assessment.' });

    const active = await RetestRequest.findOne({ userId: req.user._id, status: { $in: ['pending', 'approved'] } });
    if (active)
      return res.status(409).json({ success: false, message: 'Retest request already submitted.' });

    const latestResult = await Result.findOne({ userId: req.user._id }).sort('-createdAt').select('_id percentage level');
    const attemptCount = await Result.countDocuments({ userId: req.user._id });
    let questionSetId;
    try { const shared = await SharedUserID.findById(req.user.sharedUserID).select('questionSetId'); questionSetId = shared && shared.questionSetId; } catch { /* optional */ }

    await RetestRequest.create({
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      sharedCode: req.user.sharedCode,
      questionSetId,
      attemptNumber: attemptCount + 1,
      currentResultId: latestResult && latestResult._id,
      currentPercentage: latestResult && latestResult.percentage,
      currentLevel: latestResult && latestResult.level,
      reason: (req.body && typeof req.body.reason === 'string') ? req.body.reason.slice(0, 500) : undefined,
      requestedByUser: true,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'pending',
    });
    res.json({ success: true, message: 'Retest request sent to the administrator for approval.' });
  } catch (err) { next(err); }
};

exports.getSettings = async (req, res, next) => {
  try {
    // The candidate app reads its timer from this endpoint before an attempt
    // starts, so it now reflects the caller's own set duration. Falls back to
    // the global Setting (then 30) when the cohort has no usable set — the
    // real block happens at /start, so this endpoint stays non-fatal.
    const resolved = await resolveUserSet(req.user);
    let minutes;
    if (!resolved.error) {
      minutes = resolved.set.durationMinutes;
    } else {
      const duration = await Setting.findOne({ key: 'assessment_duration_minutes' });
      minutes = duration ? Number(duration.value) : 30;
    }
    res.json({ success: true, data: { assessment_duration_minutes: minutes } });
  } catch (err) { next(err); }
};

// Serves the cached neural-TTS mp3 for a question (generated offline by
// scripts/generateQuestionAudio.js). 404 when none exists — the candidate then
// falls back to browser speech synthesis. Runtime never calls the TTS endpoint.
exports.getQuestionAudio = async (req, res, next) => {
  try {
    const cached = await QuestionAudio.findOne({ questionId: req.params.id }).select('audio contentType textHash');
    if (!cached || !cached.audio) return res.status(404).json({ success: false, message: 'No generated audio for this question.' });
    res.set('Content-Type', cached.contentType || 'audio/mpeg');
    res.set('Cache-Control', 'private, max-age=86400');
    res.set('ETag', `"${cached.textHash}"`);
    return res.send(cached.audio);
  } catch (err) { next(err); }
};
