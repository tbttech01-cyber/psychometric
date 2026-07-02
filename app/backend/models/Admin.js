const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  otpCode:      { type: String },
  otpExpiry:    { type: Date },
  activeToken:  { type: String },
  lastLoginAt:  { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
