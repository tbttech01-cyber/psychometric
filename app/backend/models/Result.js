const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  userId:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId:           { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentSession', required: true, unique: true },
  totalMarks:          { type: Number, required: true },
  percentage:          { type: Number, required: true },
  level:               { type: String, enum: ['Excellent', 'Good', 'Average', 'Needs Improvement'], required: true },
  categoryScores:      { type: Map, of: Number, required: true },
  categoryPercentages: { type: Map, of: Number, required: true },
  highestCategory:     { type: [String], required: true },
  recommendedBusiness: { type: [String], required: true },
  explanation:         { type: String, required: true, maxlength: 1000 },
  improvementAreas:    [{
    category:   { type: String },
    score:      { type: Number },
    suggestion: { type: String },
  }],
}, { timestamps: true });

resultSchema.index({ userId: 1 });
resultSchema.index({ createdAt: 1 });
resultSchema.index({ level: 1 });

module.exports = mongoose.model('Result', resultSchema);
