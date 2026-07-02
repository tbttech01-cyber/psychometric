const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { generateOTP } = require('../utils/otpGenerator');
const { sendOTPEmail } = require('../utils/emailSender');

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, admin.passwordHash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const { otp, expiry } = generateOTP();
    admin.otpCode = otp;
    admin.otpExpiry = expiry;
    await admin.save();

    await sendOTPEmail(admin.email, 'Admin', otp, 'admin');
    res.json({ success: true, message: 'OTP sent to your email.' });
  } catch (err) { next(err); }
};

exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    if (!admin.otpCode) return res.status(400).json({ success: false, message: 'OTP already used.' });
    if (Date.now() > admin.otpExpiry) return res.status(400).json({ success: false, message: 'OTP has expired. Please login again.' });
    if (admin.otpCode !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP.' });

    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
    admin.otpCode = undefined;
    admin.otpExpiry = undefined;
    admin.activeToken = token;
    admin.lastLoginAt = new Date();
    await admin.save();

    res.json({ success: true, token, admin: { _id: admin._id, email: admin.email } });
  } catch (err) { next(err); }
};

exports.logout = async (req, res, next) => {
  try {
    req.admin.activeToken = undefined;
    await req.admin.save();
    res.json({ success: true, message: 'Logged out.' });
  } catch (err) { next(err); }
};
