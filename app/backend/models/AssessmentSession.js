const mongoose = require('mongoose');

const assessmentSessionSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startedAt:     { type: Date, required: true },
  submittedAt:   { type: Date },
  expiresAt:     { type: Date, required: true },
  status:        { type: String, enum: ['in-progress', 'submitted', 'expired'], default: 'in-progress' },
  autoSubmitted: { type: Boolean, default: false },
  // Which attempt this is for the candidate (1 = first attempt, 2 = first
  // approved retest, ...). Carried onto the Result at submit so every attempt
  // is permanently distinguishable and history is preserved.
  attemptNumber: { type: Number, default: 1 },
  totalAnswered: { type: Number, default: 0 },
  ipAddress:     { type: String },

  // Snapshot of the assigned Question Set taken at startSession. `questionIds`
  // is the FROZEN, ordered list of questions this attempt is scored against —
  // getQuestions and submitAssessment read it (not the live set), so admin
  // edits to the set mid-attempt (reorder, membership, timer, cohort
  // reassignment, deactivating a reused question) can't corrupt an in-flight
  // attempt. Question content/marks/options stay live-read at submit. All
  // three are nullable/empty for legacy pre-Question-Set sessions.
  questionSetId:   { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionSet', default: null },
  questionIds:     { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }], default: [] },
  durationMinutes: { type: Number },
}, { timestamps: { createdAt: true, updatedAt: false } });

assessmentSessionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('AssessmentSession', assessmentSessionSchema);
