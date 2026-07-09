const mongoose = require('mongoose');

// A Question Set is a named, admin-managed grouping of questions with its own
// timer. Each SharedUserID (access code / cohort) is assigned one set; when a
// user starts an assessment they get that set's questions and duration. Sets
// are independent — editing one never affects another — and questions are
// SHARED: `questionIds` holds references, so the same Question can belong to
// many sets and deleting a set never deletes its questions.
//
// Array position in `questionIds` IS the per-set order — it is decoupled from
// the globally-unique `Question.order` field (see models/Question.js), so the
// same question can sit at different positions in different sets.
const questionSetSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true, maxlength: 100, unique: true },
  description:     { type: String, default: '', maxlength: 500 },
  durationMinutes: { type: Number, required: true, min: 1 },
  questionIds:     { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }], default: [] },
  isActive:        { type: Boolean, default: true },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
}, { timestamps: true });

questionSetSchema.index({ isActive: 1 });

module.exports = mongoose.model('QuestionSet', questionSetSchema);
