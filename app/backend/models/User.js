const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:                   { type: String, required: true, trim: true },
  email:                  { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash:           { type: String, required: true },
  sharedUserID:           { type: mongoose.Schema.Types.ObjectId, ref: 'SharedUserID', required: true },
  sharedCode:             { type: String, required: true },
  isVerified:             { type: Boolean, default: false },
  otpCode:                { type: String },
  otpExpiry:              { type: Date },
  activeToken:            { type: String },
  hasCompletedAssessment: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.index({ sharedUserID: 1 });

module.exports = mongoose.model('User', userSchema);
