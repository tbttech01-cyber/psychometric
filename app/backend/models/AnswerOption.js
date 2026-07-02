const mongoose = require('mongoose');

const answerOptionSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  label:      { type: String, required: true, maxlength: 100 },
  marks:      { type: Number, required: true, min: 1, max: 5 },
  order:      { type: Number, required: true, min: 1, max: 5 },
}, { timestamps: { createdAt: true, updatedAt: false } });

answerOptionSchema.index({ questionId: 1, order: 1 });

module.exports = mongoose.model('AnswerOption', answerOptionSchema);
