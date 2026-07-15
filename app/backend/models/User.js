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
  // Per-login access-code gate. Reset to false on every login/verify so the
  // candidate must (re)validate an access code before the assessment unlocks;
  // set true by the authenticated /user/select-code step, which also (re)binds
  // sharedUserID/sharedCode to the chosen cohort. See userAuthController.
  codeSelected:           { type: Boolean, default: false },
  hasCompletedAssessment: { type: Boolean, default: false },
  // Reassessment (retake) approval workflow. A candidate who has completed the
  // assessment can request a retake; an admin must approve it before a new
  // attempt is allowed. 'approved' is consumed on the next startSession (which
  // resets it to 'none' and re-opens exactly one attempt) — see assessmentController.
  reassessmentStatus:      { type: String, enum: ['none', 'requested', 'approved'], default: 'none' },
  reassessmentRequestedAt: { type: Date },
  reassessmentDecidedAt:   { type: Date },
  phone:                  { type: String, trim: true },
  candidateId:            { type: String, unique: true, sparse: true },
  batch:                  { type: String, trim: true },
  accessExpiry:           { type: Date },
  restrictedAccess:       { type: Boolean, default: false },
}, { timestamps: true });

userSchema.index({ sharedUserID: 1 });

module.exports = mongoose.model('User', userSchema);
