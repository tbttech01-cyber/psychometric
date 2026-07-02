const mongoose = require('mongoose');

const assessmentSessionSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startedAt:     { type: Date, required: true },
  submittedAt:   { type: Date },
  expiresAt:     { type: Date, required: true },
  status:        { type: String, enum: ['in-progress', 'submitted', 'expired'], default: 'in-progress' },
  autoSubmitted: { type: Boolean, default: false },
  totalAnswered: { type: Number, default: 0 },
  ipAddress:     { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } });

assessmentSessionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('AssessmentSession', assessmentSessionSchema);
