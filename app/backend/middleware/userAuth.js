const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'No token provided.' });

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'user')
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user)
      return res.status(401).json({ success: false, message: 'User not found.' });

    if (user.activeToken !== token)
      return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};
