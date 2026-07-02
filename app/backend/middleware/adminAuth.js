const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

module.exports = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'No token provided.' });

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const admin = await Admin.findById(decoded.id).select('-passwordHash');
    if (!admin)
      return res.status(401).json({ success: false, message: 'Admin not found.' });

    if (admin.activeToken !== token)
      return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });

    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};
