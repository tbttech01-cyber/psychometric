function generateOTP() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 5 * 60 * 1000);
  return { otp, expiry };
}

module.exports = { generateOTP };
