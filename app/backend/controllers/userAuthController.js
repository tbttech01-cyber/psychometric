const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SharedUserID = require('../models/SharedUserID');
const { generateOTP } = require('../utils/otpGenerator');
const { sendOTPEmail, sendWelcomeEmail } = require('../utils/emailSender');

exports.validateCode = async (req, res, next) => {
  try {
    const code = (req.body.code || '').trim().toUpperCase();
    const shared = await SharedUserID.findOne({ code });
    if (!shared) return res.status(404).json({ success: false, message: 'Invalid access code.' });
    if (!shared.isActive) return res.status(403).json({ success: false, message: 'This access code is no longer active.' });
    res.json({ success: true, codeId: shared._id, label: shared.label });
  } catch (err) { next(err); }
};

exports.register = async (req, res, next) => {
  try {
    const { codeId, name, email, password } = req.body;
    const lEmail = email.toLowerCase();

    const shared = await SharedUserID.findById(codeId);
    if (!shared || !shared.isActive)
      return res.status(400).json({ success: false, message: 'Invalid access code.' });

    const existing = await User.findOne({ email: lEmail });
    if (existing) {
      if (existing.isVerified)
        return res.status(409).json({ success: false, message: 'Email already registered. Please login.' });

      // Resend OTP for unverified
      const { otp, expiry } = generateOTP();
      existing.otpCode = otp; existing.otpExpiry = expiry;
      await existing.save();
      await sendOTPEmail(lEmail, existing.name, otp);
      return res.json({ success: true, message: `OTP resent to ${lEmail}.` });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { otp, expiry } = generateOTP();
    await User.create({
      name: name.trim(), email: lEmail, passwordHash,
      sharedUserID: shared._id, sharedCode: shared.code,
      otpCode: otp, otpExpiry: expiry,
    });

    await sendOTPEmail(lEmail, name.trim(), otp);
    res.status(201).json({ success: true, message: `OTP sent to ${lEmail}. Valid for 5 minutes.` });
  } catch (err) { next(err); }
};

exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ success: false, message: 'User not found.' });
    if (!user.otpCode) return res.status(400).json({ success: false, message: 'OTP already used.' });
    if (Date.now() > user.otpExpiry) return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    if (user.otpCode !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP.' });

    const token = jwt.sign({ id: user._id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '2h' });
    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpiry = undefined;
    user.activeToken = token;
    await user.save();

    await SharedUserID.findByIdAndUpdate(user.sharedUserID, { $inc: { usageCount: 1 } });
    await sendWelcomeEmail(user.email, user.name, user.sharedCode).catch(() => {});

    res.json({
      success: true, token,
      user: { _id: user._id, name: user.name, email: user.email, sharedCode: user.sharedCode, hasCompletedAssessment: user.hasCompletedAssessment },
    });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    if (!user.isVerified) return res.status(403).json({ success: false, message: 'Please verify your email first.' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const token = jwt.sign({ id: user._id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '2h' });
    user.activeToken = token;
    await user.save();

    res.json({
      success: true, token,
      user: { _id: user._id, name: user.name, email: user.email, sharedCode: user.sharedCode, hasCompletedAssessment: user.hasCompletedAssessment },
    });
  } catch (err) { next(err); }
};

exports.resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || user.isVerified)
      return res.status(400).json({ success: false, message: 'Cannot resend OTP.' });

    const cooldown = 60 * 1000;
    if (user.updatedAt && Date.now() - user.updatedAt.getTime() < cooldown)
      return res.status(429).json({ success: false, message: 'Please wait 60 seconds before requesting a new OTP.' });

    const { otp, expiry } = generateOTP();
    user.otpCode = otp; user.otpExpiry = expiry;
    await user.save();
    await sendOTPEmail(email, user.name, otp);
    res.json({ success: true, message: 'New OTP sent.' });
  } catch (err) { next(err); }
};

exports.logout = async (req, res, next) => {
  try {
    req.user.activeToken = undefined;
    await req.user.save();
    res.json({ success: true, message: 'Logged out.' });
  } catch (err) { next(err); }
};
