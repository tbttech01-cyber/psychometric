const mongoose = require('mongoose');

const businessMatrixCellSchema = new mongoose.Schema({
  rowTypeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionType', required: true },
  colTypeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionType', required: true },
  businessName: { type: String, required: true, trim: true, maxlength: 80 },
  rating:      { type: Number, required: true, min: 1, max: 5, default: 3 },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

businessMatrixCellSchema.index({ rowTypeId: 1, colTypeId: 1 }, { unique: true });

module.exports = mongoose.model('BusinessMatrixCell', businessMatrixCellSchema);
