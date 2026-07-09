const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
});

const brand = 'Tamil Business Tribe';
const primary = '#1B3A6B';

function template(body) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background:${primary};padding:24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:20px;">${brand}</h1>
        <p style="color:#BFDBFE;margin:4px 0 0;font-size:13px;">Psychometric Assessment Platform</p>
      </div>
      <div style="padding:32px;">${body}</div>
      <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;">
        © ${new Date().getFullYear()} ${brand}. All rights reserved.
      </div>
    </div>`;
}

async function sendOTPEmail(toEmail, toName, otp, type = 'user') {
  console.log(`[EMAIL BYPASS] OTP for ${toEmail} (${toName}): ${otp}`);
  
  if (process.env.NODE_ENV === 'development' && (!process.env.GMAIL_USER || process.env.GMAIL_USER === 'your.email@gmail.com' || process.env.GMAIL_PASS.includes('xxxx'))) {
    console.log('[DEV BYPASS] Using development bypass, skipped sending real email.');
    return;
  }

  const isAdmin = type === 'admin';
  const subject = isAdmin
    ? `Admin Login OTP — ${brand}`
    : `Verify Your Email — ${brand}`;

  const html = template(`
    <p style="color:#1e293b;">Hello ${toName || ''},</p>
    <p style="color:#475569;">Your one-time verification code is:</p>
    <div style="text-align:center;padding:24px;background:#EFF6FF;border-radius:8px;margin:24px 0;">
      <span style="font-size:40px;font-weight:bold;letter-spacing:12px;color:${primary};">${otp}</span>
    </div>
    <p style="color:#64748b;font-size:14px;">Valid for <strong>5 minutes</strong>. Do not share this code with anyone.</p>
  `);

  await transporter.sendMail({
    from: `"${brand}" <${process.env.GMAIL_USER}>`,
    to: toEmail, subject, html,
  });
}

async function sendWelcomeEmail(toEmail, toName, sharedCode) {
  console.log(`[EMAIL BYPASS] Welcome email for ${toEmail} (${toName}) with sharedCode: ${sharedCode}`);
  
  if (process.env.NODE_ENV === 'development' && (!process.env.GMAIL_USER || process.env.GMAIL_USER === 'your.email@gmail.com' || process.env.GMAIL_PASS.includes('xxxx'))) {
    console.log('[DEV BYPASS] Using development bypass, skipped sending welcome email.');
    return;
  }

  const html = template(`
    <p style="color:#1e293b;">Welcome, <strong>${toName}</strong>!</p>
    <p style="color:#475569;">Your account has been verified. You're ready to start your psychometric assessment.</p>
    <p style="color:#475569;">Your Shared Code: <strong style="color:${primary};">${sharedCode}</strong></p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${process.env.USER_APP_URL}/user/welcome.html"
         style="background:${primary};color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">
        Start Assessment →
      </a>
    </div>
  `);

  await transporter.sendMail({
    from: `"${brand}" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `Welcome to Your Assessment — ${toName}`,
    html,
  });
}

module.exports = { sendOTPEmail, sendWelcomeEmail };
