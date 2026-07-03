const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, admin.passwordHash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
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

exports.getProfile = async (req, res, next) => {
  try {
    res.json({ success: true, admin: { _id: req.admin._id, email: req.admin.email, lastLoginAt: req.admin.lastLoginAt } });
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.admin._id);
    const match = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!match) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    admin.activeToken = undefined;
    await admin.save();
    res.json({ success: true, message: 'Password changed. Please log in again.' });
  } catch (err) { next(err); }
};
