const mongoose = require('mongoose');

const questionTypeSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, trim: true, maxlength: 60 },
  description: { type: String, required: true, maxlength: 300 },
  icon:        { type: String, default: '' },
  color:       { type: String, default: '#2563EB' },
  order:       { type: Number, required: true, unique: true, min: 1 },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

questionTypeSchema.index({ order: 1 });
questionTypeSchema.index({ isActive: 1 });

module.exports = mongoose.model('QuestionType', questionTypeSchema);
