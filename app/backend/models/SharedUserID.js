const mongoose = require('mongoose');

const sharedUserIDSchema = new mongoose.Schema({
  code:       { type: String, required: true, unique: true, uppercase: true, trim: true, minlength: 4, maxlength: 20 },
  label:      { type: String, required: true, trim: true, maxlength: 100 },
  isActive:   { type: Boolean, default: true },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  usageCount: { type: Number, default: 0 },
  // The Question Set (cohort → set assignment) this access code resolves to
  // when one of its users starts an assessment. Nullable so a code can exist
  // before a set is assigned (users of an unassigned code are blocked at
  // startSession with a clear message).
  questionSetId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionSet', default: null },
}, { timestamps: true });

sharedUserIDSchema.index({ isActive: 1 });
sharedUserIDSchema.index({ questionSetId: 1 });

module.exports = mongoose.model('SharedUserID', sharedUserIDSchema);
