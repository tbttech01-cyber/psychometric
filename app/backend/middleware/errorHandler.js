module.exports = (err, req, res, next) => {
  console.error(err.stack);

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    return res.status(409).json({ success: false, message: `That ${field} is already in use.` });
  }

  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Server error.' : err.message;
  res.status(status).json({ success: false, message });
};
