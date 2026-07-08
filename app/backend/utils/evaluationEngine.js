/**
 * Centralized answer-evaluation logic. One evaluator function per question
 * type, dispatched by `question.questionType`. This is the ONLY place
 * scoring rules live — controllers must never inline per-type logic.
 */

function evaluateLikert(question, options, userAnswer) {
  const chosen = options.find((o) => o._id.toString() === userAnswer.toString());
  if (!chosen) throw new Error('Invalid answer option for LIKERT_SCALE question.');
  return {
    score: chosen.score,
    maxScore: question.marks,
    isCorrect: null, // no right/wrong for Likert
    dimensionScores: { [question.dimension]: chosen.score },
  };
}

// Shared by every single-correct-answer type: NUMERICAL_ABILITY today;
// PERCENTAGE_TYPE/PUZZLE_TYPE/LOGICAL_ABILITY/VERBAL_ABILITY/IMAGE_BASED
// register this same function in a later phase — they all score identically
// (correct option -> full marks, anything else -> 0).
function evaluateSingleCorrect(question, options, userAnswer) {
  const chosenId = userAnswer.toString();
  if (!options.some((o) => o._id.toString() === chosenId))
    throw new Error(`Invalid answer option for ${question.questionType} question.`);
  const isCorrect = !!(question.correctOptionId && question.correctOptionId.toString() === chosenId);
  const score = isCorrect ? question.marks : 0;
  return {
    score,
    maxScore: question.marks,
    isCorrect,
    dimensionScores: { [question.dimension]: score },
  };
}

// Note: `isReverseScored` is intentionally NOT read anywhere in this engine.
// Per the admin-authoring model, an option's `score` value already reflects
// the correct direction (e.g. a reverse-scored Likert item has "Completely
// true" stored as score 1, not 5) — the flag is admin-UI metadata only (it
// drives which default score template gets prefilled when adding options),
// not a runtime score-flipping switch. Do not add direction-flipping logic
// here based on this flag.

// SITUATIONAL: a single chosen option maps to MULTIPLE dimensions at once
// (e.g. {Communication:5, EmotionalIntelligence:5, "Problem Solving":4}),
// unlike every other type which contributes to just `question.dimension`.
// `maxScore` is derived live from the options themselves (the best-scoring
// option's total) rather than trusted from `question.marks`, so it can never
// drift out of sync with whatever the admin actually configured as options.
function evaluateSituational(question, options, userAnswer) {
  const chosen = options.find((o) => o._id.toString() === userAnswer.toString());
  if (!chosen) throw new Error('Invalid answer option for SITUATIONAL question.');
  const sumScores = (opt) => Object.values(opt.dimensionScores || {}).reduce((a, b) => a + b, 0);
  const score = sumScores(chosen);
  const maxScore = Math.max(...options.map(sumScores), 0);
  return {
    score,
    maxScore,
    isCorrect: null, // no single "correct" option — every option is a valid decision, scored differently
    dimensionScores: { ...(chosen.dimensionScores || {}) },
  };
}

// MULTI_SELECT: userAnswer is an array of selected option ids. `scoringMode`
// is admin-configured per question:
//   - "exact": full marks only if the selection is exactly the correct set,
//     otherwise 0.
//   - "partial": marks * (correctlySelected - incorrectlySelected) /
//     totalCorrectOptions, floored at 0 — rewards picking correct options,
//     penalizes picking wrong ones, never goes negative.
function evaluateMultiSelect(question, options, userAnswer) {
  const selectedIds = (Array.isArray(userAnswer) ? userAnswer : [userAnswer]).map((id) => id.toString());
  if (!selectedIds.length) throw new Error('At least one option must be selected for a MULTI_SELECT question.');
  if (!selectedIds.every((id) => options.some((o) => o._id.toString() === id)))
    throw new Error('Invalid answer option for MULTI_SELECT question.');

  const correctIds = (question.correctOptionIds || []).map((id) => id.toString());
  const correctSet = new Set(correctIds);
  const selectedSet = new Set(selectedIds);
  const correctSelected = selectedIds.filter((id) => correctSet.has(id)).length;
  const incorrectSelected = selectedIds.length - correctSelected;
  const isFullyCorrect = correctSelected === correctSet.size && incorrectSelected === 0;

  let score;
  if (question.scoringMode === 'exact') {
    score = isFullyCorrect ? question.marks : 0;
  } else {
    const ratio = correctSet.size ? Math.max(0, correctSelected - incorrectSelected) / correctSet.size : 0;
    score = parseFloat((question.marks * ratio).toFixed(2));
  }
  return {
    score,
    maxScore: question.marks,
    isCorrect: isFullyCorrect,
    dimensionScores: { [question.dimension]: score },
  };
}

// RANKING: userAnswer is the candidate's ordering (array of option ids).
// Scored by how many positions exactly match `question.idealOrder` — simple
// and easy to explain to a candidate, as opposed to a rank-correlation
// metric that's harder to reason about for a business-suitability quiz.
function evaluateRanking(question, options, userAnswer) {
  const ranking = Array.isArray(userAnswer) ? userAnswer.map((id) => id.toString()) : [];
  const idealOrder = (question.idealOrder || []).map((id) => id.toString());
  if (!idealOrder.length) throw new Error('This RANKING question has no ideal order configured.');
  if (ranking.length !== idealOrder.length || !ranking.every((id) => options.some((o) => o._id.toString() === id)))
    throw new Error('Invalid ranking submitted for RANKING question.');

  const matches = ranking.filter((id, i) => id === idealOrder[i]).length;
  const score = parseFloat((question.marks * (matches / idealOrder.length)).toFixed(2));
  return {
    score,
    maxScore: question.marks,
    isCorrect: matches === idealOrder.length,
    dimensionScores: { [question.dimension]: score },
  };
}

const EVALUATORS = {
  LIKERT_SCALE: evaluateLikert,
  NUMERICAL_ABILITY: evaluateSingleCorrect,
  PERCENTAGE_TYPE: evaluateSingleCorrect,
  PUZZLE_TYPE: evaluateSingleCorrect,
  LOGICAL_ABILITY: evaluateSingleCorrect,
  VERBAL_ABILITY: evaluateSingleCorrect,
  IMAGE_BASED: evaluateSingleCorrect,
  SITUATIONAL: evaluateSituational,
  MULTI_SELECT: evaluateMultiSelect,
  RANKING: evaluateRanking,
};

function evaluateAnswer(question, options, userAnswer) {
  const evaluator = EVALUATORS[question.questionType];
  if (!evaluator) throw new Error(`No evaluator registered for questionType "${question.questionType}".`);
  return evaluator(question, options, userAnswer);
}

module.exports = { evaluateAnswer, EVALUATORS };
