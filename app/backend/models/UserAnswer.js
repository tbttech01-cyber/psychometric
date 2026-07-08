const mongoose = require('mongoose');

const userAnswerSchema = new mongoose.Schema({
  sessionId:      { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentSession', required: true },
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questionId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  // Exactly one of these three is populated, depending on the question's
  // questionType: answerOptionId for single-select types (Likert,
  // Situational, the single-correct aptitude family), selectedOptionIds for
  // MULTI_SELECT, rankingOrder for RANKING.
  answerOptionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'AnswerOption' },
  selectedOptionIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'AnswerOption' },
  rankingOrder:    { type: [mongoose.Schema.Types.ObjectId], ref: 'AnswerOption' },
  score:          { type: Number, required: true },
  maxScore:       { type: Number, required: true },
  isCorrect:      { type: Boolean, default: null },
  dimension:      { type: String, required: true },
  dimensionScores:{ type: mongoose.Schema.Types.Mixed, default: undefined },
  questionOrder:  { type: Number, required: true },
  answeredAt:     { type: Date, required: true },
  timeTakenSeconds: { type: Number, min: 0 },
  status:         { type: String, enum: ['answered', 'skipped', 'timeout'], default: 'answered' },
});

userAnswerSchema.index({ sessionId: 1 });
userAnswerSchema.index({ userId: 1 });

module.exports = mongoose.model('UserAnswer', userAnswerSchema);
