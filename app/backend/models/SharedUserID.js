const mongoose = require('mongoose');

const sharedUserIDSchema = new mongoose.Schema({
  code:       { type: String, required: true, unique: true, uppercase: true, trim: true, minlength: 4, maxlength: 20 },
  label:      { type: String, required: true, trim: true, maxlength: 100 },
  isActive:   { type: Boolean, default: true },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  usageCount: { type: Number, default: 0 },
}, { timestamps: true });

sharedUserIDSchema.index({ isActive: 1 });

module.exports = mongoose.model('SharedUserID', sharedUserIDSchema);
