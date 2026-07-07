const mongoose = require('mongoose');

const answerOptionSchema = new mongoose.Schema({
  questionId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  optionText:      { type: String, required: true, maxlength: 200 },
  optionImageUrl:  { type: String, default: '' },
  score:           { type: Number, required: true },
  isCorrect:       { type: Boolean, default: false },
  dimensionScores: { type: mongoose.Schema.Types.Mixed, default: undefined },
  order:           { type: Number, required: true, min: 1 },
}, { timestamps: { createdAt: true, updatedAt: false } });

answerOptionSchema.index({ questionId: 1, order: 1 });

module.exports = mongoose.model('AnswerOption', answerOptionSchema);
