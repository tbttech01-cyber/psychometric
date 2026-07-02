const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  typeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionType', required: true },
  text:     { type: String, required: true, maxlength: 500 },
  order:    { type: Number, required: true, unique: true, min: 1, max: 40 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

questionSchema.index({ typeId: 1, isActive: 1 });
questionSchema.index({ order: 1 });

module.exports = mongoose.model('Question', questionSchema);
