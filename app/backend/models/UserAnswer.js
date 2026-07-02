const mongoose = require('mongoose');

const userAnswerSchema = new mongoose.Schema({
  sessionId:     { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentSession', required: true },
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questionId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  answerOptionId:{ type: mongoose.Schema.Types.ObjectId, ref: 'AnswerOption', required: true },
  marks:         { type: Number, required: true, min: 1, max: 5 },
  questionOrder: { type: Number, required: true },
  answeredAt:    { type: Date, required: true },
});

userAnswerSchema.index({ sessionId: 1 });
userAnswerSchema.index({ userId: 1 });

module.exports = mongoose.model('UserAnswer', userAnswerSchema);
