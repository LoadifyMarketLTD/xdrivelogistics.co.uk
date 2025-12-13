/**
 * Nodemailer transport with fallback to console logging
 * If SMTP is not configured, logs verification links instead of failing
 */
const nodemailer = require('nodemailer');

let transporter = null;
let useConsoleLog = false;

// Check if SMTP is configured
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  console.log('✓ SMTP configured');
} else {
  useConsoleLog = true;
  console.log('⚠ SMTP not configured - emails will be logged to console');
}

/**
 * Send verification email or log to console
 */
async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/verify-email?token=${encodeURIComponent(token)}`;
  
  const emailContent = {
    from: process.env.EMAIL_FROM || 'noreply@xdrivelogistics.co.uk',
    to: email,
    subject: 'Verify your XDrive account',
    text: `Please verify your account: ${verifyUrl}`,
    html: `<p>Please verify your account by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  };

  if (useConsoleLog) {
    console.log('\n=== EMAIL (VERIFICATION) ===');
    console.log(`To: ${email}`);
    console.log(`Subject: ${emailContent.subject}`);
    console.log(`Link: ${verifyUrl}`);
    console.log('===========================\n');
    return { messageId: 'console-log', accepted: [email] };
  } else {
    return await transporter.sendMail(emailContent);
  }
}

module.exports = {
  sendVerificationEmail,
};
