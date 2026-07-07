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
const EVALUATORS = {
  LIKERT_SCALE: evaluateLikert,
  NUMERICAL_ABILITY: evaluateSingleCorrect,
};

function evaluateAnswer(question, options, userAnswer) {
  const evaluator = EVALUATORS[question.questionType];
  if (!evaluator) throw new Error(`No evaluator registered for questionType "${question.questionType}".`);
  return evaluator(question, options, userAnswer);
}

module.exports = { evaluateAnswer, EVALUATORS };
