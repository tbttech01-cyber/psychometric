const mongoose = require('mongoose');

// A candidate's request to retake an assessment they've already completed.
// One request unlocks exactly ONE additional attempt, and only after an admin
// approves it. The request is snapshotted with the candidate's current result
// so the admin queue can show score/level without extra joins. Lifecycle:
//   pending -> approved -> used         (candidate started the granted retest)
//   pending -> rejected                 (admin declined; candidate may re-request)
// 'expired' is reserved for a future time-boxed approval; unused for now.
const retestRequestSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userName:        { type: String },
  userEmail:       { type: String },
  sharedCode:      { type: String },                                   // access code at request time
  questionSetId:   { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionSet' }, // the "assessment"

  // The attempt number this request would unlock (existing results + 1), and a
  // snapshot of the result the candidate is retaking from.
  attemptNumber:   { type: Number },
  currentResultId: { type: mongoose.Schema.Types.ObjectId, ref: 'Result' },
  currentPercentage: { type: Number },
  currentLevel:    { type: String },

  status:          { type: String, enum: ['pending', 'approved', 'rejected', 'used', 'expired'], default: 'pending', index: true },
  reason:          { type: String },        // optional candidate reason (future-ready)
  rejectionNote:   { type: String },        // optional admin note on reject
  requestedByUser: { type: Boolean, default: true },
  ipAddress:       { type: String },
  userAgent:       { type: String },

  decidedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  decidedAt:       { type: Date },
  usedAt:          { type: Date },
}, { timestamps: true });

retestRequestSchema.index({ userId: 1, status: 1 });
retestRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('RetestRequest', retestRequestSchema);
