module.exports = (err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Server error.' : err.message;
  res.status(status).json({ success: false, message });
};
